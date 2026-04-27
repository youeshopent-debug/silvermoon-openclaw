const _workflows = new Map();

function getTaskTemplate(type, lang) {
  if (type === 'development') {
    return [
      { step: 'analyze', label: lang === 'en' ? 'Analyzing requirements...' : '分析需求...' },
      { step: 'plan', label: lang === 'en' ? 'Planning solution...' : '规划方案...' },
      { step: 'execute', label: lang === 'en' ? 'Executing...' : '执行中...' },
      { step: 'verify', label: lang === 'en' ? 'Verifying...' : '验证中...' },
    ];
  }
  return [];
}

function createWorkflow(id, steps, lang, opts) {
  _workflows.set(id, {
    steps: steps || [],
    current: 0,
    title: opts?.title || '',
    createdAt: Date.now(),
  });
}

function renderProgress(id) {
  const wf = _workflows.get(id);
  if (!wf || wf.steps.length === 0) return null;
  const done = wf.steps.slice(0, wf.current).map((s) => `✅ ${s.label}`).join('\n');
  const next = wf.steps[wf.current] ? `⏳ ${wf.steps[wf.current].label}` : '';
  return [done, next].filter(Boolean).join('\n');
}

function advanceWorkflow(id) {
  const wf = _workflows.get(id);
  if (!wf) return;
  wf.current = Math.min(wf.current + 1, wf.steps.length);
}

module.exports = { getTaskTemplate, createWorkflow, renderProgress, advanceWorkflow };
