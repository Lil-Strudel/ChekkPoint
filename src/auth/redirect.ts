export function safeRedirect(target: unknown) {
	if (typeof target !== "string" || !target.startsWith("/")) return "/orgs";
	if (target.startsWith("//")) return "/orgs";
	return target;
}
