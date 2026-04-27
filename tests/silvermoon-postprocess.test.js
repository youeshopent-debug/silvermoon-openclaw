const assert = require('assert');

async function run() {
  const { postprocessSilvermoonReply } = require('../lib/silvermoon-postprocess');
  assert.equal(typeof postprocessSilvermoonReply, 'function');

  {
    const raw = [
      '✅ 主人',
      '🔹 结论：由于工具不可用，无法直接提供 RWA 领域的新动向信息。',
      '🔹 建议：请提供更多关键词。',
    ].join('\n');
    const memSearch = () => ({ ok: true, items: [{ uid: 'm1', snippet: '2026-04-16 已部署到 Vercel，Next.js 项目进入验收。' }] });
    const out = postprocessSilvermoonReply({
      replyText: raw,
      userText: 'rwa领域有什么新动向吗？',
      channelId: 'c1',
      memorySearch: memSearch,
    });
    assert.equal(out.includes('工具不可用'), false);
    assert.equal(out.includes('无法直接提供'), false);
    assert.equal(/快速发展的领域|基于知识库显示|基于基座模型知识库|由于外部检索未回传证据/.test(out), false);
    assert.equal(/Vercel|Next\.js|RWA/i.test(out), true);
    assert.equal(/[？?]/.test(out), true);
  }

  {
    const raw = [
      '✅ 主人',
      '🔹 结论：由于工具不可用，无法直接提供 RWA 领域的新动向信息。',
    ].join('\n');
    const memSearch = () => ({ ok: true, items: [{ uid: 'm1', snippet: '2026-04-16 已部署到 Vercel，Next.js 项目进入验收。' }] });
    const out = postprocessSilvermoonReply({
      replyText: raw,
      userText: 'RWA 合规有什么变化？',
      channelId: 'c1',
      memorySearch: memSearch,
    });
    assert.equal(out.includes('虽然实时新闻接口超时，但根据我记得的您之前的 Vercel 部署进度，我建议'), true);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
