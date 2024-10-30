import { type Socket, createSocket } from "node:dgram";
import { addrFamilyRecord, compReqAttrTypeRecord } from "./attr.js";
import { classRecord, methodRecord } from "./header.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";
import type { Protocol } from "./types.js";
import { pAddr } from "./helpers.js";

export type ServerConfig = {
  protocol: Protocol;
};

export class Server {
  #protocol: Protocol;
  #sock: Socket;

  constructor(config: ServerConfig) {
    this.#protocol = config.protocol;
    this.#sock = createSocket("udp4");
    this.#sock.on("message", (msg, rinfo) => {
      const {
        header: { cls, method, trxId },
        attrs,
      } = decodeStunMsg(msg);
      let res: Buffer;
      switch (method) {
        case methodRecord.binding:
          res = encodeStunMsg({
            header: {
              cls: classRecord.successResponse,
              method: methodRecord.binding,
              trxId: trxId,
            },
            attrs: [
              {
                type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
                value: {
                  family:
                    rinfo.family === "IPv4"
                      ? addrFamilyRecord.ipV4
                      : addrFamilyRecord.ipV6,
                  addr: pAddr(rinfo.address),
                  port: rinfo.port,
                },
              },
            ],
          });
          break;
        default:
          throw new Error(`invalid method: ${method} is not supported.`);
      }
      this.#sock.send(res, rinfo.port, rinfo.address);
    });
  }

  listen(port: number) {
    this.#sock.bind(port);
  }

  close() {
    this.#sock.close();
  }
}
