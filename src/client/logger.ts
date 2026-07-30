import {camelToKebabCase} from "../util/string.js";
import type {RpcResponse} from "./rpc-response.js";
import type {ClientMiddleware} from "./types.js";

/**
 * A client middleware that logs RPC call details to the browser console.
 * Logs the request path, arguments, response, timing, and HTTP status.
 */
export function clientLogger(baseUrl: string = "/api"): ClientMiddleware {
    return async (ctx, next) => {
        const entries: Parameters<typeof console.log>[] = [];
        const rpcType = {query: "QRY", get: "GET", command: "CMD"}[ctx.rpcType];
        const rpcTypeColor = {query: "#3498db", get: "#2ecc71", command: "#9b59b6"}[ctx.rpcType];
        const log = (...args: Parameters<typeof console.log>) => entries.push(args);
        const flush = () => {
            const rpcResponse = ctx.result as RpcResponse<any, any> | undefined;
            const rpcStatus = rpcResponse?.status;
            const rpcStatusColor =
                rpcStatus === "OK" ? "#2ecc71" :
                rpcStatus === "NETWORK_ERROR" ? "#e74c3c" :
                "#f39c12";

            if (ctx.response) {
                const duration = Math.round(ctx.elapsedTime);
                const executionTime = Math.round(
                    parseFloat(ctx.response.headers.get("x-atom-forge-rpc-exec-time") || "0"),
                );
                let color: string;
                if (ctx.response.status < 200) color = "#3498db";
                else if (ctx.response.status < 300) color = "#2ecc71";
                else if (ctx.response.status < 400) color = "#f1c40f";
                else if (ctx.response.status < 500) color = "#e74c3c";
                else color = "#9b59b6";

                console.groupCollapsed(
                    `%c${rpcType} %c${baseUrl}/%c${ctx.path.map(camelToKebabCase).join(".")} %c${ctx.response.status} %c${ctx.response.statusText}%c : %c${rpcStatus} %c${executionTime}ms ⮕ ${duration}ms`,
                    `font-weight:800; color: ${rpcTypeColor}`,
                    "font-weight:200; color:gray",
                    "font-weight:800;",
                    `font-weight:800; color: ${color}`,
                    `font-weight:200; color: ${color}`,
                    "font-weight:normal; color:gray",
                    `font-weight:800; color: ${rpcStatusColor}`,
                    "font-weight:200; color:gray",
                );
            } else {
                console.groupCollapsed(
                    `%c${rpcType} %c${baseUrl}/%c${ctx.path.map(camelToKebabCase).join(".")}%c : %c${rpcStatus}`,
                    `font-weight:800; color: ${rpcTypeColor}`,
                    "font-weight:200; color:gray",
                    "font-weight:800;",
                    "font-weight:normal; color:gray",
                    `font-weight:800; color: ${rpcStatusColor}`,
                );
            }
            for (const args of entries) console.log(...args);
            console.groupEnd();
        };

        const args = ctx.getArgs();
        if (Object.keys(args).length > 0) log("ARG:", args);

        try {
            await next();
        } catch (e) {
            log("PIPELINE ERR:", e);
            flush();
            throw e;
        }

        const rpcResponse = ctx.result as RpcResponse<any, any>;
        log("RES:", rpcResponse.result);

        if (!ctx.response) {
            const duration = Math.round(ctx.elapsedTime);
            log(
                `%c${duration}ms %c(no response object)`,
                "font-weight:200; color:gray",
                "font-weight:200; color:gray",
            );
        }

        flush();
    };
}
