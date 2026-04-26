// Sherpa-ONNX Engine — Wake Word + Streaming ASR
// Audio input comes from external source (renderer process via getUserMedia)

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

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
  private silenceTimer: NodeJS.Timeout | null = null;
  private currentText: string = '';
  private modelReady: boolean = false;
  private lastWakeTime: number = 0;
  private recognitionStream: any = null;

  constructor(config: SherpaEngineConfig = {}) {
    super();
    this.config = {
      modelDir: config.modelDir || path.join(__dirname, '../../../model'),
      wakeWords: config.wakeWords || ['小赫'],
      silenceTimeout: config.silenceTimeout ?? 1.5,
    };
  }

  async start(): Promise<boolean> {
    console.log('[Sherpa] ===== Starting Sherpa Engine =====');
    console.log('[Sherpa] Model dir:', this.config.modelDir);
    console.log('[Sherpa] Wake words:', this.config.wakeWords);

    // Step 1: Load sherpa-onnx-node
    try {
      sherpa = require('sherpa-onnx-node');
      console.log('[Sherpa] ✅ sherpa-onnx-node loaded, version:', sherpa.version);
    } catch (err: any) {
      console.error('[Sherpa] ❌ Failed to load sherpa-onnx-node:', err.message);
      this.emit('warning', {
        message: 'Sherpa-ONNX 加载失败，语音输入不可用',
        detail: err.message,
      });
      return false;
    }

    // Step 2: Check model files
    const encoder = path.join(this.config.modelDir, 'encoder.onnx');
    const decoder = path.join(this.config.modelDir, 'decoder.onnx');
    const tokens = path.join(this.config.modelDir, 'tokens.txt');

    console.log('[Sherpa] Checking model files...');
    const missing: string[] = [];
    if (!fs.existsSync(encoder)) missing.push('encoder.onnx');
    if (!fs.existsSync(decoder)) missing.push('decoder.onnx');
    if (!fs.existsSync(tokens)) missing.push('tokens.txt');

    if (missing.length > 0) {
      const msg = `模型文件缺失: ${missing.join(', ')}。请运行: npm run download-model`;
      console.error('[Sherpa] ❌', msg);
      this.emit('warning', { message: msg });
      return false;
    }
    console.log('[Sherpa] ✅ All model files present');

    // Step 3: Initialize OnlineRecognizer
    try {
      console.log('[Sherpa] Initializing OnlineRecognizer...');
      this.recognizer = new sherpa.OnlineRecognizer({
        modelConfig: {
          paraformer: { encoder, decoder },
          tokens,
          numThreads: 2,
          provider: 'cpu',
        },
        enableEndpoint: 1,
        rule1MinTrailingSilence: this.config.silenceTimeout,
        rule2MinTrailingSilence: 2.0,
        rule3MinUtteranceLength: 20.0,
      });
      console.log('[Sherpa] ✅ OnlineRecognizer initialized');
    } catch (err: any) {
      console.error('[Sherpa] ❌ Failed to init recognizer:', err.message);
      this.emit('warning', {
        message: 'ASR 模型初始化失败',
        detail: err.message,
      });
      return false;
    }

    this.modelReady = true;
    this.emit('ready');
    console.log('[Sherpa] ✅ Engine ready, waiting for audio input...');
    console.log('[Sherpa] ===== Engine start complete =====');
    return true;
  }

  /**
   * Feed raw Int16 PCM audio buffer (16kHz, mono) to the recognizer.
   * Called from the main process, audio captured by renderer via getUserMedia.
   */
  feedAudio(buffer: Buffer): void {
    if (!this.recognizer || !this.modelReady) return;

    try {
      // Convert Int16 PCM → Float32
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
      const text = (result?.text || '').trim();

      if (!text) return;

      // === Wake word detection ===
      if (!this.active) {
        for (const word of this.config.wakeWords) {
          if (text.includes(word)) {
            const now = Date.now();
            if (now - this.lastWakeTime < 2000) return; // debounce
            this.lastWakeTime = now;
            this.active = true;
            console.log('[Sherpa] 🔔 WAKE:', word, '| text:', text);
            this.emit('wake', { word, timestamp: now });
            return;
          }
        }
      }

      // === Active ASR ===
      if (this.active) {
        const isFinal = this.recognizer.isEndpoint(stream);
        if (text !== this.currentText) {
          this.currentText = text;
          console.log('[Sherpa] 🎙️  ASR:', text, isFinal ? '(final)' : '');
        }
        this.emit('asr-result', { text, isFinal, timestamp: Date.now() });
        if (isFinal) {
          this.emit('asr-final', { text, timestamp: Date.now() });
        }
        this.resetSilenceTimer();
      }
    } catch {
      // Silently skip bad frames
    }
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.active) {
        const finalText = this.currentText.trim();
        if (finalText) {
          console.log('[Sherpa] 🏁 Utterance end:', finalText);
          this.emit('utterance-end', { text: finalText, timestamp: Date.now() });
        }
      }
      this.active = false;
      this.currentText = '';
      this.emit('sleep');
    }, this.config.silenceTimeout * 1000);
  }

  stop(): void {
    console.log('[Sherpa] Stopping engine...');
    this.active = false;
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    this.emit('stopped');
  }

  isActive(): boolean { return this.active; }
  setWakeWords(words: string[]): void { this.config.wakeWords = words; }
  getWakeWords(): string[] { return [...this.config.wakeWords]; }
}
