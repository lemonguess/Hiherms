// Hermes Bridge — Connects desktop pet to Hermes AI
//
// Supports two connection modes:
// 1. API Server (SSE streaming) — when apiServerUrl is configured
// 2. Local Hermes CLI — direct process spawn

import { EventEmitter } from 'events';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HermesRequest, HermesResponse, MediaAttachment, AppSettings, SessionSummary } from '../shared/types';

class ApiServerHttpError extends Error {
  statusCode: number;
  responseBody: string;
  requestUrl: string;
  requestPath: string;

  constructor(message: string, statusCode: number, responseBody: string, requestUrl: string, requestPath: string) {
    super(message);
    this.name = 'ApiServerHttpError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.requestUrl = requestUrl;
    this.requestPath = requestPath;
  }
}

export class HermesBridge extends EventEmitter {
  private currentSessionId: string | null = null;
  private ready: boolean = false;
  private settings: AppSettings | null = null;
  private localProc: ChildProcess | null = null;
  private localBuffer: string = '';
  private localResolve: ((value: HermesResponse) => void) | null = null;
  private localReject: ((reason: Error) => void) | null = null;
  private localTempFiles: string[] = [];
  private hasTriedLocalSessionRestore: boolean = false;

  constructor() {
    super();
    this.ready = true;
    this.emit('ready');
  }

  configure(settings: AppSettings): void {
    this.settings = settings;
    console.log('[Bridge] Configured mode:', settings.connectionMode, '| localHermesPath:', settings.localHermesPath || 'hermes');
    if (settings.connectionMode === 'local' && !this.currentSessionId) {
      void this.ensureLocalSessionRestored();
    }
  }

  async sendMessage(request: HermesRequest): Promise<HermesResponse> {
    if (!this.settings) {
      return { id: request.id, content: '', sessionId: '', error: 'Bridge not configured' };
    }

    try {
      if (this.settings.connectionMode === 'local') {
        return await this.sendViaLocalCli(request);
      } else {
        return await this.sendViaApiServerSse(request);
      }
    } catch (err: any) {
      return this.handleError(err, request.id);
    }
  }

