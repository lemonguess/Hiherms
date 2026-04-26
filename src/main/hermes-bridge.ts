// Hermes Bridge — Connects desktop pet to Hermes AI
//
// Primary: HTTP to Hermes API Server (/v1/chat/completions)

import { EventEmitter } from 'events';
import { HermesRequest, HermesResponse, MediaAttachment, AppSettings } from '../shared/types';

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
    try {
      return await this.sendViaApiServer(request);
    } catch (err: any) {
      const isHttpError = err instanceof ApiServerHttpError;
      const details: Record<string, any> = {
        message: err?.message,
        sessionId: this.currentSessionId || '',
        hasApiServerKey: !!this.apiServerKey,
      };
      if (isHttpError) {
        details.statusCode = err.statusCode;
        details.path = err.requestPath;
        details.url = err.requestUrl;
        details.responseBodyPreview = err.responseBody.slice(0, 800);
      }
      console.error('[Bridge] API Server failed:', details);

      let friendlyError = err.message;
      if (isHttpError) {
        try {
          const parsed = JSON.parse(err.responseBody);
          if (parsed.error && parsed.error.message) {
            friendlyError = parsed.error.message;
          }
        } catch (e) {
          // Keep original error message if JSON parsing fails
        }
      }

      if (friendlyError.includes('Insufficient Balance') || err.message.includes('402')) {
        friendlyError = `调用失败 (HTTP 402)：模型服务商余额不足，请检查您的 API Key 账号余额。`;
      } else if (friendlyError.includes('Session continuation requires API key authentication') || (err.message.includes('403') && !this.apiServerKey)) {
        friendlyError = `会话续传失败 (HTTP 403)：在当前 API Server 配置下，连续对话需要填写您的专属 API Key。请在设置中补充 API Key。`;
      } else if (friendlyError.includes('401') || friendlyError.includes('unauthorized') || err.message.includes('401')) {
        friendlyError = `鉴权失败 (HTTP 401)：请检查设置中的 API Key 是否正确填写。`;
      } else if (err.message.includes('ECONNREFUSED')) {
        friendlyError = `连接失败：无法连接到 API Server (${this.apiServerUrl})，请确保后端服务已启动。`;
      } else {
        friendlyError = `Hermes 连接失败 (API: ${friendlyError})`;
      }

      return {
        id: request.id,
        content: '',
        sessionId: this.currentSessionId || '',
        error: friendlyError,
      };
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

    const messagesArray: any[] = [];
    
    if (request.history && request.history.length > 0) {
      for (const msg of request.history) {
        if (msg.role !== 'system') {
          messagesArray.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    messagesArray.push({
      role: 'user',
      content: userContent.length === 1 && userContent[0].type === 'text'
        ? userContent[0].text   // Text-only: send as plain string
        : userContent,           // Multimodal: send as array
    });

    const body: any = {
      model: 'hermes-agent',
      messages: messagesArray,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only send Session ID if we have an API key, as Hermes Agent requires authentication for session continuation
    if (this.currentSessionId && this.apiServerKey) {
      headers['X-Hermes-Session-Id'] = this.currentSessionId;
    }
    if (this.apiServerKey) {
      headers['Authorization'] = `Bearer ${this.apiServerKey}`;
    }

    console.log('[Bridge] POST', url);
    console.log('[Bridge] Request summary', {
      messageId: request.id,
      messageLength: request.message?.length || 0,
      mediaCount: request.media?.length || 0,
      hasSessionHeader: !!this.currentSessionId,
      hasAuthHeader: !!this.apiServerKey,
    });

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
            reject(new ApiServerHttpError(
              `HTTP ${res.statusCode}: ${data.slice(0, 200)}`,
              res.statusCode,
              data,
              url,
              options.path
            ));
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
