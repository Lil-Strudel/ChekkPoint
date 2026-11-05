import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { authMiddleware } from "../auth/middleware";
import {
	certifyOfficialResults,
	confirmScoredSplit,
	createTimeAllowance,
	deleteScoredSplit,
	deleteTimeAllowance,
	editScoredSplit,
	establishDrops,
	exportResultsData,
	getForensicWorkstationData,
	getPublicEntrantTelemetry,
	insertScoredSplit,
	reassignRawTimingEvent,
	rebuildSplits,
	updateTimeAllowance,
} from "./audit.server";
import {
	certifyOfficialResultsInput,
	confirmScoredSplitInput,
	createTimeAllowanceInput,
	deleteScoredSplitInput,
	deleteTimeAllowanceInput,
	editScoredSplitInput,
	establishDropsInput,
	exportResultsInput,
	insertScoredSplitInput,
	publicEntrantTelemetryInput,
	reassignRawTimingEventInput,
	rebuildSplitsInput,
	subEventAuditParams,
	updateTimeAllowanceInput,
} from "./audit.shared";

// ============================================================================
// QUERIES
// ============================================================================

export const getForensicWorkstation = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(subEventAuditParams)
	.handler(async ({ context, data }) => {
		const result = await getForensicWorkstationData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
			data.eventId,
			data.selectedEntrantId,
		);
		if (!result) throw notFound();
		return result;
	});

export const getPublicEntrantTelemetryFn = createServerFn({ method: "GET" })
	.validator(publicEntrantTelemetryInput)
	.handler(async ({ data }) => {
		const result = await getPublicEntrantTelemetry(data.slug, data.entrantId);
		if (!result) throw notFound();
		return result;
	});

// ============================================================================
// MUTATIONS
// ============================================================================

export const editScoredSplitFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(editScoredSplitInput)
	.handler(async ({ context, data }) => {
		return editScoredSplit(context.viewer, data);
	});

export const insertScoredSplitFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(insertScoredSplitInput)
	.handler(async ({ context, data }) => {
		return insertScoredSplit(context.viewer, data);
	});

export const deleteScoredSplitFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(deleteScoredSplitInput)
	.handler(async ({ context, data }) => {
		return deleteScoredSplit(context.viewer, data);
	});

export const confirmScoredSplitFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(confirmScoredSplitInput)
	.handler(async ({ context, data }) => {
		return confirmScoredSplit(context.viewer, data);
	});

export const reassignRawTimingEventFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(reassignRawTimingEventInput)
	.handler(async ({ context, data }) => {
		return reassignRawTimingEvent(context.viewer, data);
	});

export const createTimeAllowanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createTimeAllowanceInput)
	.handler(async ({ context, data }) => {
		return createTimeAllowance(context.viewer, data);
	});

export const updateTimeAllowanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateTimeAllowanceInput)
	.handler(async ({ context, data }) => {
		return updateTimeAllowance(context.viewer, data);
	});

export const deleteTimeAllowanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(deleteTimeAllowanceInput)
	.handler(async ({ context, data }) => {
		return deleteTimeAllowance(context.viewer, data);
	});

export const rebuildSplitsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rebuildSplitsInput)
	.handler(async ({ context, data }) => {
		return rebuildSplits(context.viewer, data);
	});

export const establishDropsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(establishDropsInput)
	.handler(async ({ context, data }) => {
		return establishDrops(context.viewer, data);
	});

export const certifyOfficialResultsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(certifyOfficialResultsInput)
	.handler(async ({ context, data }) => {
		return certifyOfficialResults(context.viewer, data);
	});

export const exportResultsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(exportResultsInput)
	.handler(async ({ context, data }) => {
		return exportResultsData(context.viewer, data);
	});
