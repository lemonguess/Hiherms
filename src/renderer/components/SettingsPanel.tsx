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
    window.hermesAPI.setSettings(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'Microsoft YaHei, sans-serif', color: '#e0e0e0', background: '#0d1117', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#58a6ff' }}>⚙️ HiHermes 设置</h2>
        {saved && <span style={{ color: '#3fb950', fontSize: 13 }}>✓ 已保存</span>}
        {onClose && <button onClick={onClose} style={btnStyle}>✕</button>}
      </div>

      <Section title="🔗 Hermes 连接">
        <Label>后端模式</Label>
        <select value={settings.backend} onChange={e => update({ backend: e.target.value as any })} style={inputStyle}>
          <option value="api-server">🌐 API Server (HTTP)</option>
          <option value="wsl-cli">🐧 WSL CLI</option>
        </select>
        {settings.backend === 'api-server' && (
          <>
            <Label>服务器地址</Label>
            <input value={settings.apiServerUrl} onChange={e => update({ apiServerUrl: e.target.value })} style={inputStyle} placeholder="http://localhost:8642" />
            <Label>API Key (可选)</Label>
            <input type="password" value={settings.apiServerKey} onChange={e => update({ apiServerKey: e.target.value })} style={inputStyle} />
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
        <input type="range" min="-20" max="20" step="10" value={parseInt(settings.ttsRate)} onChange={e => update({ ttsRate: `${e.target.value > 0 ? '+' : ''}${e.target.value}%` })} style={{ width: '100%' }} />
        <Label>音量: {settings.ttsVolume}</Label>
        <input type="range" min="-50" max="50" step="10" value={parseInt(settings.ttsVolume)} onChange={e => update({ ttsVolume: `${e.target.value > 0 ? '+' : ''}${e.target.value}%` })} style={{ width: '100%' }} />
      </Section>

      <Section title="🖥️ 其他">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.autoStart} onChange={e => update({ autoStart: e.target.checked })} />
          开机自启
        </label>
      </Section>
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

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4, marginTop: 10 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', padding: '4px 12px', cursor: 'pointer', fontSize: 14,
};
