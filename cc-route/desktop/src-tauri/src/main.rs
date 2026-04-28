// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        .setup(|app| {
            // Initialize system tray
            let _ = cc_route_desktop::tray::create_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cc_route_desktop::commands::start_proxy,
            cc_route_desktop::commands::stop_proxy,
            cc_route_desktop::commands::get_proxy_status,
            cc_route_desktop::commands::get_proxy_logs,
            cc_route_desktop::commands::launch_claude_code,
            cc_route_desktop::commands::read_config,
            cc_route_desktop::commands::write_config,
            cc_route_desktop::commands::get_config_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
