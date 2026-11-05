import { notFound } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { getViewer } from "../auth/session.server";
import {
	assignStaffTimingPoint,
	checkInEntrant,
	checkXco80PercentPull,
	closeBackyardYard,
	createSubEvent,
	generateTsdIntervalStarts,
	getDisciplineRulesAndStaffData,
	getStaffPortalBridgeData,
	getSubEventCourseData,
	getSubEventEntrantsData,
	getSubEventOverviewData,
	getWeekendHubOverviewData,
	recalculateEntrantProjection,
	recordDownhillGateRelease,
	recordFixedTimePartialDistance,
	recordGunStart,
	removeStaffMember,
	removeStaffTimingPoint,
	resetGunStart,
	rosterStaffMember,
	toggleTsdSecretCheckpoints,
	triggerDownhillRedFlag,
	updateEntrantWorkspace,
	updateEventGroupRules,
	updatePartialRulesConfig,
	updateStaffRoles,
	verifyExternalProfile,
} from "./race-control.server";
import {
	assignStaffTimingPointInput,
	backyardCloseYardInput,
	checkInEntrantInput,
	createSubEventInput,
	downhillGateReleaseInput,
	downhillRedFlagHoldInput,
	eventGroupSlugParams,
	fixedTimeRecordPartialLapInput,
	partialRulesConfigInput,
	recalculateEntrantProjectionInput,
	removeStaffMemberInput,
	removeStaffTimingPointInput,
	resetEventGunInput,
	rosterStaffMemberInput,
	startEventGunInput,
	subEventParams,
	tsdGenerateIntervalStartsInput,
	tsdRevealSecretCheckpointsInput,
	updateEntrantWorkspaceInput,
	updateEventGroupRulesInput,
	updateStaffRolesInput,
	verifyExternalProfileInput,
	xcoCheckLappedPullInput,
} from "./race-control.shared";

// ============================================================================
// WEEKEND HUB FUNCTIONS
// ============================================================================

export const getWeekendHubOverview = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupSlugParams)
	.handler(async ({ context, data }) => {
		const result = await getWeekendHubOverviewData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
		);
		if (!result) throw notFound();
		return result;
	});

export const getDisciplineRulesAndStaff = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(eventGroupSlugParams)
	.handler(async ({ context, data }) => {
		const result = await getDisciplineRulesAndStaffData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
		);
		if (!result) throw notFound();
		return result;
	});

export const editEventGroupRules = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEventGroupRulesInput)
	.handler(({ context, data }) => updateEventGroupRules(context.viewer, data));

export const editPartialRulesConfig = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(partialRulesConfigInput)
	.handler(({ context, data }) => updatePartialRulesConfig(context.viewer, data));

export const assignStaffStationFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(assignStaffTimingPointInput)
	.handler(({ context, data }) => assignStaffTimingPoint(context.viewer, data));

export const removeStaffStationFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(removeStaffTimingPointInput)
	.handler(({ context, data }) => removeStaffTimingPoint(context.viewer, data));

export const editStaffRolesFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateStaffRolesInput)
	.handler(({ context, data }) => updateStaffRoles(context.viewer, data));

export const rosterStaffMemberFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rosterStaffMemberInput)
	.handler(({ context, data }) => rosterStaffMember(context.viewer, data));

export const removeStaffMemberFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(removeStaffMemberInput)
	.handler(({ context, data }) => removeStaffMember(context.viewer, data));

export const addSubEventFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(createSubEventInput)
	.handler(({ context, data }) => createSubEvent(context.viewer, data));

// ============================================================================
// SUB-EVENT WORKSPACE FUNCTIONS
// ============================================================================

export const getSubEventOverview = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(subEventParams)
	.handler(async ({ context, data }) => {
		const result = await getSubEventOverviewData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
			data.eventId,
		);
		if (!result) throw notFound();
		return result;
	});

export const startGunFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(startEventGunInput)
	.handler(({ context, data }) => recordGunStart(context.viewer, data));

export const resetGunFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(resetEventGunInput)
	.handler(({ context, data }) => resetGunStart(context.viewer, data));

// ============================================================================
// DISCIPLINE OPERATIONAL ACTION FUNCTIONS
// ============================================================================

export const backyardCloseYardFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(backyardCloseYardInput)
	.handler(({ context, data }) => closeBackyardYard(context.viewer, data));

export const tsdGenerateIntervalsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(tsdGenerateIntervalStartsInput)
	.handler(({ context, data }) => generateTsdIntervalStarts(context.viewer, data));

export const tsdToggleSecretCheckpointsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(tsdRevealSecretCheckpointsInput)
	.handler(({ context, data }) => toggleTsdSecretCheckpoints(context.viewer, data));

export const downhillGateReleaseFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(downhillGateReleaseInput)
	.handler(({ context, data }) => recordDownhillGateRelease(context.viewer, data));

export const downhillTriggerRedFlagFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(downhillRedFlagHoldInput)
	.handler(({ context, data }) => triggerDownhillRedFlag(context.viewer, data));

export const xcoCheckPullFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(xcoCheckLappedPullInput)
	.handler(({ context, data }) => checkXco80PercentPull(context.viewer, data));

export const fixedTimeRecordPartialLapFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(fixedTimeRecordPartialLapInput)
	.handler(({ context, data }) => recordFixedTimePartialDistance(context.viewer, data));

// ============================================================================
// SUB-EVENT COURSE & ENTRANTS FUNCTIONS
// ============================================================================

export const getSubEventCourse = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(subEventParams)
	.handler(async ({ context, data }) => {
		const result = await getSubEventCourseData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
			data.eventId,
		);
		if (!result) throw notFound();
		return result;
	});

export const getSubEventEntrants = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(subEventParams)
	.handler(async ({ context, data }) => {
		const result = await getSubEventEntrantsData(
			context.viewer,
			data.slug,
			data.eventGroupSlug,
			data.eventId,
		);
		if (!result) throw notFound();
		return result;
	});

export const checkInEntrantFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(checkInEntrantInput)
	.handler(({ context, data }) => checkInEntrant(context.viewer, data));

export const editEntrantWorkspaceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateEntrantWorkspaceInput)
	.handler(({ context, data }) => updateEntrantWorkspace(context.viewer, data));

export const verifyExternalProfileFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(verifyExternalProfileInput)
	.handler(({ context, data }) => verifyExternalProfile(context.viewer, data));

export const recalculateProjectionFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(recalculateEntrantProjectionInput)
	.handler(({ context, data }) => recalculateEntrantProjection(context.viewer, data));

export const getStaffPortalBridge = createServerFn({ method: "GET" })
	.validator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const viewer = await getViewer();
		return getStaffPortalBridgeData(viewer, data.slug);
	});
