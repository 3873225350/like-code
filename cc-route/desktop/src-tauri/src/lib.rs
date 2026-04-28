pub mod commands;
pub mod proxy_manager;
pub mod tray;

use std::sync::Mutex;
use std::sync::LazyLock;

pub static PROXY_MANAGER: LazyLock<Mutex<proxy_manager::ProxyManager>> =
    LazyLock::new(|| Mutex::new(proxy_manager::ProxyManager::new()));
