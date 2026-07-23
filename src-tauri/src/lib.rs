use std::fs;
use std::path::PathBuf;
#[allow(unused_imports)]
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, WebviewWindow};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // 单实例：重复启动时唤起已驻留托盘的窗口（桌面专用）
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        show_main_window(app);
    }));

    // 开机自启（桌面专用）
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--autostart"]),
    ));

    // 通用插件（桌面 + 移动端均支持）
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
        is_autostart_session
    ]);

    // 桌面专用 setup：托盘图标与右键菜单
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
                // 左键单击托盘图标恢复主窗口
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

    // 桌面专用窗口事件：关闭时隐藏到托盘而不是退出
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
            // macOS 上点击 Dock 图标恢复已隐藏的主窗口
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main_window(_app);
            }
        });
}
