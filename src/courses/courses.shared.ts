import { z } from "zod";

export const SUB_SPLIT_IN = 1;
export const SUB_SPLIT_OUT = 2;

export const courseIdInput = z.object({ courseId: z.uuid() });

const courseFields = {
	name: z.string().trim().min(1),
	distanceMeters: z.number().positive(),
	elevationGainMeters: z.number().int().nonnegative().nullable(),
	gpxRouteUrl: z.url().nullable(),
};

export const createCourseInput = z.object({
	organizationId: z.uuid(),
	...courseFields,
});

export const updateCourseInput = z.object({
	courseId: z.uuid(),
	...courseFields,
});

export const copyCourseInput = z.object({
	courseId: z.uuid(),
	name: z.string().trim().min(1),
});

const splitFields = {
	timingPointId: z.uuid(),
	name: z.string().trim().min(1),
	distanceFromStartMeters: z.number().nonnegative(),
	subSplitBitmap: z
		.number()
		.int()
		.min(SUB_SPLIT_IN)
		.max(SUB_SPLIT_IN | SUB_SPLIT_OUT),
	cutoffDurationSeconds: z.number().int().positive().nullable(),
	tsdIdealDurationSeconds: z.number().positive().nullable(),
	isSecretCheckpoint: z.boolean(),
};

export const createSplitInput = z.object({
	courseId: z.uuid(),
	...splitFields,
});

export const updateSplitInput = z.object({
	splitId: z.uuid(),
	...splitFields,
});

export const splitIdInput = z.object({ splitId: z.uuid() });

export const moveSplitInput = z.object({
	splitId: z.uuid(),
	direction: z.enum(["up", "down"]),
});
