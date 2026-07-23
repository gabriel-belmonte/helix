// Self-update: downloads the latest release binary from GitHub and replaces
// the running executable. Mirrors install.sh logic in TypeScript.

import { execSync } from "node:child_process";
import { existsSync, chmodSync, renameSync, unlinkSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const REPO = "gabriel-belmonte/helix";

function detectPlatform(): { os: string; arch: string; asset: string } {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : null;
  if (!os) throw new Error(`unsupported OS: ${process.platform}`);

  const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x64" : null;
  if (!arch) throw new Error(`unsupported arch: ${process.arch}`);

  return { os, arch, asset: `helix-${os}-${arch}` };
}

function getLocalVersion(): string | null {
  try {
    // version file sits next to the binary
    const binDir = dirname(process.execPath);
    const vPath = join(binDir, ".helix-version");
    if (existsSync(vPath)) return readFileSync(vPath, "utf8").trim();
  } catch { /* ignore */ }
  return null;
}

function saveLocalVersion(version: string): void {
  try {
    const binDir = dirname(process.execPath);
    const vPath = join(binDir, ".helix-version");
    // Try writing directly; if permission denied, silently skip
    writeFileSync(vPath, version, "utf8");
  } catch { /* non-fatal */ }
}

export async function runUpdate(): Promise<void> {
  const { os, arch, asset } = detectPlatform();
  const currentVersion = getLocalVersion();

  console.log(`→ checking for updates...`);
  console.log(`  platform: ${os}-${arch}`);
  if (currentVersion) console.log(`  current:  v${currentVersion}`);

  // Fetch latest release info
  let releaseInfo: any;
  try {
    const raw = execSync(`curl -fsSL https://api.github.com/repos/${REPO}/releases/latest`, {
      encoding: "utf8",
      timeout: 15_000,
    });
    releaseInfo = JSON.parse(raw);
  } catch {
    throw new Error("failed to fetch release info from GitHub — are you connected?");
  }

  const latestVersion = releaseInfo.tag_name?.replace(/^v/, "");
  if (!latestVersion) throw new Error("could not parse latest version from GitHub");

  if (currentVersion && currentVersion === latestVersion) {
    console.log(`✓ already up to date (v${latestVersion})`);
    return;
  }

  console.log(`→ latest version: v${latestVersion}${currentVersion ? ` (updating from v${currentVersion})` : ""}`);

  // Find the download URL for our platform
  const assetEntry = releaseInfo.assets?.find((a: any) => a.name === asset);
  if (!assetEntry?.browser_download_url) {
    throw new Error(`no binary found for ${asset} in release v${latestVersion}`);
  }

  console.log(`→ downloading ${asset}...`);

  const tmpDir = join(tmpdir(), `helix-update-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const tmpBin = join(tmpDir, "helix-new");

  try {
    execSync(`curl -fsSL "${assetEntry.browser_download_url}" -o "${tmpBin}"`, {
      encoding: "utf8",
      timeout: 120_000,
    });
    chmodSync(tmpBin, 0o755);

    // Atomic replace: move old binary out of the way, then move new one in
    const currentBin = process.execPath;
    const backupBin = currentBin + ".bak";

    // Remove any leftover backup from a previous update
    try { unlinkSync(backupBin); } catch { /* ok */ }

    renameSync(currentBin, backupBin);   // current → .bak
    renameSync(tmpBin, currentBin);      // new → current
    chmodSync(currentBin, 0o755);

    // Also update the TUI companion binary if it exists.
    const binDir = dirname(currentBin);
    const tuiAsset = asset.replace("helix-", "helix-tui-");
    const tuiEntry = releaseInfo.assets?.find((a: any) => a.name === tuiAsset);
    if (tuiEntry?.browser_download_url) {
      const tuiBin = join(binDir, "helix-tui");
      console.log(`→ updating companion ${tuiAsset}...`);
      try {
        execSync(`curl -fsSL "${tuiEntry.browser_download_url}" -o "${tuiBin}.new"`, { timeout: 60_000 });
        chmodSync(tuiBin + ".new", 0o755);
        renameSync(tuiBin, tuiBin + ".bak");   // old → .bak
        renameSync(tuiBin + ".new", tuiBin);    // new → current
        console.log(`  tui companion updated`);
      } catch {
        console.warn(`  warning: could not update tui companion`);
      }
    }

    // Save version marker next to the binary
    saveLocalVersion(latestVersion);

    console.log(`✓ updated: v${currentVersion ?? "?"} → v${latestVersion}`);
    console.log(`  binary: ${currentBin}`);
    console.log(`  backup: ${backupBin} (delete when happy)`);
  } catch (e: any) {
    // Attempt rollback if we moved the old binary but new one failed
    const backupBin = process.execPath + ".bak";
    if (existsSync(backupBin) && !existsSync(process.execPath)) {
      renameSync(backupBin, process.execPath);
      console.error("✗ update failed — rolled back to previous version");
    }
    throw e;
  } finally {
    // Cleanup temp dir
    try { unlinkSync(tmpBin); } catch { /* already moved or never created */ }
    try { require("node:fs").rmdirSync(tmpDir); } catch { /* ignore */ }
  }
}
