use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

const TRAY_ID: &str = "tray";

fn build_menu(app: &AppHandle, running: bool) -> Result<Menu, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;
    let status_text = if running { "Proxy: Running" } else { "Proxy: Stopped" };

    menu.append(&MenuItem::with_id(app, "status", status_text, false, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "start", "Start Proxy", !running, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "stop", "Stop Proxy", running, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(
        app,
        "launch",
        "Launch Claude Code",
        running,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;

    Ok(menu)
}

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app, false)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => {
                    app.exit(0);
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "launch" => {
                    let port = 3456;
                    tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::launch_claude_code(port).await;
                    });
                }
                "start" => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::start_proxy(3456, "127.0.0.1".to_string()).await;
                        let _ = update_tray_status(&app, true);
                    });
                }
                "stop" => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::stop_proxy().await;
                        let _ = update_tray_status(&app, false);
                    });
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

fn update_tray_status(app: &AppHandle, running: bool) -> Result<(), Box<dyn std::error::Error>> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("Tray not found")?;
    let menu = build_menu(app, running)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}
