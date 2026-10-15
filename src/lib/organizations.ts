import * as z from "zod";
import type { courses, organizations, timingPoints } from "~/db/schema";
import type { EventGroupSummary } from "~/lib/events";

export type Organization = Pick<
	typeof organizations.$inferSelect,
	"name" | "slug"
>;

export type OrgRole = "owner" | "admin" | "volunteer";

export type OrgMember = {
	name: string;
	email: string;
	role: OrgRole;
};

export type OrgCourse = Pick<
	typeof courses.$inferSelect,
	"name" | "distanceMeters" | "elevationGainMeters"
>;

export type OrgTimingPoint = Pick<
	typeof timingPoints.$inferSelect,
	"name" | "code" | "elevationMeters"
>;

export type OrgEvent = {
	name: string;
	courseName: string;
	scheduledStart: Date;
	lapsRequired: number;
};

export type OrgEventGroup = EventGroupSummary & { events: OrgEvent[] };

export type OrgWorkspace = Organization & {
	eventGroups: OrgEventGroup[];
	courses: OrgCourse[];
	timingPoints: OrgTimingPoint[];
	members: OrgMember[];
};

export const roleLabels: Record<OrgRole, string> = {
	owner: "Owner",
	admin: "Admin",
	volunteer: "Volunteer",
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 48;

// Static segments under /orgs that a slug would otherwise shadow.
const RESERVED_SLUGS = new Set(["new"]);

export const organizationInput = z.object({
	name: z
		.string()
		.trim()
		.min(2, "Use at least 2 characters.")
		.max(80, "Keep it under 80 characters."),
	slug: z
		.string()
		.min(3, "Use at least 3 characters.")
		.max(SLUG_MAX, `Keep it under ${SLUG_MAX} characters.`)
		.regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.")
		.refine((slug) => !RESERVED_SLUGS.has(slug), "That address is reserved."),
});

export type OrganizationInput = z.infer<typeof organizationInput>;

export function slugify(name: string) {
	return name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, SLUG_MAX)
		.replace(/^-+|-+$/g, "");
}

// A pinned locale keeps SSR and hydrated text identical.
const LOCALE = "en-US";
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

const miles = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const feet = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatMiles(meters: number) {
	return `${miles.format(meters / METERS_PER_MILE)} mi`;
}

export function formatFeet(meters: number) {
	return `${feet.format(meters * FEET_PER_METER)} ft`;
}

export function formatDate(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone,
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

export function formatDateTime(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat(LOCALE, {
		timeZone,
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}
