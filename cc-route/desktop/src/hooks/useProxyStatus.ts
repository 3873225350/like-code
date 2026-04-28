import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useProxyStatus() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await invoke<{ running: boolean }>("get_proxy_status");
      setRunning(status.running);
      const latestLogs = await invoke<string[]>("get_proxy_logs");
      setLogs(latestLogs);
    } catch {
      setRunning(false);
    }
  }, []);

  const start = useCallback(
    async (port: number, host: string) => {
      setLoading(true);
      try {
        await invoke("start_proxy", { port, host });
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("stop_proxy");
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { running, logs, loading, start, stop, refresh };
}
