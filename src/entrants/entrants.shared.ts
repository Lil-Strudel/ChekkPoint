import { z } from "zod";
import { entrantStatusEnum, ParticipantDataSchema } from "../db/schema";

export const ENTRANT_STATUSES = entrantStatusEnum.enumValues;

export type EntrantStatus = (typeof ENTRANT_STATUSES)[number];

export const ENTRANT_STATUS_LABELS: Record<EntrantStatus, string> = {
	registered: "Registered",
	checked_in: "Checked in",
	dns: "DNS",
	in_progress: "On course",
	finished: "Finished",
	dnf: "DNF",
	retired: "Retired on course",
	dq: "Disqualified",
	otl: "Over time limit",
};

export const DROPPED_STATUSES: EntrantStatus[] = [
	"dnf",
	"retired",
	"dq",
	"otl",
];

const optionalText = z.string().trim().min(1).nullable();
const localDateTime = z.iso.datetime({ local: true });

export const personInput = z.object({
	firstName: z.string().trim().min(1),
	lastName: z.string().trim(),
	email: z.email().nullable(),
	gender: optionalText,
	birthdate: z.iso.date().nullable(),
	phone: optionalText,
});

export const emergencyContactInput = z.object({
	name: z.string().trim().min(1),
	phone: optionalText,
	relationship: optionalText,
	isOnSite: z.boolean(),
});

const entrantFields = {
	eventId: z.uuid(),
	person: personInput,
	competitorNumber: z.string().trim().min(1),
	rfidCode: optionalText,
	division: z.string().trim().min(1),
	status: z.enum(ENTRANT_STATUSES),
	participantData: ParticipantDataSchema,
	emergencyContact: emergencyContactInput.nullable(),
	scheduledStartTime: localDateTime.nullable(),
	actualStartTime: localDateTime.nullable(),
	droppedSplitId: z.uuid().nullable(),
	dropReason: optionalText,
	dropLocationDescription: optionalText,
	comments: optionalText,
};

export const createEntrantInput = z.object(entrantFields);

export const updateEntrantInput = z.object({
	entrantId: z.uuid(),
	...entrantFields,
});

export const entrantIdInput = z.object({ entrantId: z.uuid() });

export const IMPORT_COLUMNS = [
	"bib",
	"first_name",
	"last_name",
	"email",
	"gender",
	"birthdate",
	"division",
	"rfid",
	"phone",
	"emergency_name",
	"emergency_phone",
	"emergency_relationship",
] as const;

export const importRowInput = z.object({
	competitorNumber: z.string().trim().min(1, "Bib is missing."),
	person: personInput,
	division: z.string().trim().min(1),
	rfidCode: optionalText,
	emergencyContact: emergencyContactInput.nullable(),
});

export type ImportRow = z.infer<typeof importRowInput>;

export const importEntrantsInput = z.object({
	eventId: z.uuid(),
	rows: z.array(importRowInput).min(1).max(5000),
});
