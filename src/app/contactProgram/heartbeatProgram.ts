import { PacketData } from "../secureConnection";
import { ContactProgram } from "./contactProgram";
import { MasterContactProgram } from "./masterContactProgram";

MasterContactProgram.registerProgram(
    contact => new HeartbeatProgram(contact),
    {
        startAt: "connection",
        stopAt: "disconnection"
    }
);

const HEARTBEAT_TIME = 5000;

export class HeartbeatProgram extends ContactProgram {
    private interval: NodeJS.Timeout;
    private lastHeartbeat: number;

    async init(): Promise<void> {
        this.interval = setInterval(() => {
            this.heartbeat();
        }, 500);
    }
    async stop(): Promise<void> {
        clearInterval(this.interval);
    }

    async onData(data: PacketData): Promise<void> {
        if(data.type == "heartbeat") {
            this.lastHeartbeat = performance.now();
        }
    }

    async heartbeat() {
        const connection = this.contact.getConnection();
        connection.send({
            type: "heartbeat",
            content: {
                data: Math.random()
            }
        });

        if(this.lastHeartbeat + HEARTBEAT_TIME < performance.now()) {
            this.contact.getConnection().close();
        }
    }
}