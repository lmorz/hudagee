// 发布版不附带控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hudagee_lib::run();
}
