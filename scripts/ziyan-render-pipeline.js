const fs = require('fs');
const path = require('path');
const shared = require('./pipeline-shared');

function readDispatchEntries(target, since) {
  if (!fs.existsSync(shared.DISPATCH_FILE)) return [];
  const raw = fs.readFileSync(shared.DISPATCH_FILE, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  const sinceTs = since || new Date(new Date().setHours(0,0,0,0)).toISOString();
  return lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .filter(e => e.target === target && e.at >= sinceTs)
    .sort((a, b) => a.at.localeCompare(b.at));
}

function generateRenderParams(scriptsText) {
  if (!scriptsText || scriptsText.trim().length === 0) {
    return {
      scenes: [],
      totalDuration: 0,
      voice: 'en-US-JennyNeural',
      subtitle: true,
      background: '#0A0A0A',
      note: '无小医仙脚本输入，生成默认占位渲染'
    };
  }

  const scenes = [];
  const lines = scriptsText.split('\n').filter(Boolean);
  let currentScene = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\d+[:：]\s*/.test(trimmed) || trimmed.startsWith('Scene') || trimmed.startsWith('【')) {
      if (currentScene) scenes.push(currentScene);
      currentScene = { description: trimmed.replace(/^\d+[:：]\s*/, ''), duration: 15, effects: [], overlay: '' };
      continue;
    }

    if (trimmed.toLowerCase().includes('hook') || trimmed.toLowerCase().includes('open') || trimmed.toLowerCase().includes('intro')) {
      if (currentScene) currentScene.effects.push('zoom_in');
    }
    if (trimmed.toLowerCase().includes('product') || trimmed.toLowerCase().includes('close-up') || trimmed.toLowerCase().includes('closeup')) {
      if (currentScene) currentScene.effects.push('product_highlight');
    }
    if (trimmed.toLowerCase().includes('cta') || trimmed.toLowerCase().includes('outro') || trimmed.toLowerCase().includes('subscribe')) {
      if (currentScene) currentScene.effects.push('cta_overlay');
    }
    if (trimmed.startsWith('#')) {
      if (currentScene) currentScene.overlay = trimmed;
    }

    const durMatch = trimmed.match(/(\d+)\s*(?:sec|s|秒)/i);
    if (durMatch && currentScene) {
      currentScene.duration = parseInt(durMatch[1], 10);
    }
  }
  if (currentScene) scenes.push(currentScene);

  if (scenes.length === 0) {
    return {
      scenes: [{ description: '全脚本合成', duration: Math.min(60, lines.length * 3), effects: ['digital_human'], overlay: '' }],
      totalDuration: Math.min(60, lines.length * 3),
      voice: 'en-US-JennyNeural',
      subtitle: true,
      background: '#0A0A0A'
    };
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  return { scenes, totalDuration, voice: 'en-US-JennyNeural', subtitle: true, background: '#0A0A0A' };
}

function run({ dryRun = false } = {}) {
  const xiaoyiOutput = shared.readStageOutput('小医仙');
  let scriptsText = null;

  if (xiaoyiOutput && xiaoyiOutput.scripts) {
    scriptsText = xiaoyiOutput.scripts;
  } else {
    const xiaoyiDispatchEntries = readDispatchEntries('小医仙');
    const consumed = xiaoyiDispatchEntries.filter(e => e.status === 'consumed');
    if (consumed.length > 0) {
      scriptsText = consumed[consumed.length - 1].task;
    }
  }

  const renderParams = generateRenderParams(scriptsText);

  const result = {
    ok: true,
    dryRun,
    hasScriptInput: !!scriptsText,
    scriptSource: xiaoyiOutput ? 'pipeline_stages/小医仙' : (scriptsText ? 'dispatched_tasks' : 'none'),
    render: renderParams,
    stageOutput: shared.writeStageOutput('紫妍', { ...renderParams, generatedAt: new Date().toISOString() })
  };

  if (!dryRun && scriptsText) {
    const summary = `🎬 **紫妍 · 今日渲染参数**\n`
      + `- 场景数: ${renderParams.scenes.length}\n`
      + `- 总时长: ${renderParams.totalDuration} 秒\n`
      + `- 配音: ${renderParams.voice}\n`
      + `- 字幕: ${renderParams.subtitle ? '开启' : '关闭'}\n`
      + `- 背景色: ${renderParams.background}\n`;
    shared.writeDispatchEntry('银月', `【夜报素材】\n${summary}\n请归档至今日夜报`, 'medium', '紫妍');
  }

  return result;
}

if (require.main === module) {
  const dryRun = !process.argv.includes('--live');
  const r = run({ dryRun });
  console.log(JSON.stringify(r, null, 2));
}

module.exports = { run, generateRenderParams, readDispatchEntries };
