// TTS Engine — Edge TTS sentence-level streaming
// Synthesizes via edge-tts CLI, plays via system audio player

import { exec, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface TTSOptions {
  voice?: string;       // edge-tts voice name
  rate?: string;        // "+0%", "-10%", "+20%"
  pitch?: string;       // "+0Hz"
  volume?: string;      // "+0%"
  tmpDir?: string;
}

const isWindows = process.platform === 'win32';

export class TTSEngine extends EventEmitter {
  private options: Required<TTSOptions>;
  private speaking: boolean = false;
  private currentProcess: ChildProcess | null = null;

  constructor(options: TTSOptions = {}) {
    super();
    this.options = {
      voice: options.voice || 'zh-CN-XiaoyiNeural',
      rate: options.rate || '+0%',
      pitch: options.pitch || '+0Hz',
      volume: options.volume || '+0%',
      tmpDir: options.tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'himers-tts-')),
    };
  }

  // Apply settings changes
  reconfigure(opts: Partial<TTSOptions>): void {
    if (opts.voice !== undefined) this.options.voice = opts.voice;
    if (opts.rate !== undefined) this.options.rate = opts.rate;
    if (opts.pitch !== undefined) this.options.pitch = opts.pitch;
    if (opts.volume !== undefined) this.options.volume = opts.volume;
  }

  private splitSentences(text: string): string[] {
    const sentences: string[] = [];
    const parts = text.split(/(?<=[。！？；\n\.!\?;])/g);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
    }
    if (sentences.length === 0 && text.trim().length > 0) {
      sentences.push(text.trim());
    }
    return sentences;
  }

  async speak(text: string): Promise<void> {
    if (!text || text.trim().length === 0) return;

    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return;

    this.speaking = true;
    this.emit('start', { text, sentenceCount: sentences.length });

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      this.emit('sentence-start', { index: i, total: sentences.length, text: sentence });

      try {
        await this.speakOne(sentence);
        this.emit('sentence-end', { index: i, total: sentences.length });
      } catch (err: any) {
        this.emit('error', { index: i, error: err.message, text: sentence });
      }
    }

    this.speaking = false;
    this.emit('end');
  }

  private speakOne(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tmpFile = path.join(this.options.tmpDir, `tts-${Date.now()}.mp3`);

      const escaped = text
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/[\u0000-\u001f]/g, '');  // strip control chars

      const cmd = [
        'edge-tts',
        `--voice "${this.options.voice}"`,
        `--rate "${this.options.rate}"`,
        `--pitch "${this.options.pitch}"`,
        `--volume "${this.options.volume}"`,
        `--text "${escaped}"`,
        `--write-media "${tmpFile}"`,
      ].join(' ');

      const proc = exec(cmd, { timeout: 15000, windowsHide: true }, (err) => {
        if (err) { reject(err); return; }
        this.playFile(tmpFile).then(() => {
          fs.unlink(tmpFile, () => {});
          resolve();
        }).catch(reject);
      });

      this.currentProcess = proc;
    });
  }

  // Cross-platform audio playback
  private playFile(filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let cmd: string;

      if (isWindows) {
        // Windows: PowerShell Media.SoundPlayer (sync, reliable)
        cmd = `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer '${filepath.replace(/'/g, "''")}').PlaySync()"`;
      } else {
        // Linux/macOS: try ffplay, fallback to mpg123, then aplay
        cmd = `ffplay -nodisp -autoexit -loglevel quiet "${filepath}" 2>/dev/null || mpg123 -q "${filepath}" 2>/dev/null || aplay "${filepath}" 2>/dev/null`;
      }

      const proc = exec(cmd, { timeout: 30000, windowsHide: true }, (err) => {
        if (err) reject(err);
        else resolve();
      });

      this.currentProcess = proc;
    });
  }

  isSpeaking(): boolean { return this.speaking; }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
    this.speaking = false;
    this.emit('stop');
  }

  destroy(): void {
    this.stop();
    try { fs.rmSync(this.options.tmpDir, { recursive: true, force: true }); } catch {}
  }
}
