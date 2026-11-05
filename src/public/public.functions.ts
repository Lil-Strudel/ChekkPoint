import { createServerFn } from "@tanstack/solid-start";
import {
	loadPublicAthleteById,
	loadPublicAthletesDirectory,
	loadPublicCourseById,
	loadPublicEventGroupBySlug,
	loadPublicEventsDirectory,
	loadPublicHomeData,
	loadPublicOrganizerBySlug,
	runOmniboxSearch,
} from "./public.server";
import {
	athleteIdInput,
	athletesDirectoryInput,
	courseIdInput,
	eventGroupSlugInput,
	eventsDirectoryInput,
	omniboxSearchInput,
	organizerSlugInput,
} from "./public.shared";

export const getPublicHomeData = createServerFn({ method: "GET" }).handler(() =>
	loadPublicHomeData(),
);

export const searchPublicOmnibox = createServerFn({ method: "GET" })
	.validator(omniboxSearchInput)
	.handler(({ data }) => runOmniboxSearch(data));

export const getPublicEventsDirectory = createServerFn({ method: "GET" })
	.validator(eventsDirectoryInput)
	.handler(({ data }) => loadPublicEventsDirectory(data));

export const getPublicEventGroupBySlug = createServerFn({ method: "GET" })
	.validator(eventGroupSlugInput)
	.handler(({ data }) => loadPublicEventGroupBySlug(data));

export const getPublicAthletesDirectory = createServerFn({ method: "GET" })
	.validator(athletesDirectoryInput)
	.handler(({ data }) => loadPublicAthletesDirectory(data));

export const getPublicAthleteById = createServerFn({ method: "GET" })
	.validator(athleteIdInput)
	.handler(({ data }) => loadPublicAthleteById(data));

export const getPublicCourseById = createServerFn({ method: "GET" })
	.validator(courseIdInput)
	.handler(({ data }) => loadPublicCourseById(data));

export const getPublicOrganizerBySlug = createServerFn({ method: "GET" })
	.validator(organizerSlugInput)
	.handler(({ data }) => loadPublicOrganizerBySlug(data));
