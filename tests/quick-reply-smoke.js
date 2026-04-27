/**
 * quick-reply-smoke.js — 快速回复机制专项测试
 * 验证 QUICK_REPLY_TABLE / tryQuickReply / _isDuplicate
 * 以及 stripBotTemplateLines 新增过滤正则
 * 用法: node tests/quick-reply-smoke.js
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label} — expected "${expected}", got "${actual}"`); }
}

// ─── 模拟 QUICK_REPLY_TABLE 逻辑 ───────────────────────────

const QUICK_REPLY_TABLE = [
  { patterns: [/^(在[吗嘛]|hi\b|hello|嗨|你好|嘿|喂|银月|在不在|睡了[吗嘛]|早安|晚安|早[上啊]?|下午好|晚上好)/i], replies: ['主人，银月在的～请说。', '在的，主人～', '主人请讲～'] },
  { patterns: [/^(好[的吧]?|ok\b|嗯|行|可以|没问题|收到|明白|了解|知道了|好的吧)/i], replies: ['好的，主人～', '明白，主人。', '收到！'] },
  { patterns: [/^(谢谢|多谢|感谢|辛苦了|thank|thanks|tq|thx)/i], replies: ['不客气，主人～', '应该的，主人。', '随时为您效劳，主人。'] },
  { patterns: [/^(拜拜|再见|bye|see\s*you|明天见|88)/i], replies: ['主人慢走～', '再见，主人～', '随时找我，主人。'] },
  { patterns: [/^(哈哈|haha|lol|笑死|有趣|好玩)/i], replies: ['主人开心就好～', '😊', '能逗主人一笑是我的荣幸～'] },
];

const _qrSentMap = new Map();
function _isDuplicate(channelId, text) {
  const key = `${channelId}:${String(text || '').slice(0, 30)}`;
  const now = Date.now();
  const prev = _qrSentMap.get(key);
  if (prev && now - prev < 5000) return true;
  _qrSentMap.set(key, now);
  for (const [k, v] of _qrSentMap) { if (now - v > 60000) _qrSentMap.delete(k); }
  return false;
}

function tryQuickReply(text, channelId) {
  const cleaned = String(text || '').trim().toLowerCase();
  if (!cleaned) return null;
  for (const entry of QUICK_REPLY_TABLE) {
    for (const re of entry.patterns) {
      if (re.test(cleaned)) {
        const reply = entry.replies[Math.floor(Math.random() * entry.replies.length)];
        if (_isDuplicate(channelId, reply)) return null;
        return reply;
      }
    }
  }
  return null;
}

// ─── 测试 ───────────────────────────────────────────────────

console.log('\n📦 [QUICK_REPLY_TABLE] 问候匹配测试');

// 中文问候
assert(tryQuickReply('在吗', 'ch1'), '在吗 → 匹配');
assert(tryQuickReply('在嘛', 'ch2'), '在嘛 → 匹配');
assert(tryQuickReply('嗨', 'ch3'), '嗨 → 匹配');
assert(tryQuickReply('你好', 'ch4'), '你好 → 匹配');
assert(tryQuickReply('晚安', 'ch5'), '晚安 → 匹配');
assert(tryQuickReply('早安', 'ch6'), '早安 → 匹配');
assert(tryQuickReply('银月', 'ch7'), '银月 → 匹配');
assert(tryQuickReply('在不在', 'ch8'), '在不在 → 匹配');

// 确认
assert(tryQuickReply('好的', 'ch9'), '好的 → 匹配');
assert(tryQuickReply('ok', 'ch10'), 'ok → 匹配');
assert(tryQuickReply('嗯', 'ch11'), '嗯 → 匹配');
assert(tryQuickReply('收到', 'ch12'), '收到 → 匹配');

// 感谢
assert(tryQuickReply('谢谢', 'ch13'), '谢谢 → 匹配');
assert(tryQuickReply('辛苦了', 'ch14'), '辛苦了 → 匹配');
assert(tryQuickReply('thanks', 'ch15'), 'thanks → 匹配');

// 告别
assert(tryQuickReply('拜拜', 'ch16'), '拜拜 → 匹配');
assert(tryQuickReply('bye', 'ch17'), 'bye → 匹配');
assert(tryQuickReply('明天见', 'ch18'), '明天见 → 匹配');

// 不应匹配的
assertEqual(tryQuickReply('今天天气怎么样', 'ch19'), null, '天气查询 → 不匹配');
assertEqual(tryQuickReply('帮我查一下比特币', 'ch20'), null, '比特币查询 → 不匹配');
assertEqual(tryQuickReply('分析一下这个', 'ch21'), null, '分析任务 → 不匹配');
assertEqual(tryQuickReply('写代码', 'ch22'), null, '写代码 → 不匹配');

// 防重复
const r1 = tryQuickReply('在吗', 'dup-channel');
assert(r1, '首次发送 → 有回复');
const r2 = tryQuickReply('在吗', 'dup-channel');
assertEqual(r2, null, '5秒内重复 → 被拦截');

// 不同频道不互相影响
const r3 = tryQuickReply('在吗', 'other-channel');
assert(r3, '不同频道 → 不受影响');

// ─── stripBotTemplateLines 新增正则测试 ─────────────────────

console.log('\n📦 [stripBotTemplateLines] 新增过滤正则测试');

const banned = [
  /【基座模型知识库】/,
  /【预测性分析】/,
  /【记忆线索】/,
  /追问[:：]/,
  /启发式追问/,
  /^◆\s*追问/,
];

function stripBannedLines(text) {
  return text.split('\n').filter(line => {
    for (const re of banned) {
      if (re.test(line)) return false;
    }
    return true;
  }).join('\n');
}

assertEqual(stripBannedLines('这是正常内容'), '这是正常内容', '正常内容保留');
assertEqual(stripBannedLines('【基座模型知识库】'), '', '过滤 【基座模型知识库】');
assertEqual(stripBannedLines('【预测性分析】'), '', '过滤 【预测性分析】');
assertEqual(stripBannedLines('【记忆线索】'), '', '过滤 【记忆线索】');
assertEqual(stripBannedLines('追问：你想知道什么'), '', '过滤 追问：');
assertEqual(stripBannedLines('追问:你想知道什么'), '', '过滤 追问:');
assertEqual(stripBannedLines('启发式追问'), '', '过滤 启发式追问');
assertEqual(stripBannedLines('◆ 追问'), '', '过滤 ◆ 追问');
assertEqual(stripBannedLines('正常行\n【基座模型知识库】\n正常行'), '正常行\n正常行', '混合内容只过滤标签行');

// ─── 汇总 ───────────────────────────────────────────────────

console.log(`\n${'='.repeat(40)}`);
console.log(`总测试: ${passed + failed}`);
console.log(`通过:   ${passed}`);
console.log(`失败:   ${failed}`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
