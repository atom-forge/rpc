import {Packr} from "msgpackr";
import {z} from "zod";
import {RPC_ERROR_KEY} from "../util/constants.js";
import {pipeline} from "../util/pipeline.js";
import {getMiddlewares} from "./middleware.js";
import {ServerContext} from "./server-context.js";
import type {ApiDefinition, RpcMethodImplementationDescriptor, ServerMiddleware,} from "./types.js";
import {camelToKebabCase} from "../util/string.js";

const packr = new Packr({structuredClone: true, useRecords: true});
const acceptedRequests = ["GET.query", "GET.get", "POST.command"];
const acceptedMethods = ["GET", "POST"];

function flattenApiDefinition(
	apiDefinition: ApiDefinition<any>,
): Map<string, {rpcType: string; handler: (ctx: ServerContext) => Promise<any>}> {
	const map = new Map<string, {rpcType: string; handler: (ctx: ServerContext) => Promise<any>}>();

	function traverse(obj: any, prefix: string, inheritedMiddlewares: ServerMiddleware[]) {
		const middlewares = [...inheritedMiddlewares, ...getMiddlewares<ServerMiddleware>(obj)];
		for (const key of Object.keys(obj)) {
			const value = obj[key];
			if (!value || typeof value !== "object") continue;
			const fullKey = prefix ? `${prefix}.${camelToKebabCase(key)}` : camelToKebabCase(key);
			if ("rpcType" in value) {
				const {rpcType, implementation, zodSchema} = value as RpcMethodImplementationDescriptor<any, any, any>;
				const methodMiddlewares = [...middlewares, ...getMiddlewares<ServerMiddleware>(value)];
				const handler = (ctx: ServerContext) =>
					pipeline(ctx, ...methodMiddlewares, (ctx) => {
						let args = ctx.getArgs();
						if (zodSchema) args = zodSchema.parse(args);
						return (implementation as (args: any, ctx: ServerContext) => Promise<any>)(args, ctx);
					});
				map.set(fullKey, {rpcType, handler});
			} else {
				traverse(value, fullKey, middlewares);
			}
		}
	}

	traverse(apiDefinition, "", []);
	return map;
}

export type RpcHandler = {
	match(request: Request): boolean;
	handle(request: Request): Promise<Response>;
};

/**
 * Creates a handler for processing RPC requests.
 *
 * @param apiDefinition - The API definition object.
 * @param prefix - The URL path prefix where the RPC handler is mounted (e.g. `/rpc`).
 * @param options
 */
