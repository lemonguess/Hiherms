// Sherpa-ONNX Engine — Wake Word + Streaming ASR (Windows native)
// Uses sherpa-onnx-node native addon. Model: streaming-paraformer-bilingual-zh-en

import { EventEmitter } from 'events';
import * as path from 'path';

let sherpa: any = null;

interface SherpaEngineConfig {
  modelDir?: string;
  wakeWords?: string[];
  silenceTimeout?: number;
}

export class SherpaEngine extends EventEmitter {
  private config: Required<SherpaEngineConfig>;
  private recognizer: any = null;
  private active: boolean = false;
  private micStream: any = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private currentText: string = '';
  private modelReady: boolean = false;

  constructor(config: SherpaEngineConfig = {}) {
    super();
    this.config = {
      modelDir: config.modelDir || path.join(__dirname, '../../../model'),
      wakeWords: config.wakeWords || ['小赫'],
      silenceTimeout: config.silenceTimeout ?? 1.2,
    };
  }

  async start(): Promise<void> {
    try {
      sherpa = require('sherpa-onnx-node');

      const encoder = path.join(this.config.modelDir, 'encoder.onnx');
      const decoder = path.join(this.config.modelDir, 'decoder.onnx');
      const joiner = path.join(this.config.modelDir, 'joiner.onnx');
      const tokens = path.join(this.config.modelDir, 'tokens.txt');
      const fs = require('fs');

      if (!fs.existsSync(encoder)) {
        console.warn('[Sherpa] Model not found. Run: npm run download-model');
        this.emit('warning', { message: 'ASR model not downloaded. Run "npm run download-model"' });
        return;
      }

      this.recognizer = new sherpa.OnlineRecognizer({
        modelConfig: {
          transducer: {
            encoder: encoder,
            decoder: decoder,
            joiner: joiner,
          },
          tokens: tokens,
          numThreads: 2,
          provider: 'cpu',
        },
        enableEndpoint: 1,
        rule1MinTrailingSilence: this.config.silenceTimeout,
        rule2MinTrailingSilence: 2.0,
        rule3MinUtteranceLength: 20.0,
      });

      this.modelReady = true;
      this.emit('ready');
      console.log('[Sherpa] Model loaded. Starting mic...');

      await this.startMicrophone();
    } catch (err: any) {
      console.warn('[Sherpa] Init failed:', err.message);
      this.emit('warning', {
        message: 'Sherpa-ONNX unavailable. Voice input disabled.',
        detail: err.message,
      });
    }
  }

  private async startMicrophone(): Promise<void> {
    try {
      let Mic: any;
      try { Mic = require('node-microphone'); } catch {
        console.warn('[Sherpa] node-microphone not installed. Run: npm install node-microphone');
        this.emit('warning', { message: 'Microphone library missing. Voice input disabled.' });
        return;
      }

      const mic = new Mic({ rate: 16000, channels: 1 });
      this.micStream = mic.startRecording();
      console.log('[Sherpa] Mic active @ 16kHz mono');

      this.micStream.on('data', (data: Buffer) => this.processAudio(data));
      this.micStream.on('error', (err: Error) => {
        console.error('[Sherpa] Mic error:', err.message);
        this.emit('error', err);
      });
    } catch (err: any) {
      console.warn('[Sherpa] Mic setup failed:', err.message);
    }
  }

  private processAudio(buffer: Buffer): void {
    if (!this.recognizer || !this.modelReady) return;

    try {
      const samples = new Float32Array(buffer.length / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
      }

      const stream = this.recognizer.createStream();
      stream.acceptWaveform({ samples, sampleRate: 16000 });

      while (this.recognizer.isReady(stream)) {
        this.recognizer.decode(stream);
      }

      const result = this.recognizer.getResult(stream);
      const text = result?.text || '';

      if (text && text !== this.currentText) {
        this.currentText = text;

        if (!this.active) {
          for (const word of this.config.wakeWords) {
            if (text.includes(word)) {
              this.active = true;
              this.emit('wake', { word, timestamp: Date.now() });
              break;
            }
          }
        }

        if (this.active) {
          const isFinal = this.recognizer.isEndpoint(stream);
          this.emit('asr-result', { text, isFinal, timestamp: Date.now() });
          if (isFinal) this.emit('asr-final', { text, timestamp: Date.now() });
          this.resetSilenceTimer();
        }
      }
    } catch {}
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.active && this.currentText.trim()) {
        this.emit('utterance-end', { text: this.currentText.trim(), timestamp: Date.now() });
      }
      this.active = false;
      this.currentText = '';
      this.emit('sleep');
    }, this.config.silenceTimeout * 1000);
  }

  stop(): void {
    if (this.micStream) { try { this.micStream.destroy?.(); } catch {} this.micStream = null; }
    this.active = false;
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    this.emit('stopped');
  }

  isActive(): boolean { return this.active; }
  setWakeWords(words: string[]): void { this.config.wakeWords = words; }
  getWakeWords(): string[] { return [...this.config.wakeWords]; }
}
