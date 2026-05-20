const MAX_TOPIC_LEN = 150;
const MAX_PREVIEW_LEN = 300;

function getState() {
  return global.STATE || (global.STATE = {});
}

function updateAnchor(channelId, topic, action, responsePreview) {
  if (!channelId) return;
  const state = getState();
  if (!state._anchors) state._anchors = {};
  state._anchors[channelId] = {
    topic: String(topic || '').slice(0, MAX_TOPIC_LEN),
    action: String(action || '').slice(0, MAX_TOPIC_LEN),
    preview: String(responsePreview || '').slice(0, MAX_PREVIEW_LEN),
    updatedAt: Date.now()
  };
}

function getAnchorBlock(channelId) {
  if (!channelId) return '';
  const state = getState();
  const a = state._anchors?.[channelId];
  if (!a) return '';
  const lines = [
    '【当前对话锚定】',
    a.topic ? `- 正在处理的话题：${a.topic}` : '',
    a.action ? `- 银月上一轮的动作：${a.action}` : '',
    a.preview ? `- 上一轮回复摘要：${a.preview}` : '',
    '',
    '规则：用户的短承接语（"看到了吗""然后呢""还有呢"等）必须基于上方锚定解读话题，不得当作独立新问题。',
  ];
  return lines.filter(Boolean).join('\n');
}

function getAnchorJson(channelId) {
  if (!channelId) return null;
  const state = getState();
  return state._anchors?.[channelId] || null;
}

module.exports = { updateAnchor, getAnchorBlock, getAnchorJson };
