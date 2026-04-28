use crate::PROXY_MANAGER;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
pub struct ProxyStatus {
    running: bool,
}

#[tauri::command]
pub async fn start_proxy(port: u16, host: String) -> Result<(), String> {
    let manager = PROXY_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.start(port, host).await
}

#[tauri::command]
pub async fn stop_proxy() -> Result<(), String> {
    let manager = PROXY_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.stop().await
}

#[tauri::command]
pub async fn get_proxy_status() -> Result<ProxyStatus, String> {
    let manager = PROXY_MANAGER.lock().map_err(|e| e.to_string())?;
    let running = manager.is_running().await;
    Ok(ProxyStatus { running })
}

#[tauri::command]
pub async fn get_proxy_logs() -> Result<Vec<String>, String> {
    let manager = PROXY_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_logs().await)
}

#[tauri::command]
pub async fn launch_claude_code(port: u16) -> Result<(), String> {
    let base_url = format!("http://127.0.0.1:{}", port);

    #[cfg(target_os = "macos")]
    {
        launch_macos_terminal(&base_url)?;
    }

    #[cfg(target_os = "linux")]
    {
        launch_linux_terminal(&base_url)?;
    }

    #[cfg(target_os = "windows")]
    {
        launch_windows_terminal(&base_url)?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_macos_terminal(base_url: &str) -> Result<(), String> {
    use std::process::Command;

    let env_block = format!(
        r#"export ANTHROPIC_BASE_URL="{}"
export ANTHROPIC_API_KEY="cc-route-dummy-key"
claude"#,
        base_url
    );

    // Try common terminals
    let terminals = [
        ("iTerm.app", "iterm"),
        ("Ghostty.app", "ghostty"),
        ("WezTerm.app", "wezterm"),
        ("Kitty.app", "kitty"),
    ];

    for (app_name, cmd_name) in terminals.iter() {
        let app_path = format!("/Applications/{}", app_name);
        if std::path::Path::new(&app_path).exists() {
            if *cmd_name == "iterm" {
                let script = format!(
                    r#"tell application "iTerm"
    create window with default profile
    tell current session of current window
        write text "export ANTHROPIC_BASE_URL='{}'; export ANTHROPIC_API_KEY='cc-route-dummy-key'; claude"
    end tell
end tell"#,
                    base_url
                );
                let _ = Command::new("osascript")
                    .arg("-e")
                    .arg(&script)
                    .spawn();
                return Ok(());
            }
            let _ = Command::new("open")
                .args(["-na", cmd_name, "--args", "-e", &env_block])
                .spawn();
            return Ok(());
        }
    }

    // Default: Terminal.app
    let script = format!(
        r#"tell application "Terminal"
    do script "export ANTHROPIC_BASE_URL='{}'; export ANTHROPIC_API_KEY='cc-route-dummy-key'; claude"
    activate
end tell"#,
        base_url
    );
    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open Terminal.app: {}", e))?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_linux_terminal(base_url: &str) -> Result<(), String> {
    use std::process::Command;

    let env_block = format!(
        "export ANTHROPIC_BASE_URL='{}'\nexport ANTHROPIC_API_KEY='cc-route-dummy-key'\nclaude",
        base_url
    );

    let terminals = [
        ("gnome-terminal", vec!["--", "bash", "-c", &format!("{}; exec bash", env_block.replace('\n', "; "))]),
        ("konsole", vec!["-e", "bash", "-c", &format!("{}; exec bash", env_block.replace('\n', "; "))]),
        ("xfce4-terminal", vec!["-e", "bash", "-c", &format!("{}; exec bash", env_block.replace('\n', "; "))]),
        ("alacritty", vec!["-e", "bash", "-c", &format!("{}; exec bash", env_block.replace('\n', "; "))]),
        ("xterm", vec!["-e", "bash", "-c", &format!("{}; exec bash", env_block.replace('\n', "; "))]),
    ];

    for (term, args) in terminals.iter() {
        if which::which(term).is_ok() {
            Command::new(term)
                .args(args)
                .spawn()
                .map_err(|e| format!("Failed to launch {}: {}", term, e))?;
            return Ok(());
        }
    }

    Err("No supported terminal found. Please install gnome-terminal, konsole, xfce4-terminal, alacritty, or xterm.".to_string())
}

#[cfg(target_os = "windows")]
fn launch_windows_terminal(base_url: &str) -> Result<(), String> {
    use std::process::Command;

    let env_block = format!(
        "$env:ANTHROPIC_BASE_URL='{}'; $env:ANTHROPIC_API_KEY='cc-route-dummy-key'; claude",
        base_url
    );

    // Try Windows Terminal first
    if which::which("wt").is_ok() {
        Command::new("wt")
            .args(["powershell", "-NoExit", "-Command", &env_block])
            .spawn()
            .map_err(|e| format!("Failed to launch Windows Terminal: {}", e))?;
        return Ok(());
    }

    // Fallback to PowerShell
    Command::new("powershell")
        .args(["-NoExit", "-Command", &env_block])
        .spawn()
        .map_err(|e| format!("Failed to launch PowerShell: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn read_config() -> Result<String, String> {
    let path = get_config_path_internal()?;
    if !path.exists() {
        return Ok("{\"modelRoutes\":{}}".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))
}

#[tauri::command]
pub async fn write_config(content: String) -> Result<(), String> {
    let path = get_config_path_internal()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
pub async fn get_config_path() -> Result<String, String> {
    get_config_path_internal()
        .map(|p| p.to_string_lossy().to_string())
}

fn get_config_path_internal() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Unable to determine home directory")?;
    Ok(home.join(".claude").join("settings.cc-route.json"))
}
