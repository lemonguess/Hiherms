// Bridges the Electron app to Hermes Agent via child process
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HermesRequest, HermesResponse, MediaAttachment } from '../shared/types';

interface PendingRequest {
  resolve: (response: HermesResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class HermesBridge extends EventEmitter {
  private currentSessionId: string | null = null;
  private pending: Map<string, PendingRequest> = new Map();
  private tempDir: string;
  private ready: boolean = false;

  constructor() {
    super();
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-desktop-'));
    this.findHermesPath().then(() => {
      this.ready = true;
      this.emit('ready');
    });
  }

  private async findHermesPath(): Promise<string> {
    // Check common locations
    const candidates = [
      '/root/.local/bin/hermes',
      '/usr/local/bin/hermes',
      'hermes', // PATH lookup
    ];

    for (const cmd of candidates) {
      try {
        const result = await this.execCommand(`which ${cmd} 2>/dev/null || echo "${cmd}"`);
        const hermesPath = result.trim().split('\n')[0].trim();
        if (hermesPath && !hermesPath.includes('not found')) {
          // Verify it works
          try {
            await this.execCommand(`${hermesPath} --version 2>&1`);
            return hermesPath;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return 'hermes'; // fallback to PATH
  }

  private execCommand(command: string, timeout = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command], {
        env: { ...process.env, HOME: process.env.HOME || '/root' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out: ${command}`));
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || stdout.length > 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Exit code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async sendMessage(request: HermesRequest): Promise<HermesResponse> {
    if (!this.ready) {
      await new Promise<void>((resolve) => {
        if (this.ready) resolve();
        else this.once('ready', resolve);
      });
    }

    // Handle media attachments — save to temp files
    let mediaRefs = '';
    if (request.media && request.media.length > 0) {
      for (const media of request.media) {
        const mediaPath = await this.saveMedia(media);
        if (mediaPath) {
          mediaRefs += `[Attached file: ${mediaPath}]\n`;
        }
      }
    }

    const fullMessage = mediaRefs + request.message;

    // Build the hermes command
    const hermesPath = 'hermes'; // Will use PATH
    let command: string;

    if (this.currentSessionId) {
      // Resume existing session
      command = `${hermesPath} --resume ${this.currentSessionId} chat -Q -q ${this.escapeShell(fullMessage)}`;
    } else {
      // New session (use -Q for quiet mode: only session_id + response)
      command = `${hermesPath} chat -Q -q ${this.escapeShell(fullMessage)}`;
    }

    // Add personality if configured
    const personality = process.env.HERMES_PERSONALITY;
    if (personality) {
      command = `${hermesPath} -p ${personality} chat -q ${this.escapeShell(fullMessage)}`;
    }

    try {
      const output = await this.execCommand(command, 120000); // 2 min timeout

      // Parse the output to extract session ID and response
      const result = this.parseHermesOutput(output, request.id);

      // Update session ID for continuity
      if (result.sessionId) {
        this.currentSessionId = result.sessionId;
        this.emit('session', result.sessionId);
      }

      return result;
    } catch (error: any) {
      return {
        id: request.id,
        content: '',
        sessionId: this.currentSessionId || '',
        error: error.message || 'Unknown error communicating with Hermes',
      };
    }
  }

  private parseHermesOutput(output: string, requestId: string): HermesResponse {
    // Strip ANSI escape codes
    let cleaned = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    // Strip carriage returns
    cleaned = cleaned.replace(/\r/g, '');

    // Extract session ID first (before we strip other things)
    let sessionId = this.currentSessionId || '';
    const sessionMatch = cleaned.match(/[Ss]ession:\s+([a-zA-Z0-9_-]+)/);
    if (sessionMatch) {
      sessionId = sessionMatch[1];
    }
    if (!sessionId) {
      sessionId = `hds-${Date.now().toString(36)}`;
    }

    // Extract response content: content between Hermes box header and footer
    // Pattern: ╭─ ... Hermes ──...──╮ ... content ... ╰──...──╯
    const boxContentMatch = cleaned.match(/╭─[^╮]*Hermes[^╮]*╮\n([\s\S]*?)\n╰─+[^╯]*╯/);
    let content = '';

    if (boxContentMatch) {
      content = boxContentMatch[1]
        .split('\n')
        .map(line => line.replace(/^[│\s]*/, '').trimEnd())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
    } else {
      // Fallback: remove known noise lines
      const noisePatterns = [
        /^╭─+/,
        /^╰─+/,
        /^│\s*$/,
        /^│\s*Model:/,
        /^│\s*Session:/,
        /^│\s*Duration:/,
        /^│\s*Messages:/,
        /^│\s*to update/,
        /^Query:/,
        /^Initializing agent/,
        /^Resume this session/,
        /^─{10,}/,
        /^\s*$/,
      ];

      content = cleaned
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          if (trimmed.length === 0) return false;
          return !noisePatterns.some(p => p.test(trimmed));
        })
        .map(line => line.replace(/^[│\s]+/, '').trimEnd())
        .join('\n')
        .trim();
    }

    // Remove "Resume this session with:" line and following
    content = content.replace(/\nResume this session with:[\s\S]*$/, '').trim();

    return {
      id: requestId,
      content: content || '(no response)',
      sessionId,
    };
  }

  private async saveMedia(media: MediaAttachment): Promise<string | null> {
    try {
      const ext = this.getExtension(media.mimeType);
      const filename = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filepath = path.join(this.tempDir, filename);

      // Handle base64 data
      let buffer: Buffer;
      if (media.data.startsWith('data:')) {
        const base64Data = media.data.split(',')[1] || media.data;
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(media.data, 'base64');
      }

      fs.writeFileSync(filepath, buffer);
      return filepath;
    } catch (error) {
      console.error('Failed to save media:', error);
      return null;
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp3': 'mp3',
    };
    return map[mimeType] || 'bin';
  }

  private escapeShell(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  newSession(): void {
    this.currentSessionId = null;
    this.emit('session', null);
  }

  destroy(): void {
    this.pending.forEach((req) => {
      clearTimeout(req.timeout);
      req.reject(new Error('Bridge destroyed'));
    });
    this.pending.clear();

    // Cleanup temp files
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
