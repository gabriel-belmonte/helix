// Checkpoint / Rollback — snapshot files before overwrite and restore on demand.
//
// Every write_file call snapshots the target file (if it exists) to
// ~/.helix/checkpoints/<safe-name>-<ts>.ckpt before overwriting.
// A companion <safe-name>-<ts>.meta file stores the original absolute path.
// The rollback tool + CLI find/restore checkpoints by path or id.

import {
  mkdirSync,
  copyFileSync,
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CHECKPOINT_DIR = join(homedir(), ".helix", "checkpoints");

function ensureDir(): void {
  mkdirSync(CHECKPOINT_DIR, { recursive: true });
}

/** Short unique suffix so checkpoints don't collide. */
function stamp(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

/** Safe filename prefix derived from the original path. */
function safeName(originalPath: string): string {
  return originalPath.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

export type CheckpointMeta = {
  /** Checkpoint file id (stem, e.g. "my_file_ts-abc123"). */
  id: string;
  /** Absolute path to the checkpoint (.ckpt file). */
  checkpointPath: string;
  /** Absolute path of the original file that was snapshotted. */
  originalPath: string;
  /** File size in bytes. */
  size: number;
  /** When the snapshot was taken (epoch ms). */
  time: number;
};

// ── Snapshot ──────────────────────────────────────────────────────────

/**
 * Snapshot a file before it gets overwritten.
 * Returns the checkpoint id, or null if the file didn't exist.
 */
export function checkpointBeforeWrite(originalPath: string): string | null {
  if (!existsSync(originalPath)) return null;
  ensureDir();

  const sn = safeName(originalPath);
  const id = `${sn}-${stamp()}`;
  const ckptPath = join(CHECKPOINT_DIR, `${id}.ckpt`);
  const metaPath = join(CHECKPOINT_DIR, `${id}.meta`);

  copyFileSync(originalPath, ckptPath);
  // Store original path metadata for reliable rollback-by-id / rollback-last.
  writeFileSync(
    metaPath,
    JSON.stringify({ originalPath, time: Date.now(), size: statSync(originalPath).size }),
    "utf8"
  );

  return id;
}

// ── List checkpoints ──────────────────────────────────────────────────

/**
 * List all checkpoints, newest first.
 * @param originalPath  If set, filter to checkpoints for this original file.
 */
export function listCheckpoints(
  originalPath?: string,
  limit = 50
): CheckpointMeta[] {
  if (!existsSync(CHECKPOINT_DIR)) return [];
  const sn = originalPath ? safeName(originalPath) : null;

  const entries = readdirSync(CHECKPOINT_DIR);
  const metaFiles = new Map<string, string>();

  // Pair .ckpt ↔ .meta
  for (const name of entries) {
    if (name.endsWith(".meta")) {
      const stem = name.slice(0, -5); // strip ".meta"
      metaFiles.set(stem, name);
    }
  }

  const results: CheckpointMeta[] = [];

  for (const name of entries) {
    if (!name.endsWith(".ckpt")) continue;
    const stem = name.slice(0, -5); // strip ".ckpt"
    if (sn && !stem.startsWith(sn + "-")) continue;

    const ckptFull = join(CHECKPOINT_DIR, name);
    const metaName = metaFiles.get(stem);

    try {
      const stat = statSync(ckptFull);
      let originalPath = "(unknown)";
      let time = stat.mtimeMs;

      if (metaName) {
        try {
          const metaRaw = readFileSync(join(CHECKPOINT_DIR, metaName), "utf8");
          const meta = JSON.parse(metaRaw);
          if (meta.originalPath) originalPath = meta.originalPath;
          if (meta.time) time = meta.time;
        } catch {
          /* best-effort */
        }
      }

      results.push({
        id: stem,
        checkpointPath: ckptFull,
        originalPath,
        size: stat.size,
        time,
      });
    } catch {
      continue;
    }
  }

  results.sort((a, b) => b.time - a.time || b.id.localeCompare(a.id));
  return results.slice(0, limit);
}

// ── Restore by checkpoint id ──────────────────────────────────────────

export type RollbackResult = {
  success: boolean;
  /** Path to the checkpoint that was restored (null on failure). */
  checkpointPath: string | null;
  /** Absolute path of the restored file. */
  restoredPath: string;
  message: string;
};

/**
 * Restore a file from a specific checkpoint id.
 * Loads the .meta to find the original path, then copies the .ckpt back there.
 */
export function restoreById(id: string): RollbackResult {
  const ckptPath = join(CHECKPOINT_DIR, `${id}.ckpt`);
  const metaPath = join(CHECKPOINT_DIR, `${id}.meta`);

  if (!existsSync(ckptPath)) {
    return {
      success: false,
      checkpointPath: null,
      restoredPath: id,
      message: `Checkpoint "${id}" not found.`,
    };
  }

  let originalPath: string;
  try {
    const metaRaw = readFileSync(metaPath, "utf8");
    originalPath = JSON.parse(metaRaw).originalPath;
  } catch {
    return {
      success: false,
      checkpointPath: ckptPath,
      restoredPath: id,
      message: `Metadata for checkpoint "${id}" is corrupt or missing.`,
    };
  }

  try {
    copyFileSync(ckptPath, originalPath);
    return {
      success: true,
      checkpointPath: ckptPath,
      restoredPath: originalPath,
      message: `Restored "${originalPath}" from checkpoint ${id}.`,
    };
  } catch (e: any) {
    return {
      success: false,
      checkpointPath: ckptPath,
      restoredPath: originalPath,
      message: `Failed to restore "${originalPath}": ${e.message}`,
    };
  }
}

/**
 * Restore a file to its most recent checkpoint by original path.
 */
export function rollbackFile(originalPath: string): RollbackResult {
  const checkpoints = listCheckpoints(originalPath, 1);
  if (checkpoints.length === 0) {
    return {
      success: false,
      checkpointPath: null,
      restoredPath: originalPath,
      message: `No checkpoint found for "${originalPath}".`,
    };
  }
  return restoreById(checkpoints[0].id);
}

// ── Agent tool ────────────────────────────────────────────────────────

/**
 * Agent-facing rollback tool handler.
 *
 * Input variants:
 *   { path: "<file>" }       – restore latest checkpoint for that file
 *   { target: "last" }        – restore the most recent checkpoint overall
 *   { target: "list" }        – list available checkpoints
 *   { id: "<checkpoint-id>" } – restore a specific checkpoint by id
 */
export async function rollbackTool(input: unknown): Promise<string> {
  const inp = input as { path?: string; target?: string; id?: string };

  if (inp.id) return restoreById(inp.id).message;
  if (inp.target === "list") {
    const all = listCheckpoints(undefined, 20);
    if (all.length === 0) return "No checkpoints available.";
    const lines = all.map(
      (c) =>
        `  ${c.id.padEnd(50)} ${String(c.size).padStart(8)} B  ${new Date(c.time).toISOString().slice(0, 19).replace("T", " ")}  ${c.originalPath}`
    );
    return `Available checkpoints (${all.length}):\n` + lines.join("\n");
  }
  if (inp.target === "last") {
    const all = listCheckpoints(undefined, 1);
    if (all.length === 0) return "No checkpoints available.";
    return restoreById(all[0].id).message;
  }
  if (inp.path) return rollbackFile(inp.path).message;

  return 'Usage: rollback({ path: "<file>" }) or rollback({ target: "last"|"list" }) or rollback({ id: "<checkpoint-id>" })';
}
