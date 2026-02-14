export class AudioPlayerQueue {
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private onPlaybackComplete: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
  }

  async addChunk(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      console.error('[Audio] No audio context available');
      return;
    }

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log(`[Audio] Decoding ${bytes.length} bytes of audio data`);

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      console.log(`[Audio] Successfully decoded audio: ${audioBuffer.duration}s`);
      this.audioQueue.push(audioBuffer);

      // Start playing if not already
      if (!this.isPlaying) {
        this.playNext();
      }
    } catch (error) {
      console.error('[Audio] Failed to decode audio chunk:', error);
      console.error('[Audio] Base64 length:', base64Audio.length);
      // Continue despite error - don't break the call
    }
  }

  private playNext(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      if (this.onPlaybackComplete) {
        this.onPlaybackComplete();
      }
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.playNext();
    };

    this.currentSource = source;
    source.start(0);
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  }

  setOnPlaybackComplete(callback: () => void): void {
    this.onPlaybackComplete = callback;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
