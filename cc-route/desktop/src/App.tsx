import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { useProxyStatus } from "./hooks/useProxyStatus";
import { AppConfig, ModelRouteConfig } from "./types";

type Tab = "proxy" | "models" | "about";

function App() {
  const [tab, setTab] = useState<Tab>("proxy");
  const { running, logs, loading, start, stop } = useProxyStatus();
  const [config, setConfig] = useState<AppConfig>({
    modelRoutes: {},
    port: 3456,
    host: "127.0.0.1",
    autoStart: false,
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const raw = await invoke<string>("read_config");
      const parsed = JSON.parse(raw);
      setConfig({
        modelRoutes: parsed.modelRoutes || {},
        port: parsed.port ?? 3456,
        host: parsed.host ?? "127.0.0.1",
        autoStart: parsed.autoStart ?? false,
      });
      setConfigLoaded(true);
    } catch {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    try {
      const toSave = {
        modelRoutes: config.modelRoutes,
        port: config.port,
        host: config.host,
        autoStart: config.autoStart,
      };
      await invoke("write_config", { content: JSON.stringify(toSave, null, 2) });
      setSaveStatus("Saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (e) {
      setSaveStatus(`Error: ${e}`);
    }
  };

  const addRoute = () => {
    const name = prompt("Model name (e.g., MiniMax-M2.5):");
    if (!name) return;
    setConfig((prev) => ({
      ...prev,
      modelRoutes: {
        ...prev.modelRoutes,
        [name]: { alias: "", baseURL: "", apiKey: "" },
      },
    }));
  };

  const updateRoute = (name: string, field: keyof ModelRouteConfig, value: string) => {
    setConfig((prev) => ({
      ...prev,
      modelRoutes: {
        ...prev.modelRoutes,
        [name]: { ...prev.modelRoutes[name], [field]: value },
      },
    }));
  };

  const deleteRoute = (name: string) => {
    if (!confirm(`Delete route "${name}"?`)) return;
    setConfig((prev) => {
      const next = { ...prev.modelRoutes };
      delete next[name];
      return { ...prev, modelRoutes: next };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: running ? "var(--success)" : "var(--text-secondary)",
              boxShadow: running ? "0 0 6px var(--success)" : "none",
            }}
          />
          <strong style={{ fontSize: 15 }}>cc-route</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {running ? "Proxy running" : "Proxy stopped"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["proxy", "models", "about"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: tab === t ? "var(--accent)" : "transparent",
                color: tab === t ? "#fff" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 500,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {tab === "proxy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                  Port
                </label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, port: parseInt(e.target.value) || 3456 }))
                  }
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                  Host
                </label>
                <input
                  value={config.host}
                  onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="autostart"
                type="checkbox"
                checked={config.autoStart}
                onChange={(e) => setConfig((p) => ({ ...p, autoStart: e.target.checked }))}
                style={{ width: "auto" }}
              />
              <label htmlFor="autostart" style={{ fontSize: 13 }}>
                Auto-start proxy on app launch
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => start(config.port ?? 3456, config.host ?? "127.0.0.1")}
                disabled={running || loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "var(--success)",
                  color: "#fff",
                  fontWeight: 600,
                  opacity: running || loading ? 0.5 : 1,
                }}
              >
                Start Proxy
              </button>
              <button
                onClick={stop}
                disabled={!running || loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 600,
                  opacity: !running || loading ? 0.5 : 1,
                }}
              >
                Stop Proxy
              </button>
              <button
                onClick={saveConfig}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 600,
                  marginLeft: "auto",
                }}
              >
                Save Config
              </button>
            </div>
            {saveStatus && (
              <div style={{ fontSize: 12, color: saveStatus.startsWith("Error") ? "var(--danger)" : "var(--success)" }}>
                {saveStatus}
              </div>
            )}

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                Console Log
              </label>
              <pre
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 10,
                  height: 280,
                  overflow: "auto",
                  fontSize: 11,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  color: "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {logs.length === 0 ? "No logs yet..." : logs.join("\n")}
              </pre>
            </div>
          </div>
        )}

        {tab === "models" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={addRoute}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                + Add Model
              </button>
            </div>
            <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Alias</th>
                    <th>Base URL</th>
                    <th>API Key</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(config.modelRoutes).map(([name, route]) => (
                    <tr key={name}>
                      <td>
                        <input
                          value={name}
                          readOnly
                          style={{ background: "transparent", border: "none", padding: 0 }}
                        />
                      </td>
                      <td>
                        <input
                          value={Array.isArray(route.alias) ? route.alias.join(", ") : route.alias ?? ""}
                          onChange={(e) => updateRoute(name, "alias", e.target.value)}
                          placeholder="alias"
                          style={{ minWidth: 80 }}
                        />
                      </td>
                      <td>
                        <input
                          value={route.baseURL ?? ""}
                          onChange={(e) => updateRoute(name, "baseURL", e.target.value)}
                          placeholder="https://..."
                          style={{ minWidth: 200 }}
                        />
                      </td>
                      <td>
                        <input
                          type="password"
                          value={route.apiKey ?? route.authToken ?? ""}
                          onChange={(e) => updateRoute(name, "apiKey", e.target.value)}
                          placeholder="sk-..."
                          style={{ minWidth: 160 }}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => deleteRoute(name)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            background: "var(--danger)",
                            color: "#fff",
                            fontSize: 11,
                          }}
                        >
                          Del
                        </button>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(config.modelRoutes).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                        No model routes configured. Click "+ Add Model" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={saveConfig}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Save Config
              </button>
            </div>
            {saveStatus && (
              <div style={{ fontSize: 12, color: saveStatus.startsWith("Error") ? "var(--danger)" : "var(--success)", textAlign: "right" }}>
                {saveStatus}
              </div>
            )}
          </div>
        )}

        {tab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>cc-route</div>
            <div style={{ color: "var(--text-secondary)" }}>Multi-provider model routing for Claude Code</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>Version 1.0.0</div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                open("https://github.com/your-org/cc-route");
              }}
              style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}
            >
              GitHub Repository
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
