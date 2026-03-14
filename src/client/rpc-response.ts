import {RPC_ERROR_KEY} from "../util/constants.js";
import type {ClientContext} from "./client-context.js";

export {RPC_ERROR_KEY};

type RpcErrorKey = typeof RPC_ERROR_KEY;
type RpcErrorObject = {[K in RpcErrorKey]: string};

export class RpcResponse<TSuccess, TError extends RpcErrorObject = never> {
	private readonly _status: string;
	private readonly _result: TSuccess | Omit<TError, RpcErrorKey>;
	private _ctx?: ClientContext;

	constructor(status: string, result: TSuccess | Omit<TError, RpcErrorKey>) {
		this._status = status;
		this._result = result;
	}

	isOK(): this is RpcResponse<TSuccess, never> {
		return this._status === "OK";
	}

	isError<TCode extends string>(
		code?: TCode,
	): this is RpcResponse<never, Extract<TError, {[K in RpcErrorKey]: TCode}>> {
		if (code !== undefined) return this._status === code;
		return this._status !== "OK";
	}

	getStatus(): string {
		return this._status;
	}

	get status(): string {
		return this._status;
	}

	getResult(): TSuccess | Omit<TError, RpcErrorKey> {
		return this._result;
	}

	get result(): TSuccess | Omit<TError, RpcErrorKey> {
		return this._result;
	}

	getCtx(): ClientContext {
		if (!this._ctx) throw new Error("ClientContext is not available on this RpcResponse");
		return this._ctx;
	}

	get ctx(): ClientContext {
		return this.getCtx();
	}

	/** @internal */
	_attachCtx(ctx: ClientContext): void {
		this._ctx = ctx;
	}

	static ok<T>(result: T): RpcResponse<T, never> {
		return new RpcResponse<T, never>("OK", result);
	}

	static error(code: string, result: unknown): RpcResponse<any, any> {
		return new RpcResponse<any, any>(code, result);
	}
}
