import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { athleteSelfCheckIn, loadAccountOverview } from "./account.server";
import { authMiddleware } from "./middleware";
import {
	addMyExternalProfile,
	removeMyExternalProfile,
	updatePersonName,
	updatePersonProfile,
} from "./people.server";
import { ForbiddenError } from "./permissions.server";

export const getAccountOverview = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(({ context }) => loadAccountOverview(context.viewer));

export const updateMyName = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			firstName: z.string().trim().min(1),
			lastName: z.string().trim(),
		}),
	)
	.handler(({ context, data }) =>
		updatePersonName(context.viewer.user.id, data),
	);

export const updateMyProfile = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z
			.object({
				firstName: z.string().trim().min(1),
				lastName: z.string().trim(),
				gender: z.string().trim().nullable().optional(),
				birthdate: z.string().trim().nullable().optional(),
				phone: z.string().trim().nullable().optional(),
				city: z.string().trim().nullable().optional(),
				state: z.string().trim().nullable().optional(),
				country: z.string().trim().nullable().optional(),
				address: z
					.object({
						city: z.string().trim().nullable().optional(),
						state: z.string().trim().nullable().optional(),
						country: z.string().trim().nullable().optional(),
					})
					.optional(),
			})
			.transform((data) => ({
				firstName: data.firstName,
				lastName: data.lastName,
				gender: data.gender,
				birthdate: data.birthdate,
				phone: data.phone,
				city: data.city ?? data.address?.city ?? null,
				state: data.state ?? data.address?.state ?? null,
				country: data.country ?? data.address?.country ?? null,
			})),
	)
	.handler(({ context, data }) =>
		updatePersonProfile(context.viewer.user.id, data),
	);

export const linkMyExternalProfile = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			platform: z.enum([
				"ultrasignup",
				"itra",
				"strava",
				"duv",
				"athlinks",
				"custom",
			]),
			externalIdentifier: z.string().trim().min(1),
			profileUrl: z.string().url().nullable().optional(),
		}),
	)
	.handler(({ context, data }) => {
		if (!context.viewer.person?.id) throw new ForbiddenError();
		return addMyExternalProfile(context.viewer.person.id, data);
	});

export const unlinkMyExternalProfile = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			profileId: z.uuid(),
		}),
	)
	.handler(({ context, data }) => {
		if (!context.viewer.person?.id) throw new ForbiddenError();
		return removeMyExternalProfile(context.viewer.person.id, data.profileId);
	});

export const selfCheckInAction = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			entrantId: z.uuid(),
		}),
	)
	.handler(({ context, data }) =>
		athleteSelfCheckIn(context.viewer, data.entrantId),
	);
