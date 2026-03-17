import {camelToKebabCase} from "../util/string.js";
import type {ClientMiddleware} from "./types.js";

/**
 * A client middleware that logs RPC call details to the browser console.
 * Logs the request path, arguments, response, timing, and HTTP status.
 */
export function clientLogger(baseUrl: string = "/api"): ClientMiddleware {
    return async (ctx, next) => {
        console.groupCollapsed(
            `🔆 %c${baseUrl}/%c${ctx.path.map(camelToKebabCase).join(".")}`,
            "font-weight:200; color:gray",
            "font-weight:800;",
        );
        console.log("ARG:", ctx.getArgs());

        try {
            await next();
        } catch (e) {
            console.log("PIPELINE ERR:", e);
            console.groupEnd();
            throw e;
        }

        const duration = ctx.elapsedTime.toFixed(2);
        console.log("RES:", ctx.result);

        if (ctx.response) {
            console.log(
                `%c${duration} %cms / %c${parseFloat(ctx.response.headers.get("x-atom-forge-rpc-exec-time") || "0").toFixed(2)} %cms`,
                "font-weight:800;",
                "font-weight:200;",
                "font-weight:800;",
                "font-weight:200;",
            );
            console.groupEnd();

            let color: string;
            if (ctx.response.status < 200) color = "#3498db";
            else if (ctx.response.status < 300) color = "#2ecc71";
            else if (ctx.response.status < 400) color = "#f1c40f";
            else if (ctx.response.status < 500) color = "#e74c3c";
            else color = "#9b59b6";

            console.log(
                `️ ↘ %c${ctx.response.status} %c${ctx.response.statusText}`,
                `font-weight:800; color: ${color}`,
                `font-weight:200; color: ${color}`,
            );
        } else {
            console.log(
                `%c${duration} %cms %c(no response object)`,
                "font-weight:800;",
                "font-weight:200; color:gray",
            );
            console.groupEnd();
        }
    };
}
