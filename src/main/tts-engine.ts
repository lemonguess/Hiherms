// TTS Streaming Engine — Edge TTS 句子级流式
// Hermes 回复 → 拆分句子 → 逐句 edge-tts 合成播放

import { exec, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface TTSOptions {
  voice?: string;       // edge-tts voice name
  rate?: string;        // speed: "+0%", "-10%", "+20%"
  pitch?: string;       // pitch: "+0Hz"
  volume?: string;      // volume: "+0%"
  tmpDir?: string;      // temp audio file directory
}

export class TTSEngine extends EventEmitter {
  private options: Required<TTSOptions>;
  private speaking: boolean = false;
  private queue: string[] = [];
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

  // Split text into sentences for streaming playback
  private splitSentences(text: string): string[] {
    // Split on Chinese/English punctuation but keep the punctuation
    const sentences: string[] = [];
    // Match: any chars followed by sentence-ending punctuation
    const parts = text.split(/(?<=[。！？；\n\.!\?;])/g);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
    }
    // If no split happened (no punctuation), treat whole text as one sentence
    if (sentences.length === 0 && text.trim().length > 0) {
      sentences.push(text.trim());
    }
    return sentences;
  }

  // Speak text with sentence-level streaming
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

  // Synthesize and play a single sentence
  private speakOne(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tmpFile = path.join(this.options.tmpDir, `tts-${Date.now()}.mp3`);

      // Escape double quotes and backticks for shell
      const escaped = text.replace(/"/g, '\\"').replace(/`/g, '\\`');

      const cmd = [
        'edge-tts',
        `--voice "${this.options.voice}"`,
        `--rate "${this.options.rate}"`,
        `--pitch "${this.options.pitch}"`,
        `--volume "${this.options.volume}"`,
        `--text "${escaped}"`,
        `--write-media "${tmpFile}"`,
      ].join(' ');

      const proc = exec(cmd, { timeout: 15000 }, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Play the audio file
        try {
          this.playAudioFile(tmpFile).then(() => {
            // Clean up temp file
            fs.unlink(tmpFile, () => {});
            resolve();
          }).catch(reject);
        } catch (playErr) {
          reject(playErr);
        }
      });

      this.currentProcess = proc;
    });
  }

  // Play audio file using system player
  private playAudioFile(filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try multiple players in order
      const players = [
        `ffplay -nodisp -autoexit -loglevel quiet "${filepath}"`,
        `mpg123 -q "${filepath}"`,
        `aplay "${filepath}"`,  // Linux
      ];

      const tryPlayer = (index: number) => {
        if (index >= players.length) {
          reject(new Error('No audio player available'));
          return;
        }

        const proc = exec(players[index], { timeout: 30000 }, (err) => {
          if (err && index < players.length - 1) {
            tryPlayer(index + 1);
          } else if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      };

      tryPlayer(0);
    });
  }

  // Check if currently speaking
  isSpeaking(): boolean {
    return this.speaking;
  }

  // Stop current speech
  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
    this.queue = [];
    this.speaking = false;
    this.emit('stop');
  }

  // Clean up temp files
  destroy(): void {
    this.stop();
    try {
      fs.rmSync(this.options.tmpDir, { recursive: true, force: true });
    } catch {}
  }
}
