#!/usr/bin/env node
/**
 * Build script for cc-route desktop application.
 * Compiles proxy sidecar and then runs Tauri build.
 *
 * Usage:
 *   node scripts/build-desktop.js              # build current platform
 *   node scripts/build-desktop.js --tauri-args="--target aarch64-apple-darwin"
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PROXY_DIR = path.join(ROOT, "proxy");
const DESKTOP_DIR = path.join(ROOT, "desktop");
const BINARIES_DIR = path.join(DESKTOP_DIR, "src-tauri", "binaries");

function banner(msg) {
  console.log(`\n  === ${msg} ===`);
}

function exec(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
}

function getSidecarName() {
  const platform = process.platform;
  const arch = process.arch;
  let suffix = "";
  if (platform === "win32") {
    suffix = "windows-x64.exe";
  } else if (platform === "darwin") {
    suffix = arch === "arm64" ? "macos-arm64" : "macos-x64";
  } else {
    suffix = arch === "arm64" ? "linux-arm64" : "linux-x64";
  }
  return `cc-route-proxy-${suffix}`;
}

function buildSidecar() {
  banner("Building proxy sidecar");

  if (!fs.existsSync(BINARIES_DIR)) {
    fs.mkdirSync(BINARIES_DIR, { recursive: true });
  }

  const outName = "cc-route-proxy";
  const outPath = path.join(BINARIES_DIR, outName);

  // Check if bun is available
  try {
    execSync("bun --version", { stdio: "ignore" });
  } catch {
    console.error("  bun is not installed. Install it from https://bun.sh");
    process.exit(1);
  }

  const cmd = [
    "bun", "build",
    "--compile",
    "--target", `bun-${process.platform}-${process.arch}`,
    "--outfile", outPath,
    "proxy/src/index.ts",
  ].join(" ");

  try {
    exec(cmd, { cwd: ROOT });
    const stats = fs.statSync(outPath);
    console.log(`  Sidecar: ${outPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (err) {
    console.error(`  Failed to build sidecar:`, err.message);
    return false;
  }
}

function buildDesktop(extraArgs = "") {
  banner("Building desktop app with Tauri");

  // Install desktop deps if node_modules missing
  if (!fs.existsSync(path.join(DESKTOP_DIR, "node_modules"))) {
    exec("npm install", { cwd: DESKTOP_DIR });
  }

  const cmd = `npm run tauri build ${extraArgs}`.trim();
  try {
    exec(cmd, { cwd: DESKTOP_DIR });
    return true;
  } catch (err) {
    console.error(`  Failed to build desktop app:`, err.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const tauriArgsIdx = args.findIndex((a) => a.startsWith("--tauri-args="));
  const tauriArgs = tauriArgsIdx >= 0 ? args[tauriArgsIdx].replace("--tauri-args=", "") : "";

  const sidecarOk = buildSidecar();
  if (!sidecarOk) {
    process.exit(1);
  }

  const desktopOk = buildDesktop(tauriArgs);
  if (!desktopOk) {
    process.exit(1);
  }

  banner("Build complete");
  const releaseDir = path.join(DESKTOP_DIR, "src-tauri", "target", "release", "bundle");
  if (fs.existsSync(releaseDir)) {
    console.log("\n  Artifacts:");
    const listArtifacts = (dir) => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach((f) => {
        const p = path.join(dir, f);
        const s = fs.statSync(p);
        if (s.isFile()) {
          console.log(`    ${f.padEnd(40)} ${(s.size / 1024 / 1024).toFixed(1)} MB`);
        }
      });
    };
    ["msi", "dmg", "appimage", "deb", "rpm", "nsis", "app", "appimage"].forEach((t) => {
      listArtifacts(path.join(releaseDir, t));
    });
  }
}

main();
