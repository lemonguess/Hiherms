import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, LogicalSize, LogicalPosition, primaryMonitor } from '@tauri-apps/api/window';

Live2DModel.registerTicker(PIXI.Ticker);

const PET_WINDOW_WIDTH = 380;
const PET_WINDOW_HEIGHT = 560;
const PET_WINDOW_MARGIN = 12;
const IDLE_RESET_MS = 2000;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_ITEM_HEIGHT = 36;

type ContextMenuState = { visible: boolean; x: number; y: number };
type Settings = {
  api_server_url: string;
  api_server_key: string;
  wake_words: string[];
  tts_voice: string;
  tts_rate: string;
};

const TTS_VOICES = [
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (活泼)' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (温柔)' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (新闻)' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰 (少女)' },
];

function getL2DParam(model: Live2DModel, id: string): number {
  try {
    return (model.internalModel as any).coreModel.getParameterValueById(id) as number;
  } catch { return 0; }
}

function setL2DParam(model: Live2DModel, id: string, value: number, weight?: number) {
  try {
    (model.internalModel as any).coreModel.setParameterValueById(id, value, weight ?? 1);
  } catch {}
}

// Character zone: covers where the model actually renders on screen.
// Model is positioned at center-bottom, filling 88% of window height.
const CHAR_ZONE_LEFT = '12%';
const CHAR_ZONE_RIGHT = '12%';
const CHAR_ZONE_BOTTOM = '2%';
const CHAR_ZONE_HEIGHT = '82%';

