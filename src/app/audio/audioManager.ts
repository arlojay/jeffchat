import { AudioClip } from "./audioClip";

export class AudioManager {
    public outputNode: AudioNode;
    public context: AudioContext;
    private audioClips: Map<string, AudioClip> = new Map;

    constructor(context: AudioContext) {
        this.context = context;
        this.outputNode = context.createGain();

        this.outputNode.connect(context.destination);
        console.log(context);
    }

    private async loadAudioClipFromBuffer(data: ArrayBuffer) {
        const buffer = await this.context.decodeAudioData(data);
        
        const clip = new AudioClip(buffer, this);

        return clip;
    }

    public async createAudioClip(id: string, source: string | ArrayBuffer) {
        const data = (source instanceof ArrayBuffer)
            ? source
            : await fetch(source).then(v => v.arrayBuffer());

        const clip = await this.loadAudioClipFromBuffer(data);
        this.audioClips.set(id, clip);

        return clip;
    }

    public getAudioClip(id: string) {
        return this.audioClips.get(id);
    }
}