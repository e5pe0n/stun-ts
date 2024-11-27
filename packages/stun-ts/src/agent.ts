import { type Socket, createSocket } from "node:dgram";
import { type Socket as TcpSocket, createConnection } from "node:net";
import { assert, retry } from "@e5pe0n/lib";
import { magicCookie } from "./consts.js";
import { readMagicCookie } from "./header.js";
import type { Protocol, RawStunFmtMsg } from "./types.js";

export function assertRawStunFmtMsg(msg: Buffer): asserts msg is RawStunFmtMsg {
  assert(
    msg.length >= 20,
    new Error(
      `invalid stun msg; expected msg length is >= 20 bytes. actual length is ${msg.length}.`,
    ),
  );
  assert(
    msg.length % 4 === 0,
    new Error(
      `invalid stun msg; expected msg length is a multiple of 4 bytes. actual length is ${msg.length}.`,
    ),
  );
  const fstBits = msg[0]! >>> 6;
  assert(
    fstBits === 0,
    new Error(
      `invalid stun msg; expected the most significant 2 bits is 0b00. actual is ${fstBits.toString(2)}.`,
    ),
  );

  const stunMsg = msg as RawStunFmtMsg;
  const cookie = readMagicCookie(stunMsg);
  assert(
    cookie === magicCookie,
    new Error(
      `invalid stun msg; invalid magic cookie. actual is ${cookie.toString(16)}.`,
    ),
  );
}

export interface Agent {
  protocol: Protocol;
  config: UdpAgentConfig | TcpAgentConfig;
  close(): void;
  indicate(msg: RawStunFmtMsg): Promise<undefined>;
  request(msg: RawStunFmtMsg): Promise<RawStunFmtMsg>;
}

export interface IUdpAgent extends Agent {
  protocol: "udp";
  config: UdpAgentConfig;
}

export interface ITcpAgent extends Agent {
  protocol: "tcp";
  config: TcpAgentConfig;
}

export type UdpAgentInitConfig = {
  dest: {
    address: string;
    port: number;
  };
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export type UdpAgentConfig = Required<UdpAgentInitConfig>;

export class UdpAgent implements IUdpAgent {
  #config: UdpAgentConfig;
  #sock: Socket;
  #protocol = "udp" as const;

  constructor(config: UdpAgentInitConfig) {
    this.#config = {
      rtoMs: 3000,
      rc: 7,
      rm: 16,
      ...config,
    };
    this.#sock = createSocket("udp4");
    this.#sock.bind();
  }

  get protocol(): IUdpAgent["protocol"] {
    return this.#protocol;
  }

  get config(): UdpAgentConfig {
    return structuredClone(this.#config);
  }

  close(): void {
    this.#sock.close();
  }

  async indicate(msg: RawStunFmtMsg): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      this.#sock.send(
        msg,
        this.#config.dest.port,
        this.#config.dest.address,
        (err, bytes) => {
          if (err) {
            reject(err);
          }
          resolve();
        },
      );
    });
  }

  async request(msg: RawStunFmtMsg): Promise<RawStunFmtMsg> {
    const _res = new Promise<Buffer>((resolve, reject) => {
      this.#sock.on("message", (msg) => {
        resolve(msg);
      });
    });
    const _req = async (): Promise<void> =>
      new Promise((resolve, reject) => {
        this.#sock.send(
          msg,
          this.#config.dest.port,
          this.#config.dest.address,
          (err, bytes) => {
            reject(err);
          },
        );
      });

    const resBuf = (await Promise.race([
      retry(
        _req,
        this.#config.rc,
        (numAttempts: number) => this.#config.rtoMs * numAttempts,
        this.#config.rtoMs * this.#config.rm,
      ),
      _res,
    ])) as Buffer;
    assertRawStunFmtMsg(resBuf);
    return resBuf;
  }
}

export type TcpAgentInitConfig = {
  dest: {
    address: string;
    port: number;
  };
  tiMs?: number;
};

export type TcpAgentConfig = Required<TcpAgentInitConfig>;

export class TcpAgent implements ITcpAgent {
  #config: TcpAgentConfig;
  #protocol = "tcp" as const;
  #sock?: TcpSocket;

  constructor(config: TcpAgentInitConfig) {
    this.#config = {
      tiMs: 39_500,
      ...config,
    };
  }

  get protocol(): ITcpAgent["protocol"] {
    return this.#protocol;
  }

  get config(): TcpAgentConfig {
    return structuredClone(this.#config);
  }

  close(): void {
    this.#sock?.destroy();
  }

  async indicate(msg: RawStunFmtMsg): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      const sock = createConnection(
        this.#config.dest.port,
        this.#config.dest.address,
        () => {
          sock.write(msg);
          sock.end();
          resolve();
        },
      );
      sock.on("error", (err) => {
        sock.end();
        reject(err);
      });
      this.#sock = sock;
    });
    return;
  }

  async request(msg: RawStunFmtMsg): Promise<RawStunFmtMsg> {
    const resBuf = await new Promise<Buffer>((resolve, reject) => {
      const sock = createConnection(
        {
          port: this.#config.dest.port,
          host: this.#config.dest.address,
          timeout: this.#config.tiMs,
        },
        () => {
          sock.write(msg);
        },
      );
      sock.on("data", (data) => {
        sock.end();
        resolve(data);
      });
      sock.on("error", (err) => {
        sock.end();
        throw err;
      });
      sock.on("timeout", () => {
        sock.end();
        reject(new Error("reached timeout"));
      });
      this.#sock = sock;
    });
    assertRawStunFmtMsg(resBuf);
    return resBuf;
  }
}

export function createAgent(
  protocol: Protocol,
  config: UdpAgentInitConfig | TcpAgentInitConfig,
): IUdpAgent | ITcpAgent {
  switch (protocol) {
    case "tcp":
      return new TcpAgent(config);
    case "udp":
      return new UdpAgent(config);
    default:
      throw new Error(`invalid protocol: ${protocol} is not supported.`);
  }
}
