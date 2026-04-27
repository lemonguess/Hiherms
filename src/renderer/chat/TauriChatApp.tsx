import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

type ChatMessage = { role: 'user' | 'assistant'; text: string };
type Settings = {
  api_server_url: string;
  api_server_key: string;
  wake_words: string[];
  tts_voice: string;
  tts_rate: string;
};

const TTS_VOICES = [
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (活泼女声)' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (温柔女声)' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (新闻男声)' },
  { id: 'zh-CN-YunjianNeural', name: '云健 (运动男声)' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰 (少女)' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵 (温柔)' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦 (活泼)' },
  { id: 'zh-CN-XiaoshuangNeural', name: '晓双 (可爱)' },
  { id: 'zh-CN-XiaoyouNeural', name: '晓悠 (童声)' },
  { id: 'zh-CN-YunfengNeural', name: '云枫 (温柔男)' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓 (明亮男)' },
  { id: 'zh-CN-YunzeNeural', name: '云泽 (深沉男)' },
];

export default function TauriChatApp() {
  const isSendingRef = useRef(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('就绪');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    api_server_url: 'http://localhost:8642',
    api_server_key: '',
    wake_words: ['小赫'],
    tts_voice: 'zh-CN-XiaoyiNeural',
    tts_rate: '+0%',
  });

  useEffect(() => {
    invoke<Settings>('get_settings').then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    let unlistenChunk: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;

    const setup = async () => {
      unlistenChunk = await listen<string>('agent-chunk', (event) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            copy[copy.length - 1] = { ...last, text: last.text + event.payload };
          } else {
            copy.push({ role: 'assistant', text: event.payload });
          }
          return copy;
        });
      });
      unlistenDone = await listen('agent-done', () => {
        isSendingRef.current = false;
        setStatus('完成');
      });
    };
    void setup();
    return () => { unlistenChunk?.(); unlistenDone?.(); };
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSendingRef.current) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setStatus('发送中...');
    isSendingRef.current = true;
    try {
      await invoke('connect_agent', { message: text });
    } catch (err: any) {
      isSendingRef.current = false;
      setStatus('失败');
      setMessages((prev) => [...prev, { role: 'assistant', text: `❌ ${err?.message || String(err)}` }]);
    }
  };

  const newSession = async () => {
    await invoke('new_session');
    setMessages([]);
    setStatus('新会话');
  };

  const updateSettings = async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    try { await invoke('set_settings', { partial: next }); } catch (e) { console.error(e); }
  };

  if (showSettings) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0d1117', color: '#e6edf3', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: 'auto' }}>
        <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, color: '#58a6ff', fontSize: 18 }}>⚙️ 设置</h2>
            <button onClick={() => setShowSettings(false)} style={{ ...btnStyle, padding: '6px 16px' }}>← 返回聊天</button>
          </div>

          <Section title="🔗 Hermes 连接">
            <Label>API Server 地址</Label>
            <input value={settings.api_server_url} onChange={e => updateSettings({ api_server_url: e.target.value })} style={inputStyle} />
          </Section>

          <Section title="🎤 语音">
            <Label>唤醒词 (逗号分隔)</Label>
            <input value={settings.wake_words.join(', ')} onChange={e => updateSettings({ wake_words: e.target.value.split(',').map(w => w.trim()).filter(Boolean) })} style={inputStyle} />
          </Section>

          <Section title="🔊 TTS">
            <Label>语音</Label>
            <select value={settings.tts_voice} onChange={e => updateSettings({ tts_voice: e.target.value })} style={inputStyle}>
              {TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <Label>{'语速: ' + settings.tts_rate}</Label>
            <input type="range" min="-20" max="20" step="10" value={parseInt(settings.tts_rate)} onChange={e => {
              const val = parseInt(e.target.value);
              updateSettings({ tts_rate: (val >= 0 ? '+' : '') + val + '%' });
            }} style={{ width: '100%' }} />
          </Section>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d1117', color: '#e6edf3', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>HiHermes</div>
          <div style={{ fontSize: 11, color: '#8b949e' }}>{status}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSettings(true)} style={headerBtn} title="设置">⚙️</button>
          <button onClick={newSession} style={headerBtn} title="新会话">🔄</button>
          <button onClick={() => void getCurrentWindow().close()} style={{ ...headerBtn, fontSize: 20 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'radial-gradient(circle at top, rgba(56,139,253,0.08), transparent 30%), #0d1117' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', maxWidth: 400, textAlign: 'center', color: '#8b949e', lineHeight: 1.8, fontSize: 14 }}>
            💬 和 Hermes 开始对话吧<br />
            <span style={{ fontSize: 12, opacity: 0.6 }}>连接: {settings.api_server_url}</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}`}
            style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '72%', background: msg.role === 'user' ? '#1f6feb' : '#161b22', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {msg.text}
          </div>
        ))}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0d1117', display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
          placeholder="输入消息..."
          style={{ flex: 1, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#161b22', color: '#e6edf3', padding: '12px 14px', outline: 'none', fontSize: 14 }} />
        <button onClick={() => void sendMessage()}
          style={{ border: 'none', borderRadius: 12, background: '#238636', color: '#fff', padding: '0 18px', cursor: 'pointer', fontSize: 14 }}>
          发送
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, padding: 16, background: '#161b22', borderRadius: 8, border: '1px solid #30363d' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#8b949e' }}>{title}</h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4, marginTop: 10 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' };
const headerBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: '#8b949e', fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 };
const btnStyle: React.CSSProperties = { background: '#21262d', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', cursor: 'pointer', fontSize: 13 };
