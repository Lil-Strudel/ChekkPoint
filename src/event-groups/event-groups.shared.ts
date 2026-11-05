import { z } from "zod";
import { RulesConfigSchema } from "../db/schema";
import { eventGroupFields } from "../orgs/orgs.shared";

export const updateEventGroupInput = z
	.object({ eventGroupId: z.uuid(), ...eventGroupFields })
	.refine((g) => g.endDate >= g.startDate, {
		message: "The event group can't end before it starts.",
		path: ["endDate"],
	});

export const updateRulesConfigInput = z.object({
	eventGroupId: z.uuid(),
	rulesConfig: RulesConfigSchema,
});

const localDateTime = z.iso.datetime({ local: true });

const eventFields = {
	courseId: z.uuid(),
	name: z.string().trim().min(1),
	lapsRequired: z.number().int().min(1),
	scheduledStart: localDateTime,
	actualStart: localDateTime.nullable(),
};

export const createEventInput = z.object({
	eventGroupId: z.uuid(),
	...eventFields,
});

export const updateEventInput = z.object({
	eventId: z.uuid(),
	...eventFields,
});

export const eventIdInput = z.object({ eventId: z.uuid() });
