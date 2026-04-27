import React, { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, TTS_VOICES } from '../../shared/types';

declare const window: any;

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.hermesAPI.getSettings().then((s: AppSettings) => setSettings(s));
  }, []);

  const update = (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
  };

  const saveSettings = () => {
    window.hermesAPI.setSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'Microsoft YaHei, sans-serif', color: '#e0e0e0', background: '#0d1117', height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#58a6ff' }}>⚙️ HiHermes 设置</h2>
        {saved && <span style={{ color: '#3fb950', fontSize: 13 }}>✓ 已保存</span>}
        {onClose && <button onClick={onClose} style={btnStyle}>✕</button>}
      </div>

      <Section title="🔗 Hermes 连接">
        <Label>连接方式</Label>
        <select value={settings.connectionMode} onChange={e => update({ connectionMode: e.target.value as 'api_server' | 'local' })} style={inputStyle}>
          <option value="api_server">API Server (填写 api_server 地址，走 SSE 流式)</option>
          <option value="local">本地 Hermes (直接调用本地 hermes CLI)</option>
        </select>

        {settings.connectionMode === 'api_server' && (
          <>
            <Label>服务器地址</Label>
            <input value={settings.apiServerUrl} onChange={e => update({ apiServerUrl: e.target.value })} style={inputStyle} placeholder="http://localhost:8642" />
            <Label>API Key (如果不需要鉴权可以留空)</Label>
            <input type="password" value={settings.apiServerKey} onChange={e => update({ apiServerKey: e.target.value })} style={inputStyle} placeholder="sk-..." />
          </>
        )}

        {settings.connectionMode === 'local' && (
          <>
            <Label>Hermes CLI 路径</Label>
            <input value={settings.localHermesPath} onChange={e => update({ localHermesPath: e.target.value })} style={inputStyle} placeholder="hermes 或 /usr/local/bin/hermes" />
            <div style={{ fontSize: 11, color: '#6e7681', marginTop: 6 }}>本地模式直接调用 hermes CLI，支持会话记忆和 MEDIA: 文件处理</div>
          </>
        )}
      </Section>

      <Section title="🎤 语音唤醒">
        <Label>唤醒词 (逗号分隔)</Label>
        <input value={settings.wakeWords.join(', ')} onChange={e => update({ wakeWords: e.target.value.split(',').map(w => w.trim()).filter(Boolean) })} style={inputStyle} />
        <Label>静默超时 (秒)</Label>
        <input type="number" min="0.5" max="5" step="0.1" value={settings.silenceTimeout} onChange={e => update({ silenceTimeout: parseFloat(e.target.value) || 1.5 })} style={{ ...inputStyle, width: 80 }} />
      </Section>

      <Section title="🔊 语音合成 (TTS)">
        <Label>语音</Label>
        <select value={settings.ttsVoice} onChange={e => update({ ttsVoice: e.target.value })} style={inputStyle}>
          {TTS_VOICES.map(v => (
            <option key={v.id} value={v.id}>{v.name} ({v.gender === 'female' ? '♀' : '♂'})</option>
          ))}
        </select>
        <Label>语速: {settings.ttsRate}</Label>
        <input type="range" min="-20" max="20" step="10" value={parseInt(settings.ttsRate)} onChange={e => update({ ttsRate: `${Number(e.target.value) > 0 ? '+' : ''}${e.target.value}%` })} style={{ width: '100%' }} />
        <Label>音量: {settings.ttsVolume}</Label>
        <input type="range" min="-50" max="50" step="10" value={parseInt(settings.ttsVolume)} onChange={e => update({ ttsVolume: `${Number(e.target.value) > 0 ? '+' : ''}${e.target.value}%` })} style={{ width: '100%' }} />
      </Section>

      <Section title="🖥️ 其他">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.autoStart} onChange={e => update({ autoStart: e.target.checked })} />
          开机自启
        </label>
      </Section>

      <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={saveSettings} 
          style={{ ...btnStyle, background: '#238636', borderColor: 'rgba(240,246,252,0.1)', padding: '8px 32px', fontSize: 15 }}
        >
          保存设置
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, padding: 16, background: '#161b22', borderRadius: 8, border: '1px solid #30363d' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#8b949e' }}>{title}</h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4, marginTop: 10 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', padding: '4px 12px', cursor: 'pointer', fontSize: 14,
};
