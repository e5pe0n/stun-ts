import type { Override } from "./helpers.js";

const compReqRange = [0x0000, 0x7fff] as const;
const compOptRange = [0x8000, 0xffff] as const;

const compReqAttrTypeRecord = {
	mappedAddress: 0x0001,
	username: 0x0006,
	messageIntegrity: 0x0008,
	errorCode: 0x0009,
	unknownAttributes: 0x000a,
	realm: 0x0014,
	nonce: 0x0015,
	xorMappedAddress: 0x0020,
} as const;
type CompReqAttrType =
	(typeof compReqAttrTypeRecord)[keyof typeof compReqAttrTypeRecord];

function isCompReqAttrType(x: number): x is CompReqAttrType {
	return Object.values(compReqAttrTypeRecord).includes(x as CompReqAttrType);
}

const compOptAttrTypeRecord = {
	software: 0x8022,
	alternateServer: 0x8023,
	fingerprint: 0x8028,
} as const;
type CompOptAttrType =
	(typeof compOptAttrTypeRecord)[keyof typeof compOptAttrTypeRecord];

function isCompOptAttrType(x: number): x is CompOptAttrType {
	return Object.values(compOptAttrTypeRecord).includes(x as CompOptAttrType);
}

type AttrType = CompReqAttrType | CompOptAttrType;

function isAttrType(x: number): x is AttrType {
	return isCompReqAttrType(x) || isCompOptAttrType(x);
}

const addrFamilyRecord = {
	ipV4: 0x01,
	ipV6: 0x02,
} as const;
type AddrFamily = (typeof addrFamilyRecord)[keyof typeof addrFamilyRecord];

type MappedAddressAttr = {
	type: (typeof compReqAttrTypeRecord)["mappedAddress"];
	length: number;
	value: {
		family: AddrFamily;
		port: number;
		address: Uint8Array;
	};
};

type UsernameAttr = {
	type: (typeof compReqAttrTypeRecord)["username"];
	length: number;
	value: unknown;
};

type MessageIntegrityAttr = {
	type: (typeof compReqAttrTypeRecord)["messageIntegrity"];
	length: number;
	value: unknown;
};

type ErrorCodeAttr = {
	type: (typeof compReqAttrTypeRecord)["errorCode"];
	length: number;
	value: unknown;
};

type UnknownAttributesAttr = {
	type: (typeof compReqAttrTypeRecord)["unknownAttributes"];
	length: number;
	value: unknown;
};

type RealmAttr = {
	type: (typeof compReqAttrTypeRecord)["realm"];
	length: number;
	value: unknown;
};

type NonceAttr = {
	type: (typeof compReqAttrTypeRecord)["nonce"];
	length: number;
	value: unknown;
};

type XorMappedAddressAttr = {
	type: (typeof compReqAttrTypeRecord)["xorMappedAddress"];
	length: number;
	value: unknown;
};

type SoftwareAttr = {
	type: (typeof compOptAttrTypeRecord)["software"];
	length: number;
	value: unknown;
};

type AlternateServerAttr = {
	type: (typeof compOptAttrTypeRecord)["alternateServer"];
	length: number;
	value: unknown;
};

type FingerprintAttr = {
	type: (typeof compOptAttrTypeRecord)["fingerprint"];
	length: number;
	value: unknown;
};

type Attr =
	| MappedAddressAttr
	| UsernameAttr
	| MessageIntegrityAttr
	| ErrorCodeAttr
	| UnknownAttributesAttr
	| RealmAttr
	| NonceAttr
	| XorMappedAddressAttr
	| SoftwareAttr
	| AlternateServerAttr
	| FingerprintAttr;

export function readMappedAddressValue(
	buf: Buffer,
): MappedAddressAttr["value"] {}

export function readAttrs(buf: Buffer): Attr[] {
	const processingAttrs: Override<Attr, { value: Buffer }>[] = [];
	let bufLength = buf.length;
	while (bufLength > 0) {
		const attrType = buf.subarray(0, 2).readUint16BE();
		if (!isAttrType(attrType)) {
			throw new Error(`invalid attr type; ${attrType} is not a attr type.`);
		}
		const length = buf.subarray(2, 4).readUint16BE();
		const value = Buffer.alloc(length, buf.subarray(4, 4 + length));
		bufLength -= 4 + length;
		processingAttrs.push({ type: attrType, length, value });
	}
	const attrs: Attr[] = [];
	for (const { type, length, value } of processingAttrs) {
		switch (type) {
			case compReqAttrTypeRecord.mappedAddress: {
				const res = readMappedAddressValue(value);
				attrs.push({ type, length, value: res });
			}
		}
	}
	return attrs;
}