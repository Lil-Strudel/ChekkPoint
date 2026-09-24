import { createServerFn } from "@tanstack/solid-start";
import { insertHello, updateHelloMessage } from "./hello.server";
import { helloInput } from "./hello.shared";

export const createHello = createServerFn({ method: "POST" })
	.validator(helloInput)
	.handler(({ data }) => insertHello(data));

export const updateHello = createServerFn({ method: "POST" })
	.validator(helloInput)
	.handler(({ data }) => updateHelloMessage(data));
