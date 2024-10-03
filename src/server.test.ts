import { expect, it } from "vitest";
import { Client, type SuccessResponse } from "./client.js";
import { Server } from "./server.js";

it("receives a request then return a response", async () => {
	const server = new Server({ protocol: "udp" });
	server.listen(12345);
	const client = new Client({
		port: 12345,
		address: "127.0.0.1",
		protocol: "udp",
	});
	const res = await client.req("request", "binding");
	expect(res).toEqual({
		success: true,
		address: "222.62.247.70",
		port: 54321,
	} satisfies SuccessResponse);
	server.close();
});