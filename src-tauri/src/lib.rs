use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
#[allow(unused_imports)]
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};
use tokio::sync::oneshot;

mod sync;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

/// 当前同步服务的端口（0 = 未运行）
static SYNC_PORT: AtomicU16 = AtomicU16::new(0);
/// 是否正在启动同步服务（防止并发 start）
static SYNC_STARTING: AtomicBool = AtomicBool::new(false);
/// 同步服务配对码
static SYNC_PAIR_CODE: Mutex<Option<String>> = Mutex::new(None);
/// 优雅停止同步服务的信号发送端
static SYNC_SHUTDOWN_TX: Mutex<Option<oneshot::Sender<()>>> = Mutex::new(None);

fn clear_sync_runtime_state() {
    SYNC_PORT.store(0, Ordering::Relaxed);
    SYNC_STARTING.store(false, Ordering::Relaxed);
    if let Ok(mut code) = SYNC_PAIR_CODE.lock() {
        *code = None;
    }
    if let Ok(mut guard) = SYNC_SHUTDOWN_TX.lock() {
        *guard = None;
    }
}

#[cfg_attr(not(desktop), allow(dead_code))]
static SHOULD_CENTER_ON_SHOW: AtomicBool = AtomicBool::new(true);

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(dir.join("vault.json"))
}

#[tauri::command]
fn read_vault(app: AppHandle) -> Result<Option<String>, String> {
    let path = vault_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path)
        .map(Some)
        .map_err(|error| format!("无法读取本地保险库：{error}"))
}

#[tauri::command]
fn write_vault(app: AppHandle, contents: String) -> Result<(), String> {
    let path = vault_path(&app)?;
    fs::write(path, contents).map_err(|error| format!("无法写入本地保险库：{error}"))
}

#[tauri::command]
fn delete_vault(app: AppHandle) -> Result<(), String> {
    let path = vault_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("无法删除本地保险库：{error}"))?;
    }
    Ok(())
}

fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        show_webview_window(&window);
    }
}

fn show_webview_window(window: &WebviewWindow) {
    #[cfg(desktop)]
    if SHOULD_CENTER_ON_SHOW.swap(false, Ordering::Relaxed) {
        let _ = window.center();
    }
    let _ = window.show();
    #[cfg(desktop)]
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[tauri::command]
fn reveal_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window(&app);
    Ok(())
}

#[tauri::command]
fn is_autostart_session() -> bool {
    is_autostart_launch()
}

/// 启动同步服务，返回配对码
#[tauri::command]
async fn start_sync_server(app: AppHandle, port: u16) -> Result<String, String> {
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let (ready_tx, ready_rx) = oneshot::channel::<Result<u16, String>>();

    // 在同一把锁下声明启动并写入 shutdown，避免 stop 取不到信号却清掉状态
    {
        let mut guard = SYNC_SHUTDOWN_TX.lock().map_err(|e| e.to_string())?;
        if SYNC_PORT.load(Ordering::Relaxed) != 0
            || SYNC_STARTING.load(Ordering::Relaxed)
            || guard.is_some()
        {
            return Err("同步服务已在运行中".to_string());
        }
        SYNC_STARTING.store(true, Ordering::SeqCst);
        *guard = Some(shutdown_tx);
    }

    let vault_path = match vault_path(&app) {
        Ok(path) => path.to_string_lossy().to_string(),
        Err(e) => {
            clear_sync_runtime_state();
            return Err(e);
        }
    };
    let pair_code = sync::generate_pair_code();
    {
        let mut code = match SYNC_PAIR_CODE.lock() {
            Ok(guard) => guard,
            Err(e) => {
                clear_sync_runtime_state();
                return Err(e.to_string());
            }
        };
        *code = Some(pair_code.clone());
    }

    let state_pair_code = pair_code.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        println!("启动同步服务 (port={port}, pair_code={state_pair_code})");
        if let Err(e) = sync::start_server(
            port,
            state_pair_code,
            vault_path,
            app_handle,
            shutdown_rx,
            ready_tx,
        )
        .await
        {
            eprintln!("同步服务异常退出: {e}");
        }
        clear_sync_runtime_state();
    });

    match ready_rx.await {
        Ok(Ok(actual_port)) => {
            // 持锁确认 shutdown 仍在：若启动期间已被 stop，则不要写回「运行中」
            let guard = match SYNC_SHUTDOWN_TX.lock() {
                Ok(guard) => guard,
                Err(e) => {
                    SYNC_STARTING.store(false, Ordering::Relaxed);
                    return Err(e.to_string());
                }
            };
            if guard.is_none() {
                // 保持 STARTING=true，直到后台 serve 退出并 clear，避免 stop 过早返回
                return Err("同步服务启动已取消".to_string());
            }
            SYNC_PORT.store(actual_port, Ordering::Relaxed);
            SYNC_STARTING.store(false, Ordering::Relaxed);
            drop(guard);
            Ok(pair_code)
        }
        Ok(Err(e)) => {
            clear_sync_runtime_state();
            Err(e)
        }
        Err(_) => {
            clear_sync_runtime_state();
            Err("同步服务启动中断".to_string())
        }
    }
}

