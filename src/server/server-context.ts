import {CookieManager} from "../util/cookies.js";

/**
 * The ServerContext class represents the context of a server request, holding
 * details such as headers, arguments, environment variables, caching, and status management.
 * It is designed to provide a streamlined interface for interacting with server-side request data.
 * @internal
 */
export class ServerContext<TAdapter = unknown> {
	private _cache: number = 0;
	private _status: number = 200;
	private readonly start: number;

	/** A Map object representing arguments passed to the server */
	public readonly args: Map<string, any>;
	/** An object containing request and response headers */
	public readonly headers: { request: Headers; response: Headers };
	/** Framework-agnostic cookie manager */
	public readonly cookies: CookieManager;
	/** Indicates the time elapsed since the creation of the ServerContext instance */
	get elapsedTime() {
		return performance.now() - this.start;
	}

	constructor(
		args: Record<string, any> | undefined,
		public readonly request: Request,
		public readonly adapterContext: TAdapter,
	) {
		this.start = performance.now();
		this.args = new Map(Object.entries(args || {}));
		this.headers = {
			request: request.headers,
			response: new Headers(),
		};
		this.cookies = new CookieManager(request.headers, this.headers.response);
	}

	/** Retrieves all arguments as a plain JavaScript object */
	public getArgs(): Record<string, any> {
		return Object.fromEntries(this.args);
	}

	/** A Map of custom environment variables relevant to the server context. */
	public readonly env: Map<string | symbol, any> = new Map();
	/** An object with methods to set and get cache duration. */
	public readonly cache = {
		set: (seconds: number) => (this._cache = Math.max(0, Math.floor(seconds))),
		get: () => this._cache,
	};
	/** An object providing methods to set or retrieve response status codes, as well as predefined shortcuts for common HTTP status codes. */
	public readonly status = {
		set: (status: number) => (this._status = status),
		get: () => this._status,
		// 1xx - Informational
		continue: () => (this._status = 100),
		switchingProtocols: () => (this._status = 101),
		processing: () => (this._status = 102),
		// 2xx - Success
		ok: () => (this._status = 200),
		created: () => (this._status = 201),
		accepted: () => (this._status = 202),
		noContent: () => (this._status = 204),
		resetContent: () => (this._status = 205),
		partialContent: () => (this._status = 206),
		// 3xx - Redirection
		multipleChoices: () => (this._status = 300),
		movedPermanently: () => (this._status = 301),
		found: () => (this._status = 302),
		seeOther: () => (this._status = 303),
		notModified: () => (this._status = 304),
		temporaryRedirect: () => (this._status = 307),
		permanentRedirect: () => (this._status = 308),
		// 4xx - Client Error
		badRequest: () => (this._status = 400),
		unauthorized: () => (this._status = 401),
		paymentRequired: () => (this._status = 402),
		forbidden: () => (this._status = 403),
		notFound: () => (this._status = 404),
		methodNotAllowed: () => (this._status = 405),
		notAcceptable: () => (this._status = 406),
		conflict: () => (this._status = 409),
		gone: () => (this._status = 410),
		lengthRequired: () => (this._status = 411),
		preconditionFailed: () => (this._status = 412),
		payloadTooLarge: () => (this._status = 413),
		uriTooLong: () => (this._status = 414),
		badContent: () => (this._status = 415),
		rangeNotSatisfiable: () => (this._status = 416),
		expectationFailed: () => (this._status = 417),
		tooManyRequests: () => (this._status = 429),
		// 5xx - Server Error
		serverError: () => (this._status = 500),
		notImplemented: () => (this._status = 501),
		badGateway: () => (this._status = 502),
		serviceUnavailable: () => (this._status = 503),
		gatewayTimeout: () => (this._status = 504),
		httpVersionNotSupported: () => (this._status = 505),
	};
}
