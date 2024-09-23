import { describe, expect, it, test } from "vitest";
import {
	type Header,
	type MsgType,
	classRecord,
	decodeHeader,
	decodeMsgType,
	encodeMsgType,
	methodRecord,
} from "./header.js";

describe("encodeMsgType", () => {
	test.each([
		{
			arg: { method: methodRecord.binding, cls: classRecord.request },
			expected: Buffer.from([0b00_000000, 0b00000001]),
			methodName: "Binding",
			className: "request",
		},
		{
			arg: {
				method: methodRecord.binding,
				cls: classRecord.successResponse,
			},
			expected: Buffer.from([0b00_000001, 0b00000001]),
			methodName: "Binding",
			className: "success response",
		},
		{
			arg: {
				method: methodRecord.binding,
				cls: classRecord.errorResponse,
			},
			expected: Buffer.from([0b00_000001, 0b00010001]),
			methodName: "Binding",
			className: "error response",
		},
	] satisfies {
		arg: MsgType;
		expected: Buffer;
		methodName: string;
		className: string;
	}[])("encodes a $methodName $className message type", ({ arg, expected }) => {
		expect(encodeMsgType(arg)).toEqual(expected);
	});
});

describe("decodeMsgType", () => {
	test.each([
		[
			{
				arg: 0b000000_00000001,
				expected: { method: methodRecord.binding, cls: classRecord.request },
				methodName: "Binding",
				className: "request",
			},
			{
				arg: 0b000001_00000001,
				expected: {
					method: methodRecord.binding,
					cls: classRecord.successResponse,
				},
				methodName: "Binding",
				className: "success response",
			},
			{
				arg: 0b000001_00010001,
				expected: {
					method: methodRecord.binding,
					cls: classRecord.errorResponse,
				},
				methodName: "Binding",
				className: "error response",
			},
		],
	])(
		"decodes a $methodName $className message type",
		({ arg, expected, methodName, className }) => {
			expect(decodeMsgType(arg)).toEqual(expected);
		},
	);
	it("throws error if result is not a method", () => {
		const arg = 0x0000;
		expect(() => decodeMsgType(arg)).toThrowError(/not a method/);
	});
});

describe("decodeHeader", () => {
	it("throws error if STUN message header does not begin with 0b00", () => {
		const trxId = Buffer.from([
			0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
		]);
		const buf = Buffer.concat([
			Buffer.from([
				// STUN Message Type
				0b01_000000, // invalid first 2 bits
				0x01,
				0x00, // Message Length
				0x00,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x41,
			]),
			trxId,
		]);
		expect(() => decodeHeader(buf)).toThrowError(/first 2 bits must be zeros/);
	});
	it("throws error if STUN message header does not include valid magic cookie", () => {
		const trxId = Buffer.from([
			0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
		]);
		const buf = Buffer.concat([
			Buffer.from([
				0x00, // STUN Message Type
				0x01,
				0x10, // Message Length
				0x11,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x41,
			]),
			trxId,
		]);
		expect(() => decodeHeader(buf)).toThrowError(/invalid magic cookie/);
	});
	it("decodes STUN message header", () => {
		const trxId = Buffer.from([
			0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
		]);
		const buf = Buffer.concat([
			Buffer.from([
				0x00, // STUN Message Type
				0x01,
				0x10, // Message Length
				0x11,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x42,
			]),
			trxId,
		]);
		const res = decodeHeader(buf);
		expect(res).toEqual({
			cls: classRecord.request,
			method: methodRecord.binding,
			length: 0x1011,
			magicCookie: 0x2112a442,
			trxId,
		} satisfies Header);
	});
});