export function createHandler(
	apiDefinition: ApiDefinition<any>,
	prefix: string,
	options?: {
		createServerContext?: (args: any, request: Request) => ServerContext;
	},
): RpcHandler {
	const endpointMap = flattenApiDefinition(apiDefinition);
	const createServerContext =
		options?.createServerContext ||
		((args: any, request: Request) => new ServerContext(args, request));
	const normalizedPrefix = (prefix.startsWith("/") ? prefix : "/" + prefix).replace(/\/$/, "");

	function match(request: Request): boolean {
		return new URL(request.url).pathname.startsWith(normalizedPrefix);
	}

	async function handle(request: Request): Promise<Response> {
		if (!acceptedMethods.includes(request.method))
			return new Response("Method not allowed", {status: 405});

		const path = new URL(request.url).pathname.slice(normalizedPrefix.length).replace(/^\//, "");
		if (!path)
			return new Response("RPC method not found", {status: 404});

		const entry = endpointMap.get(path);
		if (!entry)
			return new Response("RPC method not found", {status: 404});

		const {rpcType, handler: rpcHandler} = entry;
		if (!acceptedRequests.includes(request.method + "." + rpcType))
			return new Response(
				`RPC type ${rpcType} not allowed for ${request.method} requests`,
				{status: 405},
			);

		let args: any;

		try {
			switch (rpcType) {
				case "get":
					args = parseGet(new URL(request.url));
					break;
				case "query":
					args = parseQuery(new URL(request.url));
					break;
				case "command":
					const requestContentType = request.headers.get("Content-Type") || "";
					if (requestContentType.includes("multipart/form-data")) {
						args = await parseCommandMultipartFormData(request);
					} else if (requestContentType.includes("application/json")) {
						args = await parseCommandJson(request);
					} else if (requestContentType.includes("application/msgpack") || requestContentType === "") {
						args = await parseCommandMsgpackr(request);
					} else {
						return new Response(`Unsupported Content-Type: ${requestContentType}`, {status: 415});
					}
					break;
			}
		} catch (e) {
			if (e instanceof ParseError)
				return new Response(e.message, {status: 400});
			console.error("[rpc] Unexpected error during request parsing:", e);
			return new Response("Internal server error", {status: 500});
		}

		const ctx = createServerContext(args, request);

		try {
			const result = await rpcHandler(ctx);
			return makeResponse(result, ctx, request);
		} catch (e) {
			if (e instanceof z.ZodError) {
				ctx.cache.set(0);
				return makeResponse({[RPC_ERROR_KEY]: "INVALID_ARGUMENT", issues: e.issues}, ctx, request);
			}
			console.error("[rpc] Unhandled error in RPC handler:", e);
			const correlationId = crypto.randomUUID();
			return new Response(
				JSON.stringify({[RPC_ERROR_KEY]: "INTERNAL_ERROR", correlationId}),
				{status: 500, headers: {"Content-Type": "application/json"}},
			);
		}
	}

	return {match, handle};
}

function makeResponse(result: any, ctx: ServerContext, request: Request): Response {
	const prefersJson = request.headers.get("Accept")?.includes("application/json");
	ctx.headers.response.set("x-atom-forge-rpc-exec-time", `${ctx.elapsedTime}`);
	ctx.headers.response.set(
		"Content-Type",
		prefersJson ? "application/json" : "application/msgpack",
	);
	if (request.method === "GET" && ctx.cache.get()) {
		ctx.headers.response.set(
			"Cache-Control",
			`public, max-age=${ctx.cache.get()}`,
		);
	}

	let body: string | Uint8Array;
	if (prefersJson) {
		body = JSON.stringify(result);
	} else {
		body = new Uint8Array(packr.pack(result));
	}
	return new Response(body as BodyInit, {
		headers: ctx.headers.response,
		status: ctx.status.get(),
	});
}

function parseGet(url: URL): Record<string, any> {
	let args: Record<string, any> = {};
	url.searchParams.forEach((value, key) => (args[key] = value));
	return args;
}

function parseQuery(url: URL): Record<string, any> {
	let args: Record<string, any> = {};
	try {
		const argsParam = url.searchParams.get("args");
		if (argsParam)
			args = packr.unpack(Buffer.from(argsParam, "base64url")) as Record<string, any>;
	} catch (e) {
		throw new ParseError("Invalid msgpackr body");
	}
	return args;
}

async function parseCommandMsgpackr(request: Request): Promise<Record<string, any>> {
	let args: Record<string, any> = {};
	try {
		const buffer = new Uint8Array(await request.arrayBuffer());
		if (buffer.length > 0) args = packr.unpack(buffer) || {};
	} catch (e) {
		throw new ParseError("Invalid msgpackr body");
	}
	return args;
}

async function parseCommandJson(request: Request): Promise<Record<string, any>> {
	let args: Record<string, any> = {};
	try {
		const text = await request.text();
		if (text) args = JSON.parse(text) || {};
	} catch (e) {
		throw new ParseError("Invalid JSON body");
	}
	return args;
}

async function parseCommandMultipartFormData(request: Request): Promise<Record<string, any>> {
	let args: Record<string, any> = {};
	const formData = await request.formData();
	const argsBlob = formData.get("args");
	if (argsBlob instanceof Blob) {
		const buffer = new Uint8Array(await argsBlob.arrayBuffer());
		// Some runtimes (e.g. Node.js) may not preserve the MIME type of blobs in
		// multipart form data. Fall back to msgpack since that is what the client sends.
		const argsType = argsBlob.type || "application/msgpack";
		switch (argsType) {
			case "application/json":
				try {
					args = JSON.parse(new TextDecoder().decode(buffer)) || {};
				} catch (e) {
					throw new ParseError("Invalid JSON in args blob");
				}
				break;
			case "application/msgpack":
				try {
					args = packr.unpack(buffer) || {};
				} catch (e) {
					throw new ParseError("Invalid msgpack in args blob");
				}
				break;
			default:
				throw new ParseError(`Unsupported args type: ${argsType}`);
		}
	}

	const keys = new Set<string>();
	formData.forEach((_, key) => keys.add(key));
	for (const key of keys) {
		if (key === "args") continue;
		if (key.endsWith("[]")) {
			args[key.substring(0, key.length - 2)] = formData.getAll(key);
		} else {
			args[key] = formData.get(key);
		}
	}
	return args;
}

class ParseError extends Error {}
