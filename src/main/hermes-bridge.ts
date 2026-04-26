// Hermes Bridge — Connects desktop pet to Hermes AI
//
// Primary: HTTP to Hermes API Server (/v1/chat/completions)
// Fallback: WSL CLI (wsl hermes chat -Q -q)

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { HermesRequest, HermesResponse, MediaAttachment, AppSettings, HermesBackend } from '../shared/types';

export class HermesBridge extends EventEmitter {
  private currentSessionId: string | null = null;
  private ready: boolean = false;
  private apiServerUrl: string = 'http://localhost:8642';
  private apiServerKey: string = '';

  constructor() {
    super();
    // Bridge is ready immediately — backend is chosen per-request
    this.ready = true;
    this.emit('ready');
  }

  // Called when settings change
  configure(settings: AppSettings): void {
    this.apiServerUrl = settings.apiServerUrl || 'http://localhost:8642';
    this.apiServerKey = settings.apiServerKey || '';
  }

  // === Main send interface ===
  async sendMessage(request: HermesRequest): Promise<HermesResponse> {
    // Always try API Server first; fallback to WSL if unreachable
    try {
      return await this.sendViaApiServer(request);
    } catch (err: any) {
      console.warn('[Bridge] API Server failed, trying WSL:', err.message);
      try {
        return await this.sendViaWsl(request);
      } catch (wslErr: any) {
        return {
          id: request.id,
          content: '',
          sessionId: this.currentSessionId || '',
          error: `Hermes 连接失败 (API: ${err.message}, WSL: ${wslErr.message})`,
        };
      }
    }
  }

  // === API Server Mode (HTTP) ===
  private async sendViaApiServer(request: HermesRequest): Promise<HermesResponse> {
    const url = `${this.apiServerUrl}/v1/chat/completions`;

    // Build messages in OpenAI format
    const userContent: any[] = [];
    if (request.message) {
      userContent.push({ type: 'text', text: request.message });
    }
    if (request.media?.length) {
      for (const media of request.media) {
        if (media.type === 'image') {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${media.mimeType};base64,${media.data}`,
            },
          });
        }
      }
    }

    const body: any = {
      model: 'hermes-agent',
      messages: [{
        role: 'user',
        content: userContent.length === 1 && userContent[0].type === 'text'
          ? userContent[0].text   // Text-only: send as plain string
          : userContent,           // Multimodal: send as array
      }],
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.currentSessionId) {
      headers['X-Hermes-Session-Id'] = this.currentSessionId;
    }
    if (this.apiServerKey) {
      headers['Authorization'] = `Bearer ${this.apiServerKey}`;
    }

    console.log('[Bridge] POST', url);

    const res = await this.httpPost(url, body, headers);
    const data = JSON.parse(res);

    if (data.error) {
      throw new Error(data.error.message || 'API Server error');
    }

    // Extract content from OpenAI-format response
    const content = data.choices?.[0]?.message?.content || '';
    const sessionId = data.id || this.currentSessionId || '';

    if (sessionId) this.currentSessionId = sessionId;

    return {
      id: request.id,
      content,
      sessionId,
    };
  }

  // === WSL CLI Mode (fallback) ===
  private async sendViaWsl(request: HermesRequest): Promise<HermesResponse> {
    const escaped = this.escapeShell(request.message);
    let cmd: string;

    if (this.currentSessionId) {
      cmd = `hermes --resume ${this.currentSessionId} chat -Q -q ${escaped}`;
    } else {
      cmd = `hermes chat -Q -q ${escaped}`;
    }

    const output = await this.execWsl(cmd);
    const result = this.parseCliOutput(output, request.id);
    if (result.sessionId) this.currentSessionId = result.sessionId;
    return result;
  }

  // === HTTP helpers ===
  private httpPost(url: string, body: any, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const http = url.startsWith('https') ? require('https') : require('http');
      const urlObj = new URL(url);
      const bodyStr = JSON.stringify(body);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: 120000, // 2 min
      };

      const req = http.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.write(bodyStr);
      req.end();
    });
  }

  // === WSL helpers ===
  private execWsl(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn('wsl.exe', ['bash', '-c', command], {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('WSL command timed out'));
      }, 120000);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || stdout.length > 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `WSL exit code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // Remove ANSI codes, box-drawing, noise from CLI output
  private parseCliOutput(output: string, requestId: string): HermesResponse {
    let cleaned = output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\r/g, '');

    let sessionId = this.currentSessionId || '';
    const sm = cleaned.match(/[Ss]ession:\s+([a-zA-Z0-9_-]+)/);
    if (sm) sessionId = sm[1];

    // Extract content between Hermes box lines
    const boxMatch = cleaned.match(/╭─[^╮]*╮\n([\s\S]*?)\n╰─+[^╯]*╯/);
    let content = '';
    if (boxMatch) {
      content = boxMatch[1]
        .split('\n')
        .map(l => l.replace(/^[│\s]*/, '').trimEnd())
        .filter(l => l.length > 0)
        .join('\n')
        .trim();
    } else {
      // Fallback: strip noise
      const noise = [/^╭─+/, /^╰─+/, /^│\s*$/, /^│\s*(Model|Session|Duration|Messages):/, /^─{10,}/, /^\s*$/];
      content = cleaned.split('\n')
        .filter(l => !noise.some(p => p.test(l.trim())))
        .join('\n').trim();
    }

    return { id: requestId, content: content || '(no response)', sessionId };
  }

  private escapeShell(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }

  // === Session management ===
  getSessionId(): string | null { return this.currentSessionId; }

  newSession(): void {
    this.currentSessionId = null;
    this.emit('session', null);
  }

  destroy(): void {
    this.currentSessionId = null;
  }
}
