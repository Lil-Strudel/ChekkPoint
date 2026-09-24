import * as z from "zod";

export const helloInput = z.object({
	id: z.uuid(),
	message: z.string().trim().min(1).max(255),
});

export type HelloRow = {
	id: string;
	message: string;
	createdAt: string;
	updatedAt: string;
};