/// 停止同步服务
#[tauri::command]
async fn stop_sync_server() -> Result<(), String> {
    let prev = SYNC_PORT.load(Ordering::Relaxed);
    if prev == 0 && !SYNC_STARTING.load(Ordering::Relaxed) {
        return Err("同步服务未运行".to_string());
    }

    let tx = {
        let mut guard = SYNC_SHUTDOWN_TX.lock().map_err(|e| e.to_string())?;
        guard.take()
    };

    if let Some(tx) = tx {
        let _ = tx.send(());
    } else {
        // 另一次 stop 可能已发出信号；等待其完成，勿误清仍在监听的服务
        for _ in 0..100 {
            if SYNC_PORT.load(Ordering::Relaxed) == 0 && !SYNC_STARTING.load(Ordering::Relaxed) {
                return Ok(());
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        return Err("同步服务正在停止中，请稍后重试".to_string());
    }

    // 等待服务退出并清理端口标志
    for _ in 0..100 {
        if SYNC_PORT.load(Ordering::Relaxed) == 0 && !SYNC_STARTING.load(Ordering::Relaxed) {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // 超时强制清理状态，避免卡死无法重启；同时告知调用方可能仍占端口
    clear_sync_runtime_state();
    Err("同步服务停止超时，已重置状态；若端口仍被占用请稍后重试".to_string())
}

/// 获取同步服务状态
#[tauri::command]
async fn get_sync_status() -> Result<serde_json::Value, String> {
    let port = SYNC_PORT.load(Ordering::Relaxed);
    let pair_code = SYNC_PAIR_CODE.lock().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "running": port != 0,
        "port": port,
        "pair_code": pair_code.as_deref().unwrap_or(""),
    }))
}

/// 获取本机局域网 IP 地址
#[tauri::command]
async fn get_local_ip() -> Result<String, String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("无法创建 socket: {e}"))?;
    socket
        .connect("10.255.255.255:1")
        .map_err(|e| format!("无法获取本机 IP: {e}"))?;
    let addr = socket
        .local_addr()
        .map_err(|e| format!("无法获取本地地址: {e}"))?;
    Ok(addr.ip().to_string())
}

#[tauri::command]
async fn sync_ping(remote_url: String) -> Result<bool, String> {
    sync::client_ping(&remote_url).await
}

#[tauri::command]
async fn sync_pull(remote_url: String, pair_code: String) -> Result<Option<String>, String> {
    sync::client_pull(&remote_url, &pair_code).await
}

#[tauri::command]
async fn sync_push(remote_url: String, pair_code: String, envelope: String) -> Result<(), String> {
    sync::client_push(&remote_url, &pair_code, &envelope).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        show_main_window(app);
    }));

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--autostart"]),
    ));

    let builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    let builder = builder.invoke_handler(tauri::generate_handler![
        read_vault,
        write_vault,
        delete_vault,
        reveal_main_window,
        is_autostart_session,
        start_sync_server,
        stop_sync_server,
        get_sync_status,
        get_local_ip,
        sync_ping,
        sync_pull,
        sync_push
    ]);

    #[cfg(desktop)]
    let builder = builder.setup(|app| {
        let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &quit])?;

        TrayIconBuilder::new()
            .icon(app.default_window_icon().expect("缺少应用图标").clone())
            .tooltip("HuDaGee 账号管家")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "show" => show_main_window(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main_window(tray.app_handle());
                }
            })
            .build(app)?;

        Ok(())
    });

    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    });

    builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main_window(_app);
            }
        });
}
