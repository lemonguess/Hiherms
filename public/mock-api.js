// Mock hermesAPI for standalone web mode (no Electron)
// Provides a demo experience with simulated responses

(function() {
  if (window.hermesAPI) return; // Already have real API (Electron mode)

  console.log('🌐 Running in web mode — using mock API');

  let mockSessionId = 'web-' + Date.now().toString(36);
  const listeners = {};

  window.hermesAPI = {
    async sendMessage(request) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

      const msg = request.message || '';
      const hasImage = request.media && request.media.some(m => m.type === 'image');
      const hasVoice = request.media && request.media.some(m => m.type === 'audio');

      let response;
      if (hasVoice) {
        response = '🎤 语音消息已收到！在完整版中会通过 Whisper STT 转文字后交给 Hermes 处理。';
      } else if (hasImage) {
        response = '🖼️ 图片已收到！在完整版中会交给 Hermes 视觉模型分析图片内容。';
      } else if (msg.includes('Hello') || msg.includes('你好') || msg.includes('hi')) {
        response = '👋 你好！我是 Hermes Desktop 的演示模式。\n\n当前运行在纯 Web 环境下，Hermes AI 桥接暂未激活。\n\n完整版功能：\n• 🧠 接入 Hermes Agent 实时推理\n• 🎤 语音 → STT → AI 处理\n• 🖼️ 图片 → 视觉模型分析\n• 🔊 TTS 语音合成播报\n\n这是一个 UI 预览，所有交互逻辑已完备 ✨';
      } else if (msg.trim()) {
        response = `📝 收到消息：「${msg.slice(0, 80)}${msg.length > 80 ? '...' : ''}」\n\n这是 Hermes Desktop 的 Web 预览模式。完整版会通过 \`hermes chat -Q -q\` 连接真实 AI 进行推理。\n\nElectron 桌面版支持：\n• 会话持久化 (--resume)\n• 多模态输入 (文字/语音/图片)\n• 实时 TTS 语音播报`;
      } else {
        response = '请发送消息或上传图片/语音 👆';
      }

      return {
        id: request.id,
        content: response,
        sessionId: mockSessionId,
      };
    },

    async getSession() {
      return { sessionId: mockSessionId };
    },

    async newSession() {
      mockSessionId = 'web-' + Date.now().toString(36);
      return { success: true };
    },

    async listSessions() {
      return {
        sessions: [
          { id: mockSessionId, title: 'Web 预览会话', time: '2024-05-01 12:30:45' },
        ],
      };
    },

    async selectSession(sessionId) {
      mockSessionId = sessionId || mockSessionId;
      return { success: true };
    },

    onSessionUpdate(callback) {
      const id = 'session-' + Math.random().toString(36).slice(2, 8);
      listeners[id] = callback;
      return () => { delete listeners[id]; };
    },

    async openImageDialog() {
      // In web mode, we can't open native file dialog — rely on paste instead
      console.log('Image dialog not available in web mode — use paste (Ctrl+V)');
      return null;
    },
  };
})();
