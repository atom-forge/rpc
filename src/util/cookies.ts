export interface CookieOptions {
	maxAge?: number;
	expires?: Date;
	path?: string;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: "Strict" | "Lax" | "None";
}

function parseCookieHeader(header: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const pair of header.split(";")) {
		const idx = pair.indexOf("=");
		if (idx === -1) continue;
		const name = pair.slice(0, idx).trim();
		const value = pair.slice(idx + 1).trim();
		if (name) map.set(name, decodeURIComponent(value));
	}
	return map;
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
	let str = `${name}=${encodeURIComponent(value)}`;
	if (options.maxAge != null) str += `; Max-Age=${Math.floor(options.maxAge)}`;
	if (options.expires) str += `; Expires=${options.expires.toUTCString()}`;
	if (options.path != null) str += `; Path=${options.path}`;
	else str += "; Path=/";
	if (options.domain) str += `; Domain=${options.domain}`;
	if (options.secure) str += "; Secure";
	if (options.httpOnly) str += "; HttpOnly";
	if (options.sameSite) str += `; SameSite=${options.sameSite}`;
	return str;
}

export class CookieManager {
	private readonly parsed: Map<string, string>;

	constructor(
		private readonly requestHeaders: Headers,
		private readonly responseHeaders: Headers,
	) {
		this.parsed = parseCookieHeader(requestHeaders.get("Cookie") || "");
	}

	get(name: string): string | undefined {
		return this.parsed.get(name);
	}

	getAll(): { name: string; value: string }[] {
		return Array.from(this.parsed.entries()).map(([name, value]) => ({ name, value }));
	}

	set(name: string, value: string, options?: CookieOptions): void {
		this.parsed.set(name, value);
		this.responseHeaders.append("Set-Cookie", serializeCookie(name, value, options));
	}

	delete(name: string, options?: Omit<CookieOptions, "maxAge">): void {
		this.parsed.delete(name);
		this.responseHeaders.append(
			"Set-Cookie",
			serializeCookie(name, "", { ...options, maxAge: 0 }),
		);
	}
}
