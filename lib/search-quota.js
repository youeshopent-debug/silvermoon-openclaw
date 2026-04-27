const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function resolveWorkspaceDir() {
  // Prefer explicit config for packaged / relocated runtime (e.g. snapshot/asars).
  const envDir = process.env.OPENCLAW_WORKSPACE_DIR || process.env.SILVERMOON_WORKSPACE_DIR;
  if (envDir) return path.resolve(String(envDir));

  // Prefer current working directory (most robust when code is executed from a different __dirname).
  // If cwd/workspace doesn't exist, we still return it; writers will mkdir -p.
  try {
    const cwdWs = path.join(process.cwd(), 'workspace');
    return cwdWs;
  } catch {}

  // Fallback: project-relative (works for repo layout: <root>/lib).
  return path.join(__dirname, '..', 'workspace');
}

const WORKSPACE_DIR = resolveWorkspaceDir();
const QUOTA_PATH = path.join(WORKSPACE_DIR, 'search_quota.json');

function getKualaLumpurDateKey(now = new Date()) {
  const ts = now.getTime();
  const offsetMs = 8 * 60 * 60 * 1000;
  const d = new Date(ts + offsetMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function withFileLock(
  lockPath,
  fn,
  { timeoutMs = 10_000, retryDelayMs = 60, staleMs = 60_000 } = {},
) {
  const start = Date.now();
  await fsp.mkdir(path.dirname(lockPath), { recursive: true });
  while (true) {
    try {
      const fh = await fsp.open(lockPath, 'wx');
      try {
        await fh.writeFile(String(process.pid), 'utf8');
        return await fn();
      } finally {
        try {
          await fh.close();
        } catch {}
        try {
          await fsp.unlink(lockPath);
        } catch {}
      }
    } catch (e) {
      if (e && e.code !== 'EEXIST') throw e;
      // Defensive: clean up stale lock (process crash / power loss).
      // If we cannot stat/unlink, we simply fall back to retry loop.
      try {
        const st = await fsp.stat(lockPath);
        if (st && Date.now() - Number(st.mtimeMs || 0) > staleMs) {
          await fsp.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {}
      if (Date.now() - start > timeoutMs) throw new Error(`lock timeout: ${lockPath}`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
}

async function atomicWriteFileUtf8(targetPath, content) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  const fh = await fsp.open(tmpPath, 'w');
  try {
    await fh.writeFile(content, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  try {
    await fsp.rename(tmpPath, targetPath);
  } catch (e) {
    if (e && (e.code === 'EEXIST' || e.code === 'EPERM' || e.code === 'EBUSY')) {
      try {
        await fsp.unlink(targetPath);
      } catch {}
      await fsp.rename(tmpPath, targetPath);
    } else {
      try {
        await fsp.unlink(tmpPath);
      } catch {}
      throw e;
    }
  }
}

const POOLS = { brief: 14, manual: 10, deep: 16 };

function defaultQuota(dateKey) {
  return {
    dateKey,
    total: { limit: 80, used: 0 },
    pools: {
      brief: { limit: POOLS.brief, used: 0 },
      manual: { limit: POOLS.manual, used: 0 },
      deep: { limit: POOLS.deep, used: 0 },
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizePool(pool) {
  const p = String(pool || '').trim();
  if (p === 'brief' || p === 'manual' || p === 'deep') return p;
  return null;
}

function createQuotaStore({ quotaPath, workspaceDir } = {}) {
  const wsDir = workspaceDir ? path.resolve(String(workspaceDir)) : WORKSPACE_DIR;
  const effectiveQuotaPath = quotaPath ? String(quotaPath) : path.join(wsDir, 'search_quota.json');
  const lockPath = `${effectiveQuotaPath}.lock`;

  const readQuotaUnsafe = async () => {
    try {
      const txt = await fsp.readFile(effectiveQuotaPath, 'utf8');
      const j = JSON.parse(txt);
      return j && typeof j === 'object' ? j : null;
    } catch {
      return null;
    }
  };

  const writeQuotaUnsafe = async (obj) => {
    const body = JSON.stringify(obj, null, 2) + '\n';
    await atomicWriteFileUtf8(effectiveQuotaPath, body);
  };

  const loadOrResetQuotaUnsafe = async (now) => {
    const dateKey = getKualaLumpurDateKey(now);
    const cur = await readQuotaUnsafe();
    if (!cur || cur.dateKey !== dateKey) return defaultQuota(dateKey);
    return cur;
  };

  const getQuotaStatus = async (now = new Date()) => {
    return withFileLock(lockPath, async () => {
      const q = await loadOrResetQuotaUnsafe(now);
      q.updatedAt = new Date().toISOString();
      await writeQuotaUnsafe(q);
      return q;
    });
  };

  const tryConsume = async (pool, now = new Date()) => {
    const p = normalizePool(pool);
    if (!p) return { ok: false, reason: 'invalid_pool', status: await getQuotaStatus(now) };
    return withFileLock(lockPath, async () => {
      const q = await loadOrResetQuotaUnsafe(now);
      const slot = q?.pools?.[p];
      if (!slot) return { ok: false, reason: 'invalid_pool', status: q };
      if (Number(slot.used) >= Number(slot.limit)) return { ok: false, reason: 'pool_exhausted', status: q };
      if (Number(q.total.used) >= Number(q.total.limit)) return { ok: false, reason: 'total_exhausted', status: q };
      slot.used = Number(slot.used) + 1;
      q.total.used = Number(q.total.used) + 1;
      q.updatedAt = new Date().toISOString();
      await writeQuotaUnsafe(q);
      return { ok: true, reason: 'consumed', status: q };
    });
  };

  return { quotaPath: effectiveQuotaPath, getKualaLumpurDateKey, getQuotaStatus, tryConsume };
}

const defaultStore = createQuotaStore({ quotaPath: QUOTA_PATH });

module.exports = {
  QUOTA_PATH,
  createQuotaStore,
  getKualaLumpurDateKey,
  getQuotaStatus: defaultStore.getQuotaStatus,
  tryConsume: defaultStore.tryConsume,
};
