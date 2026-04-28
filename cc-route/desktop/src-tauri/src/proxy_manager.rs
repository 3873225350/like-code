use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::{Child, Command, Stdio};
use tokio::sync::Mutex;

pub struct ProxyManager {
    child: Arc<Mutex<Option<Child>>>,
    logs: Arc<Mutex<VecDeque<String>>>,
}

impl ProxyManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            logs: Arc::new(Mutex::new(VecDeque::with_capacity(500))),
        }
    }

    pub async fn start(&self, port: u16, host: String) -> Result<(), String> {
        let mut child_lock = self.child.lock().await;
        if child_lock.is_some() {
            return Ok(());
        }

        let binary_path = find_sidecar_binary();

        let mut cmd = Command::new(&binary_path);
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("CC_ROUTE_PORT", port.to_string())
            .env("CC_ROUTE_HOST", host)
            .env("RUST_LOG", "info");

        // Spawn the process
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn proxy at {}: {}", binary_path.display(), e))?;

        // Capture stdout/stderr
        let logs = self.logs.clone();
        if let Some(stdout) = child.stdout.take() {
            let logs = logs.clone();
            tokio::spawn(async move {
                use tokio::io::AsyncBufReadExt;
                let reader = tokio::io::BufReader::new(stdout);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut logs = logs.lock().await;
                    if logs.len() >= 500 {
                        logs.pop_front();
                    }
                    logs.push_back(format!("[stdout] {}", line));
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let logs = self.logs.clone();
            tokio::spawn(async move {
                use tokio::io::AsyncBufReadExt;
                let reader = tokio::io::BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let mut logs = logs.lock().await;
                    if logs.len() >= 500 {
                        logs.pop_front();
                    }
                    logs.push_back(format!("[stderr] {}", line));
                }
            });
        }

        *child_lock = Some(child);
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut child_lock = self.child.lock().await;
        if let Some(mut child) = child_lock.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
        Ok(())
    }

    pub async fn is_running(&self) -> bool {
        let mut child_lock = self.child.lock().await;
        if let Some(ref mut child) = *child_lock {
            match child.try_wait() {
                Ok(None) => return true,
                Ok(Some(_)) => {
                    *child_lock = None;
                    return false;
                }
                Err(_) => {
                    *child_lock = None;
                    return false;
                }
            }
        }
        false
    }

    pub async fn get_logs(&self) -> Vec<String> {
        let logs = self.logs.lock().await;
        logs.iter().cloned().collect()
    }

    pub async fn clear_logs(&self) {
        let mut logs = self.logs.lock().await;
        logs.clear();
    }
}

fn find_sidecar_binary() -> PathBuf {
    let name = if cfg!(target_os = "windows") {
        "cc-route-proxy.exe"
    } else {
        "cc-route-proxy"
    };

    // 1. Try exe directory (production / cargo build)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(name);
            if candidate.exists() {
                return candidate;
            }
        }
    }

    // 2. Try relative to current working directory (tauri dev)
    let cwd = std::env::current_dir().unwrap_or_default();
    for rel in [
        "src-tauri/binaries",
        "../src-tauri/binaries",
        "desktop/src-tauri/binaries",
        "../desktop/src-tauri/binaries",
    ] {
        let candidate = cwd.join(rel).join(name);
        if candidate.exists() {
            return candidate;
        }
    }

    // 3. Fallback: PATH
    PathBuf::from(name)
}
