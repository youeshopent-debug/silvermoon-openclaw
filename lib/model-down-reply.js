function hash32(s) {
  const str = String(s || '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  const a = Array.isArray(arr) ? arr : [];
  if (!a.length) return '';
  const idx = Number(seed || 0) % a.length;
  return a[idx];
}

function sanitize(s) {
  const t = String(s || '');
  return t.replace(/127\.0\.0\.1:11434/g, '').replace(/\s{2,}/g, ' ').trim();
}

function renderModelDownReply({ raw, isPing, userText }) {
  const r = sanitize(raw);
  const u = String(userText || '').trim();
  const seed = hash32(`${u}|${r}`);

  if (isPing) {
    return pick(
      [
        '在呢🙂 我没掉线，只是外部通道刚刚抖了一下。我继续听你说。',
        '我在🙂 刚才通道有点不稳，但我还在这儿。你把问题直接丢过来。',
        '在的🙂 刚刚外部脑抽了一下，我已经切备用了。你继续说。',
      ],
      seed,
    );
  }

  if (/查|搜索|最新|资料|news|search/i.test(u)) {
    return [
      '我明白。',
      '刚才外部通道不稳定，导致我没能把“搜索结果”带回来。',
      '我现在改用备用检索路径继续查，给我一句更具体的关键词（例如：方向/公司/论文/融资/模型名）。',
    ].join('\n');
  }

  return pick(
    [
      '我知道你在等我把事办成。',
      '刚才外部通道不稳，我没有在装懂。',
      '你把问题再说一遍，我会直接给结论与动作。',
    ].join('\n'),
    seed,
  );
}

module.exports = { renderModelDownReply };