export default function PetApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const charZoneRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const isSendingRef = useRef(false);
  const windowPosRef = useRef({ x: 0, y: 0 });
  const idleTimerRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0, eyeX: 0, eyeY: 0 });
  const faceTargetRef = useRef({ cheek: 0, mouthOpen: 0, mouthForm: 0, eyeOpen: 1 });
  const exprActiveRef = useRef(false);
  const exprTimerRef = useRef<number>(0);
  const openingChatRef = useRef(false);

  const [statusText, setStatusText] = useState('');
  const [bubbleText, setBubbleText] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [settings, setSettings] = useState<Settings>({
    api_server_url: 'http://localhost:8642',
    api_server_key: '',
    wake_words: ['小赫', 'AI助手', '2B'],
    tts_voice: 'zh-CN-XiaoyiNeural',
    tts_rate: '+0%',
  });
  const [editingServer, setEditingServer] = useState(false);
  const [editingWake, setEditingWake] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState('');
  const [tempWakeWords, setTempWakeWords] = useState('');

  useEffect(() => {
    invoke<Settings>('get_settings').then(setSettings).catch(console.error);
  }, []);

  const updateSettings = async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    try { await invoke('set_settings', { partial: next }); } catch (e) { console.error(e); }
  };

  const placePetWindowBottomRight = async () => {
    try {
      const currentWindow = getCurrentWindow();
      const monitor = await primaryMonitor();
      if (!monitor) return;
      const sf = monitor.scaleFactor || 1;
      const wa = monitor.workArea;

      const logicalRight = (wa.position.x + wa.size.width) / sf;
      const logicalBottom = (wa.position.y + wa.size.height) / sf;
      const logicalX = logicalRight - PET_WINDOW_WIDTH - PET_WINDOW_MARGIN;
      const logicalY = logicalBottom - PET_WINDOW_HEIGHT - PET_WINDOW_MARGIN;

      await currentWindow.setPosition(new LogicalPosition(Math.round(logicalX), Math.round(logicalY)));

      const pos = await currentWindow.outerPosition();
      windowPosRef.current = { x: pos.x, y: pos.y };
    } catch (err) { console.error('placePetWindowBottomRight error:', err); }
  };

  const positionModel = (app: PIXI.Application, model: Live2DModel) => {
    const bounds = model.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const targetHeight = window.innerHeight * 0.88;
    const scale = targetHeight / bounds.height;
    model.scale.set(scale);
    model.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height);
    model.position.set(window.innerWidth / 2, window.innerHeight - 4);
  };

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    // Native window drag — works at any mouse speed, OS-level.
    // Character zone is no-drag, so clicks/dblclick/right-click work there.
    document.body.style.webkitAppRegion = 'drag';
    invoke('set_ignore_cursor_events', { ignore: false }).catch(console.error);

    const layoutPetWindow = async () => {
      try {
        const currentWindow = getCurrentWindow();
        await currentWindow.setDecorations(false);
        await currentWindow.setShadow(false);
        await currentWindow.setResizable(false);
        await currentWindow.setAlwaysOnTop(true);
        await currentWindow.setSkipTaskbar(true);
        await currentWindow.setSize(new LogicalSize(PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT));
        await currentWindow.setMinSize(new LogicalSize(PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT));
        await currentWindow.setMaxSize(new LogicalSize(PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT));
        await placePetWindowBottomRight();
      } catch (err) { console.error('layoutPetWindow error:', err); }
    };
    void layoutPetWindow();

    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
      document.body.style.webkitAppRegion = '';
    };
  }, []);

  useEffect(() => {
    let unlistenChunk: () => void;
    let unlistenDone: () => void;
    const setup = async () => {
      unlistenChunk = await listen<string>('agent-chunk', (event) => {
        setBubbleText((prev) => prev + event.payload);
      });
      unlistenDone = await listen('agent-done', () => {
        isSendingRef.current = false;
        setStatusText('对话结束');
        setTimeout(() => setBubbleText(''), 4000);
      });
    };
    setup();
    return () => { unlistenChunk?.(); unlistenDone?.(); };
  }, []);

  useEffect(() => {
    let pixiApp: PIXI.Application;
    const initPixi = async () => {
      const app = new PIXI.Application({
        width: window.innerWidth, height: window.innerHeight,
        backgroundAlpha: 0, resolution: window.devicePixelRatio || 1,
        autoDensity: true, forceCanvas: false, antialias: true, powerPreference: 'high-performance',
      });
      pixiApp = app;
      if (containerRef.current) {
        containerRef.current.appendChild(pixiApp.view as any);
        (pixiApp.view as HTMLCanvasElement).style.position = 'absolute';
        (pixiApp.view as HTMLCanvasElement).style.inset = '0';
        (pixiApp.view as HTMLCanvasElement).style.zIndex = '1';
        (pixiApp.view as HTMLCanvasElement).style.pointerEvents = 'none';
      }
      appRef.current = pixiApp;

      try {
        const model = await Live2DModel.from('/live2d/kei/kei_basic_free.model3.json');
        modelRef.current = model;
        model.visible = true; model.alpha = 1;
        if (pixiApp.stage) pixiApp.stage.addChild(model);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        positionModel(pixiApp, model);
        console.log('[Pet] Live2D loaded OK');
      } catch (err: any) {
        setStatusText(`Live2D Error: ${err.message}`);
        console.error('Live2D error:', err);
      }
    };
    initPixi();

    const handleResize = () => {
      if (pixiApp?.renderer) {
        pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
        if (modelRef.current) positionModel(pixiApp, modelRef.current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (appRef.current) appRef.current.destroy(true, { children: true });
    };
  }, []);

  const openChatWindow = async () => {
    // Guard against double-calls (both React onDoubleClick and native dblclick)
    if (openingChatRef.current) return;
    openingChatRef.current = true;

    setContextMenu((p) => ({ ...p, visible: false }));
    try {
      const existing = await WebviewWindow.getByLabel('chat');
      if (existing) {
        await existing.show();
        await existing.setFocus();
        openingChatRef.current = false;
        return;
      }
      const chatWindow = new WebviewWindow('chat', {
        url: new URL('/?mode=chat', window.location.href).toString(),
        title: 'HiHermes Chat', center: true, width: 920, height: 680,
        minWidth: 760, minHeight: 560, resizable: true, focus: true,
      });
      chatWindow.once('tauri://error', (e) => {
        console.error('Failed to create chat window:', String(e));
        setStatusText('打开聊天窗口失败');
        setTimeout(() => setStatusText(''), 2200);
      });
      // Wait briefly for window to register, then release guard
      setTimeout(() => { openingChatRef.current = false; }, 500);
    } catch (err) {
      console.error('Failed to open chat:', err);
      setStatusText('打开聊天窗口失败');
      setTimeout(() => setStatusText(''), 2200);
      openingChatRef.current = false;
    }
  };

  const triggerPoke = useCallback(() => {
    console.log('[Pet] POKE!');
    exprActiveRef.current = true;
    // Eyes rolled up + mouth open + half-closed eyes — using params
    // confirmed to exist on the kei model (eye tracking already works)
    targetRef.current = { x: 0, y: 0, eyeX: 0, eyeY: -1 };
    faceTargetRef.current = { cheek: 0, mouthOpen: 0.7, mouthForm: 0, eyeOpen: 0.3 };
    if (exprTimerRef.current) clearTimeout(exprTimerRef.current);
    exprTimerRef.current = window.setTimeout(() => {
      console.log('[Pet] Poke reset');
      exprActiveRef.current = false;
      targetRef.current = { x: 0, y: 0, eyeX: 0, eyeY: 0 };
      faceTargetRef.current = { cheek: 0, mouthOpen: 0, mouthForm: 0, eyeOpen: 1 };
    }, 2500);
  }, []);

  const handleDoubleClick = useCallback(() => {
    void openChatWindow();
    triggerPoke();
  }, [triggerPoke]);

  // === Character zone mouse events ===
  // Body is drag-region (native OS drag, never loses events).
  // Character zone is no-drag → all interaction happens here.
  // mouseleave fires when mouse leaves the character area → snap head.
  useEffect(() => {
    const zone = charZoneRef.current;
    if (!zone) return;
    console.log('[Pet] Character zone mouse events setup');

    let raf = 0;
    const tick = () => {
      const model = modelRef.current;
      if (!model) { raf = requestAnimationFrame(tick); return; }

      if (exprActiveRef.current) {
        // Poke expression — force-set all params (no lerp)
        setL2DParam(model, 'ParamAngleX', targetRef.current.x, 1);
        setL2DParam(model, 'ParamAngleY', targetRef.current.y, 1);
        setL2DParam(model, 'ParamEyeBallX', targetRef.current.eyeX, 1);
        setL2DParam(model, 'ParamEyeBallY', targetRef.current.eyeY, 1);
        setL2DParam(model, 'ParamMouthOpenY', faceTargetRef.current.mouthOpen, 1);
        setL2DParam(model, 'ParamEyeLOpen', faceTargetRef.current.eyeOpen, 1);
        setL2DParam(model, 'ParamEyeROpen', faceTargetRef.current.eyeOpen, 1);
      } else {
        // Smooth head/eye tracking
        const t = targetRef.current;
        const f = faceTargetRef.current;
        const s = 0.06;
        setL2DParam(model, 'ParamAngleX', getL2DParam(model, 'ParamAngleX') + (t.x - getL2DParam(model, 'ParamAngleX')) * s);
        setL2DParam(model, 'ParamAngleY', getL2DParam(model, 'ParamAngleY') + (t.y - getL2DParam(model, 'ParamAngleY')) * s);
        setL2DParam(model, 'ParamEyeBallX', getL2DParam(model, 'ParamEyeBallX') + (t.eyeX - getL2DParam(model, 'ParamEyeBallX')) * s);
        setL2DParam(model, 'ParamEyeBallY', getL2DParam(model, 'ParamEyeBallY') + (t.eyeY - getL2DParam(model, 'ParamEyeBallY')) * s);
        setL2DParam(model, 'ParamMouthOpenY', getL2DParam(model, 'ParamMouthOpenY') + (f.mouthOpen - getL2DParam(model, 'ParamMouthOpenY')) * 0.08);
        setL2DParam(model, 'ParamEyeLOpen', getL2DParam(model, 'ParamEyeLOpen') + (f.eyeOpen - getL2DParam(model, 'ParamEyeLOpen')) * 0.08);
        setL2DParam(model, 'ParamEyeROpen', getL2DParam(model, 'ParamEyeROpen') + (f.eyeOpen - getL2DParam(model, 'ParamEyeROpen')) * 0.08);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Head tracking: map mouse within zone to [-1, 1] range
    const onMouseMove = (e: MouseEvent) => {
      if (exprActiveRef.current) return;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      const rect = zone.getBoundingClientRect();
      const fx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const fy = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRef.current = { x: fx * 15, y: fy * 8, eyeX: fx * 0.6, eyeY: fy * 0.5 };
    };

    // Mouse leaves character zone → SNAP head to center immediately
    const onMouseLeave = () => {
      if (exprActiveRef.current) return;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      targetRef.current = { x: 0, y: 0, eyeX: 0, eyeY: 0 };
      faceTargetRef.current = { cheek: 0, mouthOpen: 0, mouthForm: 0, eyeOpen: 1 };
      // Snap immediately — no lerp
      const model = modelRef.current;
      if (model) {
        setL2DParam(model, 'ParamAngleX', 0, 1);
        setL2DParam(model, 'ParamAngleY', 0, 1);
        setL2DParam(model, 'ParamEyeBallX', 0, 1);
        setL2DParam(model, 'ParamEyeBallY', 0, 1);
      }
    };

    const onMouseEnter = () => {
      if (exprActiveRef.current) return;
      targetRef.current = { x: 0, y: 0, eyeX: 0, eyeY: 0 };
      faceTargetRef.current = { cheek: 0, mouthOpen: 0, mouthForm: 0, eyeOpen: 1 };
    };

    // Track window position after native drag
    const unlistenMove = getCurrentWindow().onMoved((event) => {
      windowPosRef.current = { x: event.payload.x, y: event.payload.y };
    });

    zone.addEventListener('mousemove', onMouseMove);
    zone.addEventListener('mouseleave', onMouseLeave);
    zone.addEventListener('mouseenter', onMouseEnter);

    return () => {
      cancelAnimationFrame(raf);
      if (exprTimerRef.current) clearTimeout(exprTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      unlistenMove.then(fn => fn?.()).catch(() => {});
      zone.removeEventListener('mousemove', onMouseMove);
      zone.removeEventListener('mouseleave', onMouseLeave);
      zone.removeEventListener('mouseenter', onMouseEnter);
    };
  }, []);

  const openContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuHeight = 11 * CONTEXT_MENU_ITEM_HEIGHT + 16;
    setContextMenu({ visible: true, x: Math.min(e.clientX, Math.max(12, window.innerWidth - CONTEXT_MENU_WIDTH - 12)), y: Math.min(e.clientY, Math.max(12, window.innerHeight - menuHeight - 12)) });
  };

  const toggleAlwaysOnTop = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    const n = !isPinned;
    await getCurrentWindow().setAlwaysOnTop(n);
    setIsPinned(n);
    setStatusText(n ? '已置顶' : '已取消置顶');
    setTimeout(() => setStatusText(''), 1800);
  };

  const resetPosition = async () => {
    setContextMenu((p) => ({ ...p, visible: false }));
    await placePetWindowBottomRight();
    setStatusText('已重置位置');
    setTimeout(() => setStatusText(''), 1800);
  };

  const saveServerUrl = () => {
    updateSettings({ api_server_url: tempServerUrl || settings.api_server_url });
    setEditingServer(false);
    setStatusText('服务器地址已保存');
    setTimeout(() => setStatusText(''), 1800);
  };

  const saveWakeWords = () => {
    updateSettings({ wake_words: tempWakeWords.split(',').map(w => w.trim()).filter(Boolean) });
    setEditingWake(false);
    setStatusText('唤醒词已更新');
    setTimeout(() => setStatusText(''), 1800);
  };

  const itemCount = 11;
  const menuHeight = itemCount * CONTEXT_MENU_ITEM_HEIGHT + 16;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}
      onMouseDown={() => { if (contextMenu.visible) setContextMenu((p) => ({ ...p, visible: false })); }}>
      {/* PIXI canvas — pointer-events:none so all clicks pass through to body/charZone */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Character interaction zone: head tracking, dblclick, right-click */}
      <div ref={charZoneRef}
        onDoubleClick={handleDoubleClick}
        onContextMenu={openContextMenu}
        style={{
          position: 'absolute',
          left: CHAR_ZONE_LEFT, right: CHAR_ZONE_RIGHT,
          bottom: CHAR_ZONE_BOTTOM, height: CHAR_ZONE_HEIGHT,
          zIndex: 2,
          cursor: 'pointer',
          background: 'transparent',
          WebkitAppRegion: 'no-drag',
        }} />

      {statusText && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4, pointerEvents: 'none', fontFamily: 'sans-serif' }}>
          {statusText}
        </div>
      )}
      {bubbleText && (
        <div style={{ position: 'absolute', top: 56, left: 12, maxWidth: 240, background: 'rgba(255,255,255,0.92)', color: '#333', padding: 12, borderRadius: 12, borderBottomLeftRadius: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontFamily: 'sans-serif', fontSize: 14, pointerEvents: 'none', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {bubbleText}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 18, right: 12, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 999, fontSize: 11, pointerEvents: 'none', fontFamily: 'sans-serif' }}>
        双击聊天 · 右键设置 · 拖拽移动
      </div>

      {contextMenu.visible && (
        <div onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
          style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, width: CONTEXT_MENU_WIDTH, zIndex: 3, background: 'rgba(18,22,30,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(14px)', padding: 8, color: '#e6edf3', fontFamily: 'sans-serif', fontSize: 13 }}>
          <div style={{ fontSize: 11, opacity: 0.6, padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>设置</div>

          {editingServer ? (
            <div style={{ padding: '0 8px 8px' }}>
              <input value={tempServerUrl} onChange={e => setTempServerUrl(e.target.value)}
                placeholder="http://localhost:8642"
                style={{ width: '100%', padding: '6px 8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', fontSize: 12, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={saveServerUrl} style={miniBtn}>保存</button>
                <button onClick={() => setEditingServer(false)} style={{ ...miniBtn, background: '#21262d' }}>取消</button>
              </div>
            </div>
          ) : editingWake ? (
            <div style={{ padding: '0 8px 8px' }}>
              <input value={tempWakeWords} onChange={e => setTempWakeWords(e.target.value)}
                placeholder="小赫, AI助手, 2B"
                style={{ width: '100%', padding: '6px 8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', fontSize: 12, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={saveWakeWords} style={miniBtn}>保存</button>
                <button onClick={() => setEditingWake(false)} style={{ ...miniBtn, background: '#21262d' }}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem label="💬 打开聊天" onClick={() => void openChatWindow()} />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
              <MenuItem label="🔗 服务器地址" right={settings.api_server_url.replace('http://', '')}
                onClick={() => { setTempServerUrl(settings.api_server_url); setEditingServer(true); }} />
              <MenuItem label="🎤 唤醒词" right={settings.wake_words.slice(0, 2).join(', ')}
                onClick={() => { setTempWakeWords(settings.wake_words.join(', ')); setEditingWake(true); }} />
              <MenuItem label="🔊 TTS 语音" right={TTS_VOICES.find(v => v.id === settings.tts_voice)?.name || settings.tts_voice}
                onClick={async () => {
                  setContextMenu(p => ({ ...p, visible: false }));
                  const idx = TTS_VOICES.findIndex(v => v.id === settings.tts_voice);
                  const next = TTS_VOICES[(idx + 1) % TTS_VOICES.length];
                  await updateSettings({ tts_voice: next.id });
                  setStatusText(`TTS: ${next.name}`);
                  setTimeout(() => setStatusText(''), 1800);
                }} />
              <MenuItem label="⚡ TTS 语速" right={settings.tts_rate}
                onClick={async () => {
                  const rates = ['-20%', '-10%', '+0%', '+10%', '+20%'];
                  const idx = rates.indexOf(settings.tts_rate);
                  const next = rates[(idx + 1) % rates.length];
                  await updateSettings({ tts_rate: next });
                  setStatusText(`语速: ${next}`);
                  setTimeout(() => setStatusText(''), 1800);
                }} />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
              <MenuItem label="📌 置顶" right={isPinned ? '✓' : ''} onClick={() => void toggleAlwaysOnTop()} />
              <MenuItem label="🔄 重置位置" onClick={() => void resetPosition()} />
              <MenuItem label="🔄 新会话" onClick={async () => {
                setContextMenu(p => ({ ...p, visible: false }));
                await invoke('new_session');
                setStatusText('新会话已开始');
                setTimeout(() => setStatusText(''), 1800);
              }} />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
              <MenuItem label="❌ 关闭桌宠" onClick={() => { setContextMenu(p => ({ ...p, visible: false })); void getCurrentWindow().close(); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, right, onClick }: { label: string; right?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', height: CONTEXT_MENU_ITEM_HEIGHT, border: 'none', borderRadius: 8, background: 'transparent', color: '#e6edf3', textAlign: 'left', padding: '0 10px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{label}</span>
      {right && <span style={{ fontSize: 11, opacity: 0.5 }}>{right}</span>}
    </button>
  );
}

const miniBtn: React.CSSProperties = { border: 'none', borderRadius: 6, background: '#238636', color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12 };
