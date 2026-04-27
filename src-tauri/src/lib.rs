use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

// ===== Settings =====

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    #[serde(default = "default_api_url")]
    api_server_url: String,
    #[serde(default)]
    api_server_key: String,
    #[serde(default = "default_wake_words")]
    wake_words: Vec<String>,
    #[serde(default = "default_silence_timeout")]
    silence_timeout: f64,
    #[serde(default = "default_tts_voice")]
    tts_voice: String,
    #[serde(default = "default_tts_rate")]
    tts_rate: String,
}

fn default_api_url() -> String { "http://localhost:8642".into() }
fn default_wake_words() -> Vec<String> { vec!["小赫".into(), "AI助手".into(), "2B".into()] }
fn default_silence_timeout() -> f64 { 1.5 }
fn default_tts_voice() -> String { "zh-CN-XiaoyiNeural".into() }
fn default_tts_rate() -> String { "+0%".into() }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            api_server_url: default_api_url(),
            api_server_key: String::new(),
            wake_words: default_wake_words(),
            silence_timeout: default_silence_timeout(),
            tts_voice: default_tts_voice(),
            tts_rate: default_tts_rate(),
        }
    }
}

struct AppState {
    settings: Mutex<AppSettings>,
    session_id: Mutex<Option<String>>,
}

fn settings_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("himers-settings.json")
}

fn load_settings(app: &tauri::AppHandle) -> AppSettings {
    let path = settings_path(app);
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) {
    let path = settings_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = std::fs::write(&path, json);
    }
}

// ===== Tauri Commands =====

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn set_settings(
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
    partial: serde_json::Value,
) -> Result<AppSettings, String> {
    let mut settings = state.settings.lock().unwrap();
    if let Ok(merged) = serde_json::from_value::<AppSettings>(partial) {
        // Merge: only update non-default fields from partial
        // Simple approach: deserialize current + new into map, merge, serialize back
        let current_json = serde_json::to_value(&*settings).unwrap_or_default();
        let partial_json = serde_json::to_value(&merged).unwrap_or_default();

        if let (serde_json::Value::Object(mut current), serde_json::Value::Object(partial)) = (current_json, partial_json) {
            for (k, v) in partial {
                current.insert(k, v);
            }
            if let Ok(new_settings) = serde_json::from_value::<AppSettings>(serde_json::Value::Object(current)) {
                *settings = new_settings.clone();
                save_settings(&app, &new_settings);
                return Ok(new_settings);
            }
        }
    }
    Err("Failed to merge settings".into())
}

#[tauri::command]
fn set_ignore_cursor_events(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

#[tauri::command]
async fn connect_agent(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    message: String,
) -> Result<(), String> {
    let (api_url, api_key) = {
        let s = state.settings.lock().unwrap();
        (s.api_server_url.clone(), s.api_server_key.clone())
    };

    let session_id = {
        state.session_id.lock().unwrap().clone()
    };

    let url = format!("{}/v1/chat/completions", api_url.trim_end_matches('/'));

    // Build request body
    let body = serde_json::json!({
        "model": "hermes-agent",
        "messages": [
            { "role": "user", "content": message }
        ],
        "stream": false
    });

    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body);

    if let Some(ref sid) = session_id {
        req = req.header("X-Hermes-Session-Id", sid);
    }
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let resp = req.send().await.map_err(|e| format!("连接 Hermes 失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Hermes 返回错误 {}: {}", status, body));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| format!("解析响应失败: {}", e))?;

    // Extract content
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("(空回复)")
        .to_string();

    // Extract session id for continuity
    if let Some(sid) = json["id"].as_str() {
        *state.session_id.lock().unwrap() = Some(sid.to_string());
    }

    // Stream content char by char to frontend
    for c in content.chars() {
        window.emit("agent-chunk", c.to_string()).map_err(|e| e.to_string())?;
        // Small delay for visual effect (50ms is fast enough)
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    window.emit("agent-done", "").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn new_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.session_id.lock().unwrap() = None;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let settings = load_settings(&app.handle());
            let state = AppState {
                settings: Mutex::new(settings),
                session_id: Mutex::new(None),
            };
            app.manage(state);

            // Position pet window at bottom-right before it becomes visible.
            // Physical→logical math must happen early — once the window is shown
            // at (0,0) the user sees a flash in the top-left corner.
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let sf = monitor.scale_factor();
                    let size = monitor.size();
                    let pos = monitor.position();
                    // workArea: physical coords → logical via scale factor
                    let logical_right = (pos.x as f64 + size.width as f64) / sf;
                    let logical_bottom = (pos.y as f64 + size.height as f64) / sf;
                    let pet_w = 380.0;
                    let pet_h = 560.0;
                    let margin = 12.0;
                    let x = (logical_right - pet_w - margin).round();
                    let y = (logical_bottom - pet_h - margin).round();
                    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_ignore_cursor_events,
            connect_agent,
            get_settings,
            set_settings,
            new_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
