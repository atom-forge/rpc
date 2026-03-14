import {RPC_ERROR_KEY} from "../util/constants.js";

export function invalidArgument(details?: Record<string, any>) {
	return {[RPC_ERROR_KEY]: "INVALID_ARGUMENT" as const, ...details};
}

export function permissionDenied(details?: Record<string, any>) {
	return {[RPC_ERROR_KEY]: "PERMISSION_DENIED" as const, ...details};
}

export function internalError(details?: Record<string, any>) {
	return {
		[RPC_ERROR_KEY]: "INTERNAL_ERROR" as const,
		correlationId: crypto.randomUUID(),
		...details,
	};
}
