import { Contact } from "../contact";
import { PacketData } from "../secureConnection";
import { ContactProgram } from "./contactProgram";

export interface ContactProgramOptions {
    startAt: "runtime" | "connection";
    stopAt: "close" | "disconnection";
}
export type ContactProgramFactory = (contact: Contact) => ContactProgram;
export type ContactProgramEntry = { factory: ContactProgramFactory, options: ContactProgramOptions };

export class MasterContactProgram extends ContactProgram {
    protected static programs: Set<ContactProgramEntry> = new Set;
    protected static runningPrograms: Map<ContactProgramEntry, ContactProgram> = new Map;

    public static registerProgram(factory: ContactProgramFactory, options: ContactProgramOptions) {
        this.programs.add({factory, options});
    }

    private static async forEachProgram(callback: (program: ContactProgramEntry) => Promise<void>) {
        const promises = new Array;
        for(const program of MasterContactProgram.programs) {
            promises.push(callback(program));
        }

        await Promise.all(promises);
    }

    constructor(contact: Contact) {
        super(contact);
    }

    async stop() {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = MasterContactProgram.runningPrograms.get(program);
            if(runningProgram != null) {
                MasterContactProgram.runningPrograms.delete(program);
                await runningProgram.stop();
            }
        });
    }

    async init() {
        await MasterContactProgram.forEachProgram(async program => {
            if(program.options.startAt == "runtime") {
                const runningProgram = MasterContactProgram.runningPrograms.get(program);
                if(runningProgram != null) {
                    MasterContactProgram.runningPrograms.delete(program);
                    await runningProgram.stop();
                }

                const newRunningProgram = program.factory(this.contact);
                await newRunningProgram.init();
                MasterContactProgram.runningPrograms.set(program, newRunningProgram);
            }
        });
    }

    async onConnected() {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = MasterContactProgram.runningPrograms.get(program);

            if(program.options.startAt == "connection") {
                if(runningProgram != null) return;

                const newRunningProgram = program.factory(this.contact);
                MasterContactProgram.runningPrograms.set(program, newRunningProgram);
                await newRunningProgram.init();
            } else {
                await runningProgram.onConnected();
            }
        });
    }

    async onDisconnected() {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = MasterContactProgram.runningPrograms.get(program);

            if(program.options.stopAt == "disconnection") {
                if(runningProgram == null) return;

                MasterContactProgram.runningPrograms.delete(program);
                await runningProgram.stop();
            } else {
                await runningProgram.onDisconnected();
            }
        });
    }

    async onData(data: PacketData) {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = MasterContactProgram.runningPrograms.get(program);
            if(runningProgram != null) await runningProgram.onData(data);
        });
    }
}


// Register programs
import "./heartbeatProgram";