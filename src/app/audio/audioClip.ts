import { AudioManager } from "./audioManager";


export class AudioClip {
    public buffer: AudioBuffer;
    private audioManager: AudioManager;

    constructor(buffer: AudioBuffer, audioManager: AudioManager) {
        this.buffer = buffer;
        this.audioManager = audioManager;
    }

    public async play() {
        const source = this.audioManager.context.createBufferSource();
        source.buffer = this.buffer;

        source.connect(this.audioManager.outputNode);

        source.start();

        return source;
    }
}