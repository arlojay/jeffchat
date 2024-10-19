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

    public static registerProgram(factory: ContactProgramFactory, options: ContactProgramOptions) {
        this.programs.add({factory, options});
    }

    
    protected runningPrograms: Map<ContactProgramEntry, ContactProgram> = new Map;

    constructor(contact: Contact) {
        super(contact);
    }

    private static async forEachProgram(callback: (program: ContactProgramEntry) => Promise<void>) {
        const promises = new Array;
        for(const program of MasterContactProgram.programs) {
            promises.push(callback(program));
        }

        await Promise.all(promises);
    }

    async stop() {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = this.runningPrograms.get(program);
            if(runningProgram != null) {
                this.runningPrograms.delete(program);
                await runningProgram.stop();
            }
        });
    }

    async init() {
        console.log("init");
        await MasterContactProgram.forEachProgram(async program => {
            if(program.options.startAt == "runtime") {
                const runningProgram = this.runningPrograms.get(program);
                if(runningProgram != null) {
                    this.runningPrograms.delete(program);
                    await runningProgram.stop();
                }

                const newRunningProgram = program.factory(this.contact);
                await newRunningProgram.init();
                this.runningPrograms.set(program, newRunningProgram);
            }
        });
    }

    async onConnected() {
        console.log(MasterContactProgram.programs);
        console.log(this.runningPrograms);
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = this.runningPrograms.get(program);

            if(program.options.startAt == "connection") {
                if(runningProgram != null) return;

                const newRunningProgram = program.factory(this.contact);
                this.runningPrograms.set(program, newRunningProgram);
                await newRunningProgram.init();
            } else {
                await runningProgram.onConnected();
            }
        });
    }

    async onDisconnected() {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = this.runningPrograms.get(program);

            if(program.options.stopAt == "disconnection") {
                if(runningProgram == null) return;

                this.runningPrograms.delete(program);
                await runningProgram.stop();
            } else {
                await runningProgram.onDisconnected();
            }
        });
    }

    async onData(data: PacketData) {
        await MasterContactProgram.forEachProgram(async program => {
            const runningProgram = this.runningPrograms.get(program);
            if(runningProgram != null) await runningProgram.onData(data);
        });
    }

    public getProgram(programType: typeof ContactProgram): InstanceType<typeof programType> {
        for(const program of this.runningPrograms.values()) {
            if(program instanceof programType) return program;
        }

        return null;
    }
}


// Register programs
import "./heartbeatProgram";
import "./chatProgram";