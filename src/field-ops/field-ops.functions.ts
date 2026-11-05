import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import {
	getAllStationsCustodyData,
	getEntrantEmergencyDossier,
	getFieldLoggerData,
	getNetControlSarData,
	getRawTimingStreamData,
	getStationCrossCheckData,
	ingestMt63RadioBlock,
	recordQuickStationAction,
	recordStationSplit,
	reportRunnerDrop,
	simulateHardwarePulse,
} from "./field-ops.server";
import {
	batchIngestSplitsInput,
	emergencyDossierInput,
	eventGroupSlugParams,
	ingestMt63RadioBlockInput,
	quickActionSplitInput,
	rawStreamParams,
	recordStationSplitInput,
	reportRunnerDropInput,
	sarParams,
	simulateTestPulseInput,
	stationParams,
} from "./field-ops.shared";

// ============================================================================
// QUERIES
// ============================================================================

export const getAllStationsCustody = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupSlugParams)
	.handler(async ({ data }) => {
		const result = await getAllStationsCustodyData(
			data.slug,
			data.eventGroupSlug,
		);
		if (!result) throw notFound();
		return result;
	});

export const getFieldLogger = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupSlugParams)
	.handler(async ({ data }) => {
		const result = await getFieldLoggerData(data.slug, data.eventGroupSlug);
		if (!result) throw notFound();
		return result;
	});

export const getStationCrossCheck = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(stationParams)
	.handler(async ({ data }) => {
		const result = await getStationCrossCheckData(
			data.slug,
			data.eventGroupSlug,
			data.timingPointId,
		);
		if (!result) throw notFound();
		return result;
	});

export const getNetControlSar = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(sarParams)
	.handler(async ({ data }) => {
		const result = await getNetControlSarData(
			data.slug,
			data.eventGroupSlug,
			data.eventId,
		);
		if (!result) throw notFound();
		return result;
	});

export const getEmergencyDossier = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(emergencyDossierInput)
	.handler(async ({ context, data }) => {
		return getEntrantEmergencyDossier(
			context.viewer,
			data.eventGroupId,
			data.entrantId,
		);
	});

export const getRawTimingStream = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(rawStreamParams)
	.handler(async ({ data }) => {
		const result = await getRawTimingStreamData(
			data.slug,
			data.eventGroupSlug,
			{
				status: data.status,
				limit: data.limit,
				offset: data.offset,
			},
		);
		if (!result) throw notFound();
		return result;
	});

// ============================================================================
// MUTATIONS
// ============================================================================

export const recordSplit = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(recordStationSplitInput)
	.handler(({ context, data }) => recordStationSplit(context.viewer, data));

export const recordQuickAction = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(quickActionSplitInput)
	.handler(({ context, data }) => recordQuickStationAction(context.viewer, data));

export const recordDrop = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(reportRunnerDropInput)
	.handler(({ context, data }) => reportRunnerDrop(context.viewer, data));

export const ingestMt63Block = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(ingestMt63RadioBlockInput)
	.handler(({ context, data }) => ingestMt63RadioBlock(context.viewer, data));

export const simulatePulse = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(simulateTestPulseInput)
	.handler(({ context, data }) => simulateHardwarePulse(context.viewer, data));
