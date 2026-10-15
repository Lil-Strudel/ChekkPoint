import { z } from "zod";

export const STAFF_ROLES = [
	"volunteer",
	"checkpoint_captain",
	"official",
	"medical",
] as const;

export const STAFF_ROLE_LABELS: Record<(typeof STAFF_ROLES)[number], string> = {
	volunteer: "Volunteer",
	checkpoint_captain: "Checkpoint captain",
	official: "Official",
	medical: "Medical / SAR",
};

export const DISCIPLINES = [
	"trail_ultra",
	"road_marathon",
	"backyard_ultra",
	"fixed_time_loop",
	"downhill_mtb",
	"xco_cycling",
	"tsd_regularity",
] as const;

const SLUG_MAX = 48;

// Static segments under /orgs that a slug would otherwise shadow.
const RESERVED_SLUGS = new Set(["new"]);

export function slugify(name: string) {
	return name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, SLUG_MAX)
		.replace(/^-+|-+$/g, "");
}

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
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Use lowercase letters, numbers and single hyphens.",
		)
		.refine((slug) => !RESERVED_SLUGS.has(slug), "That address is reserved."),
});

export type OrganizationInput = z.infer<typeof organizationInput>;

export const slugInput = z.object({ slug: z.string().min(1) });

export const eventGroupIdInput = z.object({ eventGroupId: z.uuid() });

export const createEventGroupInput = z.object({
	organizationId: z.uuid(),
	name: z.string().trim().min(1),
	discipline: z.enum(DISCIPLINES),
	startDate: z.iso.date(),
	endDate: z.iso.date(),
});

export const createTimingPointInput = z.object({
	organizationId: z.uuid(),
	name: z.string().trim().min(1),
	code: z
		.string()
		.trim()
		.min(1)
		.transform((c) => c.toUpperCase()),
});

export const assignStaffInput = z.object({
	eventGroupId: z.uuid(),
	firstName: z.string().trim().min(1),
	lastName: z.string().trim(),
	email: z.email(),
	roles: z.array(z.enum(STAFF_ROLES)).min(1),
	timingPointIds: z.array(z.uuid()),
});

export const removeStaffInput = z.object({
	eventGroupId: z.uuid(),
	staffId: z.uuid(),
});

export const recordTimeInput = z.object({
	eventGroupId: z.uuid(),
	timingPointId: z.uuid(),
	competitorNumber: z.string().trim().min(1),
	subSplitKind: z.enum(["in", "out", "point"]),
});
