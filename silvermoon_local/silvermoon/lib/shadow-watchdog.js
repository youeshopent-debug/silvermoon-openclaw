function pctDiff(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return null;
  const avg = (x + y) / 2;
  if (!Number.isFinite(avg) || avg <= 0) return null;
  return (Math.abs(x - y) / avg) * 100;
}

function buildRedSummary(reasons) {
  const uniq = Array.from(new Set((reasons || []).map((x) => String(x || '').trim()).filter(Boolean)));
  return uniq.length ? uniq.join('；') : '未知红色预警';
}

function scanBriefPairs(fileNames) {
  const arr = Array.isArray(fileNames) ? fileNames : [];
  const map = new Map();
  for (const n0 of arr) {
    const n = String(n0 || '').trim();
    const m = /^(\d{8})_早报\.(md|sent)$/i.exec(n);
    if (!m) continue;
    const ymd = m[1];
    const ext = m[2].toLowerCase();
    const v = map.get(ymd) || { ymd, hasMd: false, hasSent: false };
    if (ext === 'md') v.hasMd = true;
    if (ext === 'sent') v.hasSent = true;
    map.set(ymd, v);
  }
  return Array.from(map.values()).sort((a, b) => String(b.ymd).localeCompare(String(a.ymd)));
}

function createShadowWatchdog(deps) {
  const cronDir = String(deps?.cronDir || '').trim();
  const briefCachePath = String(deps?.briefCachePath || '').trim();
  const getEnv = typeof deps?.getEnv === 'function' ? deps.getEnv : () => ({});
  const listDir = typeof deps?.listDir === 'function' ? deps.listDir : async () => [];
  const readJson = typeof deps?.readJson === 'function' ? deps.readJson : async () => null;
  const writeJson = typeof deps?.writeJson === 'function' ? deps.writeJson : async () => {};
  const fetchUsdMyrApi = typeof deps?.fetchUsdMyrApi === 'function' ? deps.fetchUsdMyrApi : async () => null;
  const fetchUsdMyrTavily = typeof deps?.fetchUsdMyrTavily === 'function' ? deps.fetchUsdMyrTavily : async () => null;
  const forceRepost = typeof deps?.forceRepost === 'function' ? deps.forceRepost : async () => true;
  const getTzNow = typeof deps?.getTzNow === 'function' ? deps.getTzNow : () => new Date();
  const formatYmd = typeof deps?.formatYmd === 'function' ? deps.formatYmd : () => '';
  const thresholdPct = Number(deps?.thresholdPct || 0.05);

  async function runOnce() {
    const at = new Date().toISOString();
    const lines = [];
    const actions = [];
    const redReasons = [];

    const env = getEnv() || {};
    const tavilyKey = String(env.TAVILY_API_KEY || '').trim();
    const dropboxToken = String(env.DROPBOX_TOKEN || '').trim();
    const tzNow = getTzNow();
    const todayYmd = String(formatYmd(tzNow) || '').trim();

    if (!tavilyKey) redReasons.push('TAVILY_API_KEY 失效/缺失');
    if (!dropboxToken) redReasons.push('DROPBOX_TOKEN 失效/缺失');

    lines.push(`🕯️ 状态：看门巡检轮询`);
    lines.push(`📌 结论：${redReasons.length ? '红色预警' : '正常'}`);

    let files = [];
    try {
      files = await listDir(cronDir);
    } catch {
      files = [];
    }

    const pairs = scanBriefPairs(files);
    const broken = pairs.filter((p) => Boolean(p.hasMd) !== Boolean(p.hasSent));
    if (broken.length) {
      const first = broken[0];
      actions.push(`📦 执行动作：归档完整性修复`);
      actions.push(`🧾 发现异常：${first.ymd} 早报文件不配对`);
      let ok = false;
      try {
        ok = await forceRepost(first.ymd);
      } catch {
        ok = false;
      }
      if (!ok) {
        redReasons.push(`Force Repost 失败（${first.ymd}）`);
      } else {
        actions.push(`✅ 自愈结果：已触发重发（${first.ymd}）`);
      }
    }

    let fxApi = null;
    let fxTv = null;
    if (!redReasons.length || (tavilyKey && dropboxToken)) {
      try {
        fxApi = await fetchUsdMyrApi();
      } catch {
        fxApi = null;
      }
      if (tavilyKey) {
        try {
          fxTv = await fetchUsdMyrTavily();
        } catch {
          fxTv = null;
        }
      }
    }

    const drift = fxApi != null && fxTv != null ? pctDiff(fxApi, fxTv) : null;
    if (drift != null) {
      lines.push(`💱 状态：汇率对账`);
      lines.push(`📉 偏差：${drift.toFixed(4)}%`);
      if (drift > thresholdPct) {
        actions.push('🧠 执行动作：银月分析');
        actions.push(`⚠️ 异常：偏差超过阈值 ${thresholdPct}%`);
        actions.push('🧾 核心事实：两路公开数据在同一时点存在偏差');
        actions.push('� 金融影响：跨境报价可能产生滑点与对账差异，建议统一口径并回写报价缓存');

        if (briefCachePath && Number.isFinite(Number(fxApi))) {
          try {
            const cache = (await readJson(briefCachePath)) || {};
            const next = { ...cache, fx: Number(fxApi), fxUpdatedAt: at, fxSource: 'open.er-api.com' };
            await writeJson(briefCachePath, next);
            actions.push(`✅ 自愈结果：已回写报价缓存（fx=${Number(fxApi).toFixed(6)}）`);
          } catch {
            redReasons.push('重写报价缓存失败');
          }
        } else {
          redReasons.push('重写报价缓存失败');
        }
      }
    } else if (fxApi != null) {
      lines.push('💱 状态：汇率对账');
      lines.push('🧪 结果：对账信息不足，已跳过偏差判定');
      if (tavilyKey) actions.push('🧪 执行动作：多轮检索后仍不足，暂不回写报价缓存');
    } else {
      lines.push('💱 状态：汇率对账');
      lines.push('🧪 结果：公开汇率源暂缺，维持现有报价缓存');
      actions.push('🧪 执行动作：保持现有报价缓存不变');
    }

    if (todayYmd) {
      const t = broken.find((p) => p.ymd === todayYmd);
      if (t && (Boolean(t.hasMd) !== Boolean(t.hasSent))) {
        redReasons.push(`今日归档仍不配对（${todayYmd}）`);
      }
    }

    const severity = redReasons.length ? 'red' : 'ok';
    const summary = severity === 'red' ? buildRedSummary(redReasons) : '正常';
    const shouldNotifyDiscord = severity === 'red';

    if (!actions.length) actions.push('🧾 执行动作：例行巡检（无需自愈）');
    if (severity === 'ok') actions.push('✅ 自愈结果：维持稳定');
    if (severity === 'red') actions.push(`🚨 自愈结果：失败（${summary}）`);

    return {
      severity,
      shouldNotifyDiscord,
      summary,
      at,
      lines,
      actions,
    };
  }

  return { runOnce, scanBriefPairs, pctDiff };
}

module.exports = { createShadowWatchdog };
