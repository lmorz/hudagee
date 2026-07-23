// 发布版不附带控制台窗口（仅 Windows 桌面有效）
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

fn main() {
    hudagee_lib::run();
}