  // === API Server Mode (SSE Streaming) ===
  private async sendViaApiServerSse(request: HermesRequest): Promise<HermesResponse> {
    const url = `${this.settings!.apiServerUrl}/v1/chat/completions`;

    const userContent: any[] = [];
    if (request.message) {
      userContent.push({ type: 'text', text: request.message });
    }
    if (request.media?.length) {
      for (const media of request.media) {
        if (media.type === 'image') {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${media.mimeType};base64,${media.data}` },
          });
        }
      }
    }

    const messagesArray: any[] = [];
    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        if (msg.role !== 'system') {
          messagesArray.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messagesArray.push({
      role: 'user',
      content: userContent.length === 1 && userContent[0].type === 'text'
        ? userContent[0].text
        : userContent,
    });

    const body: any = {
      model: 'hermes-agent',
      messages: messagesArray,
      stream: true,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.currentSessionId && this.settings!.apiServerKey) {
      headers['X-Hermes-Session-Id'] = this.currentSessionId;
    }
    if (this.settings!.apiServerKey) {
      headers['Authorization'] = `Bearer ${this.settings!.apiServerKey}`;
    }

    console.log('[Bridge] SSE POST', url);

    const content = await this.ssePost(url, body, headers, request.id);

    return {
      id: request.id,
      content,
      sessionId: this.currentSessionId || '',
    };
  }

  private ssePost(url: string, body: any, headers: Record<string, string>, requestId: string): Promise<string> {
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
        timeout: 300000,
      };

      const req = http.request(options, (res: any) => {
        let fullContent = '';
        let sessionId = '';

        res.on('data', (chunk: string) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.id) sessionId = parsed.id;

              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                this.emit('stream-chunk', { requestId, delta });
              }

              const toolProgress = parsed.choices?.[0]?.delta?.tool_calls?.[0];
              if (toolProgress) {
                this.emit('stream-chunk', { requestId, delta: `[Tool: ${toolProgress.function?.name || 'calling...'}] ` });
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        });

        res.on('end', () => {
          if (this.currentSessionId !== sessionId && sessionId) {
            this.currentSessionId = sessionId;
            this.emit('session', sessionId);
          }
          resolve(fullContent);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('SSE request timed out')); });
      req.write(bodyStr);
      req.end();
    });
  }

  // === Local Hermes CLI Mode ===
  private async sendViaLocalCli(request: HermesRequest): Promise<HermesResponse> {
    if (this.localProc) {
      this.killLocalProcess();
    }
    await this.ensureLocalSessionRestored();

    const hermesPath = this.settings!.localHermesPath || 'hermes';
    const args: string[] = [];
    const preparedInput = this.prepareLocalInput(request);

    // hermes CLI expects resume flag before subcommand: hermes --resume <id> chat -q "<msg>"
    if (this.currentSessionId) {
      args.push('--resume', this.currentSessionId);
    }
    // Use quiet mode to suppress banner/tools list and keep output parseable.
    args.push('chat', '-Q');
    // Hint runtime source as messaging bot platform instead of plain terminal chat.
    args.push('--source', 'qqbot');
    if (preparedInput.imagePath) {
      args.push('--image', preparedInput.imagePath);
    }
    args.push('-q', preparedInput.message);

    const safeArgs = args.map((arg, index) => (index === args.length - 1 ? '<prompt>' : arg));
    console.log('[Bridge] Local CLI:', hermesPath, safeArgs.join(' '));

    return new Promise((resolve, reject) => {
      this.localResolve = resolve;
      this.localReject = reject;
      this.localBuffer = '';

      this.localProc = spawn(hermesPath, args, {
        env: this.buildLocalEnv(),
      });

      let localStderr = '';

      this.localProc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        console.log('[Bridge][Local stdout chunk]:', this.previewText(chunk, 220));
        this.handleLocalOutput(chunk);
      });

      this.localProc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        localStderr += text;
        console.log('[Bridge][Local stderr chunk]:', this.previewText(text, 220));
        this.captureSessionIdFromText(text);
        if (text.includes('[Error]') || text.includes('ERROR')) {
          console.error('[Bridge] Hermes stderr:', text);
        }
      });

      this.localProc.on('error', (err) => {
        this.localReject?.(err);
        this.cleanupLocal();
      });

      this.localProc.on('close', (code) => {
        if (code !== 0 && this.localReject) {
          const detail = localStderr.trim() || `hermes exited with code ${code}`;
          this.localReject(new Error(detail));
          this.cleanupLocal();
          return;
        }
        if (this.localResolve) {
          const response = this.parseLocalOutput(this.localBuffer, request.id);
          console.log('[Bridge] Local raw output:', this.previewText(this.localBuffer, 1000));
          console.log('[Bridge] Local parsed response:', this.previewText(response.content || '', 500));
          this.localResolve(response);
        }
        this.cleanupLocal();
      });

      setTimeout(() => {
        if (this.localResolve) {
          this.localResolve({
            id: request.id,
            content: this.localBuffer,
            sessionId: this.currentSessionId || '',
            error: 'Local CLI timed out',
          });
        }
        this.killLocalProcess();
      }, 120000);
    });
  }

  private handleLocalOutput(text: string): void {
    this.localBuffer += text;
    this.captureSessionIdFromText(text);

    const mediaMatches = [...text.matchAll(/MEDIA:([^\s]+)/g)];
    for (const match of mediaMatches) {
      const mediaPath = match[1];
      console.log('[Bridge] Received MEDIA file:', mediaPath);
      this.emit('media-file', { path: mediaPath, requestId: '' });
    }

    const boxMatch = text.match(/╭─[^╮]*╮\n([\s\S]*?)\n╰─+╯/);
    if (boxMatch) {
      const content = boxMatch[1]
        .split('\n')
        .map((line: string) => line.replace(/^[│\s]*/, '').trimEnd())
        .join('')
        .trim();

      this.localResolve?.({
        id: 'local-stream',
        content,
        sessionId: this.currentSessionId || '',
      });
      this.cleanupLocal();
    }
  }

  private parseLocalOutput(buffer: string, requestId: string): HermesResponse {
    let cleaned = buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');

    const mediaFiles: string[] = [];
    const mediaMatches = [...cleaned.matchAll(/MEDIA:([^\s]+)/g)];
    for (const match of mediaMatches) {
      mediaFiles.push(match[1]);
    }
    const pathMatches = this.extractAbsolutePaths(cleaned);
    for (const p of pathMatches) {
      if (!mediaFiles.includes(p)) mediaFiles.push(p);
    }

    const mediaAttachments: MediaAttachment[] = mediaFiles.map((path) => ({
      type: 'file',
      data: path,
      mimeType: this.guessMimeType(path),
      filename: path.split('/').pop() || path,
    }));

    // In quiet mode output is plain text + optional Session line. Keep only answer body.
    let content = cleaned;
    content = content.replace(/^\s*Session:\s+[^\n]+\n?/gim, '').trim();
    content = content.replace(/\nResume this session with:.*$/s, '').trim();
    content = content.replace(/\n?⚠\s*\d+\s+commits\s+behind[\s\S]*$/im, '').trim();

    return {
      id: requestId,
      content,
      sessionId: this.currentSessionId || '',
      media: mediaAttachments.length > 0 ? mediaAttachments : undefined,
    };
  }

  private guessMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  private killLocalProcess(): void {
    if (this.localProc) {
      this.localProc.kill('SIGTERM');
      this.localProc = null;
    }
  }

  private cleanupLocal(): void {
    for (const temp of this.localTempFiles) {
      try {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      } catch (_) {}
    }
    this.localTempFiles = [];
    this.localProc = null;
    this.localBuffer = '';
    this.localResolve = null;
    this.localReject = null;
  }

  private prepareLocalInput(request: HermesRequest): { message: string; imagePath?: string } {
    const fromMedia = this.resolveImageFromMedia(request.media);
    if (fromMedia) {
      const userMessage = request.message?.trim() || '请分析这张图片。';
      const message = this.withLocalFileProtocol(userMessage);
      return { message, imagePath: fromMedia };
    }

    const inline = this.extractInlineImagePath(request.message || '');
    if (inline.imagePath) {
      const userMessage = inline.message || '请分析这张图片。';
      const message = this.withLocalFileProtocol(userMessage);
      return { message, imagePath: inline.imagePath };
    }

    return { message: this.withLocalFileProtocol(request.message) };
  }

  private resolveImageFromMedia(media?: MediaAttachment[]): string | undefined {
    if (!media?.length) return undefined;
    const firstImage = media.find((m) => m.type === 'image');
    if (!firstImage) return undefined;

    const ext = this.extFromMime(firstImage.mimeType);
    const tempPath = this.writeTempImage(firstImage.data, ext);
    return tempPath;
  }

  private extractInlineImagePath(message: string): { message: string; imagePath?: string } {
    const match = message.match(/(\/[^\s]+\.(png|jpg|jpeg|gif|webp|bmp))/i);
    if (!match) return { message };
    const imagePath = match[1];
    if (!fs.existsSync(imagePath)) return { message };
    const cleanedMessage = message.replace(imagePath, '').trim();
    return { message: cleanedMessage, imagePath };
  }

  private writeTempImage(base64: string, ext: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihermes-'));
    const tempPath = path.join(tempDir, `upload-${Date.now()}.${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(base64, 'base64'));
    this.localTempFiles.push(tempPath);
    return tempPath;
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
    };
    return map[mime] || 'png';
  }

  private previewText(text: string, maxLen: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen)}...`;
  }

  private withLocalFileProtocol(message: string): string {
    const contextOnly = [
      '【系统上下文】',
      '你当前运行在 QQ Bot 消息平台，不是 CLI 终端会话。',
      '平台支持发送图片/文件消息，请不要说“无法发送图片”或“当前是 CLI 无法发送”。',
    ].join('\n');
    return `${contextOnly}\n\n用户问题：${message}`;
  }

  async listSessions(limit = 20): Promise<SessionSummary[]> {
    if (!this.settings || this.settings.connectionMode !== 'local') {
      return [];
    }

    const hermesPath = this.settings.localHermesPath || 'hermes';
    const result = spawnSync(hermesPath, ['sessions', 'list', '--limit', String(limit)], {
      env: this.buildLocalEnv(),
      encoding: 'utf-8',
      timeout: 10000,
    });

    if (result.error) {
      console.error('[Bridge] sessions list error:', result.error.message);
      return [];
    }
    if (result.status !== 0) {
      console.error('[Bridge] sessions list failed:', this.previewText(result.stderr || '', 220));
      return [];
    }

    return this.parseSessionListText(result.stdout || '');
  }

  setSession(sessionId: string | null): void {
    this.currentSessionId = sessionId;
    this.emit('session', sessionId);
  }

  private extractAbsolutePaths(text: string): string[] {
    const found = new Set<string>();
    const regex = /(\/[^\n"'`]+?\.(png|jpg|jpeg|gif|webp|bmp|pdf|txt|md|mp3|wav|mp4))/gi;
    for (const match of text.matchAll(regex)) {
      const filePath = (match[1] || '').trim();
      if (!filePath) continue;
      if (fs.existsSync(filePath)) found.add(filePath);
    }
    return Array.from(found);
  }

  // === Error handling ===
  private handleError(err: any, requestId: string): HermesResponse {
    const isHttpError = err instanceof ApiServerHttpError;
    const details: Record<string, any> = {
      message: err?.message,
      sessionId: this.currentSessionId || '',
      mode: this.settings?.connectionMode || 'unknown',
    };

    if (isHttpError) {
      details.statusCode = err.statusCode;
      details.responseBodyPreview = err.responseBody.slice(0, 800);
    }

    console.error('[Bridge] Error:', details);

    let friendlyError = err.message;

    if (this.settings?.connectionMode === 'api_server') {
      if (isHttpError) {
        try {
          const parsed = JSON.parse(err.responseBody);
          if (parsed.error?.message) friendlyError = parsed.error.message;
        } catch (_) {}
      }

      if (friendlyError.includes('Insufficient Balance') || err.message.includes('402')) {
        friendlyError = `调用失败 (HTTP 402)：模型服务商余额不足，请检查您的 API Key 账号余额。`;
      } else if (friendlyError.includes('Session continuation requires API key authentication') || (err.message.includes('403') && !this.settings.apiServerKey)) {
        friendlyError = `会话续传失败 (HTTP 403)：连续对话需要填写您的专属 API Key。请在设置中补充 API Key。`;
      } else if (friendlyError.includes('401') || friendlyError.includes('unauthorized') || err.message.includes('401')) {
        friendlyError = `鉴权失败 (HTTP 401)：请检查设置中的 API Key 是否正确填写。`;
      } else if (err.message.includes('ECONNREFUSED')) {
        friendlyError = `连接失败：无法连接到 API Server (${this.settings.apiServerUrl})，请确保后端服务已启动。`;
      } else {
        friendlyError = `Hermes 连接失败 (API: ${friendlyError})`;
      }
    } else {
      if (err.code === 'ENOENT') {
        friendlyError = `找不到 hermes 命令：${this.settings?.localHermesPath || 'hermes'}。请确保 Hermes CLI 已安装并配置正确的路径。`;
      } else if (err.message.includes('timeout')) {
        friendlyError = `本地 Hermes 响应超时，请检查网络或重试。`;
      } else {
        friendlyError = `本地 Hermes 错误: ${friendlyError}`;
      }
    }

    return { id: requestId, content: '', sessionId: this.currentSessionId || '', error: friendlyError };
  }

  // === Session management ===
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  newSession(): void {
    if (this.localProc) {
      this.killLocalProcess();
    }
    this.currentSessionId = null;
    this.hasTriedLocalSessionRestore = true;
    this.emit('session', null);
  }

  destroy(): void {
    if (this.localProc) {
      this.killLocalProcess();
    }
    this.currentSessionId = null;
  }

  private buildLocalEnv(): NodeJS.ProcessEnv {
    const inheritedPath = process.env.PATH || '';
    const normalizedPath = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      `${process.env.HOME || ''}/.local/bin`,
      inheritedPath,
    ]
      .filter(Boolean)
      .join(':');

    return {
      ...process.env,
      HOME: process.env.HOME || '/root',
      TERM: 'dumb',
      PATH: normalizedPath,
    };
  }

  private async ensureLocalSessionRestored(): Promise<void> {
    if (this.currentSessionId || this.hasTriedLocalSessionRestore) return;
    if (!this.settings || this.settings.connectionMode !== 'local') return;
    this.hasTriedLocalSessionRestore = true;

    try {
      const recent = await this.listSessions(1);
      if (recent.length > 0) {
        this.currentSessionId = recent[0].id;
        this.emit('session', this.currentSessionId);
        console.log('[Bridge] Restored latest session:', this.currentSessionId);
      }
    } catch (err: any) {
      console.error('[Bridge] Restore latest session failed:', err?.message || err);
    }
  }

  private parseSessionListText(text: string): SessionSummary[] {
    const sessions: SessionSummary[] = [];
    const lines = text.split('\n').map((line) => line.trimRight());

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith('Title') || line.startsWith('─') || line.includes('No sessions found')) continue;
      const idMatch = line.match(/([0-9]{8}_[0-9]{6}_[a-z0-9]+)\s*$/i);
      if (!idMatch) continue;
      const id = idMatch[1];
      const beforeId = line.slice(0, idMatch.index).trimEnd();
      const titleCandidate = beforeId.split(/\s{2,}/)[0]?.trim() || '';
      const title = titleCandidate && titleCandidate !== '—' ? titleCandidate : `会话 ${id.slice(-8)}`;

      // Parse time from ID if possible (e.g. 20240501_123045_xxx)
      let timeStr = '';
      const timeMatch = id.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
      if (timeMatch) {
        timeStr = `${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]} ${timeMatch[4]}:${timeMatch[5]}:${timeMatch[6]}`;
      }

      sessions.push({ id, title, time: timeStr });
    }

    return sessions;
  }

  private captureSessionIdFromText(text: string): void {
    const patterns = [
      /session_id:\s*([a-zA-Z0-9_-]+)/i,
      /[Ss]ession:\s+([a-zA-Z0-9_-]+)/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] && match[1] !== this.currentSessionId) {
        this.currentSessionId = match[1];
        this.emit('session', this.currentSessionId);
        break;
      }
    }
  }
}
