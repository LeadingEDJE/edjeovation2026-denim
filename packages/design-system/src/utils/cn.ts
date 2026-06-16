/** Joins truthy class names with a space. Falsy values are dropped. */
export function cn(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(" ");
}
