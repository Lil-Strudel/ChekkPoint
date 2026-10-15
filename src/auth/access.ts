import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	ownerAc,
} from "better-auth/plugins/organization/access";

export const statements = {
	...defaultStatements,
	eventGroup: ["create", "update", "delete"],
	course: ["create", "update", "delete"],
	timingPoint: ["create", "update", "delete"],
	staff: ["assign", "remove"],
	timing: ["record", "correct", "confirm", "allowance"],
} as const;

export const ac = createAccessControl(statements);

const runEvents = {
	eventGroup: ["create", "update", "delete"],
	course: ["create", "update", "delete"],
	timingPoint: ["create", "update", "delete"],
	staff: ["assign", "remove"],
	timing: ["record", "correct", "confirm", "allowance"],
} as const;

export const roles = {
	owner: ac.newRole({ ...ownerAc.statements, ...runEvents }),
	admin: ac.newRole({ ...adminAc.statements, ...runEvents }),
	director: ac.newRole(runEvents),
	steward: ac.newRole({
		timing: ["record", "correct", "confirm", "allowance"],
	}),
	member: ac.newRole({}),
};

export type OrgRole = keyof typeof roles;

export const ORG_ROLES = Object.keys(roles) as OrgRole[];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
	owner: "Owner",
	admin: "Admin",
	director: "Race director",
	steward: "Timing steward",
	member: "Member",
};

export function parseOrgRoles(role: string): OrgRole[] {
	return role
		.split(",")
		.map((r) => r.trim())
		.filter((r): r is OrgRole => r in roles);
}

export function orgRolesCan<R extends keyof typeof statements>(
	memberRoles: OrgRole[],
	resource: R,
	action: (typeof statements)[R][number],
) {
	return memberRoles.some(
		(role) => roles[role].authorize({ [resource]: [action] } as never).success,
	);
}
