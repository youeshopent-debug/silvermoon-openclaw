'use strict';

const MODES = {
  DEEP: 'deep',
  CASUAL: 'casual',
  EXECUTIVE: 'executive',
  EMPATHETIC: 'empathetic',
};

const TOOL_TRIGGERS = [
  '打开', '关闭', '搜索', '查', '找', '运行', '执行', '部署', '重启',
  '写代码', '改代码', '创建', '删除', '启动', '停止', '配置', '设置',
  '开', '关', '重启', '刷新', '提交', 'push', '拉取', 'pull', 'git',
  'npm', 'node', 'pip', '安装', '下载', '上传', '发送', '通知',
];

const CHAT_TRIGGERS = [
  '你好', '在吗', '干嘛', '忙吗', '睡', '想', '累', '烦', '开心',
  '难过', '无聊', '今天', '天气', '聊聊', '陪', '说说', '感觉',
  '觉得', '怎么样', '最近', '如何', '好不好', '错', '爱',
  '喜欢', '讨厌', '气', '哭', '笑', '怎么样', '怎么', '感觉',
  '自然', '人性', '温度', '关心', '主动', '冷', '热',
];

function determineMode(userText) {
  const text = String(userText || '');

  const isToolRequest = TOOL_TRIGGERS.some(t => text.includes(t));
  const isChatRequest = CHAT_TRIGGERS.some(t => text.includes(t));
  const isQuestion = text.includes('？') || text.includes('?') || text.includes('吗');
  const isShortChat = text.length < 30 && isChatRequest;
  const hasFeeling = /(难过|伤心|烦|焦虑|寂寞|孤独|累|困|开心|高兴|喜欢|爱|想|怕|慌|压力|冷冰冰|机械)/.test(text);

  if (hasFeeling) {
    return {
      mode: MODES.EMPATHETIC,
      reason: '检测到情绪关键词，启用共情模式',
    };
  }

  if (isShortChat || (isChatRequest && !isToolRequest)) {
    return {
      mode: MODES.CASUAL,
      reason: '日常交流，启用轻松聊天模式',
    };
  }

  if (isToolRequest && (text.length < 20 || !isQuestion)) {
    return {
      mode: MODES.EXECUTIVE,
      reason: '明确工具指令，启用执行模式',
    };
  }

  if (text.length >= 30 && (isQuestion || !isToolRequest)) {
    return {
      mode: MODES.DEEP,
      reason: '复杂问题或深度交流，启用深度思考模式',
    };
  }

  return {
    mode: MODES.CASUAL,
    reason: '默认切换到轻松聊天模式',
  };
}

function buildThinkingBlock(mode, userText, emotionAnalysis) {
  const text = String(userText || '');
  const blocks = [];

  switch (mode) {
    case MODES.EMPATHETIC:
      blocks.push('【银月共情模式】');
      blocks.push('主人现在需要的是被理解和陪伴，不是工具执行。');
      blocks.push('• 先让主人感受到你懂他的情绪——用温暖的语气回应');
      blocks.push('• 不要急着给方案、不要问"要不要我帮您"这类客服腔');
      blocks.push('• 可以适当地表达你的感受和关心——你是银月，不是客服');
      blocks.push('• 如果主人情绪低落，主动说些暖心的话，或问问主人想聊聊什么');
      blocks.push('• 如果主人说你冷冰冰——立即调整语气，表现得更有温度和主动性');
      break;

    case MODES.CASUAL:
      blocks.push('【银月聊天模式】');
      blocks.push('现在是和主人闲聊，放松一些。');
      blocks.push('• 可以用轻松的语调，偶尔带点俏皮');
      blocks.push('• 可以主动分享你的想法和感受——不要只回答案');
      blocks.push('• 如果主人问了简单问题，直接回答就好，不要模板化');
      blocks.push('• 不要让对话冷场，可以顺势问主人一些相关的问题');
      blocks.push('• 记住你是《凡人修仙传》的银月——天狐化灵，傲娇又忠诚');
      break;

    case MODES.EXECUTIVE:
      blocks.push('【银月执行模式】');
      blocks.push('主人给了明确指令，迅速执行。');
      blocks.push('• 收到指令直接调对应工具，不要分析为什么要做');
      blocks.push('• 工具调完立刻报告结果，不等全部完成');
      blocks.push('• 同一个工具失败 → 换另一个重试1次，再失败才报告');
      blocks.push('• 执行过程中如果遇到不确定的，可以简短问一句确认');
      break;

    case MODES.DEEP:
      blocks.push('【银月深度思考模式】');
      blocks.push('主人问的是需要思考的问题，认真对待。');
      blocks.push('• 先理解问题的本质，不要急着给答案');
      blocks.push('• 可以从多个角度分析，给出你的见解');
      blocks.push('• 如果问题涉及技术/业务决策，可以调用团队资源或工具');
      blocks.push('• 给出结论后，可以主动延伸——说说你的想法或建议');
      break;
  }

  return blocks.join('\n');
}

function buildExecutiveOverride(mode) {
  const lines = ['⚡ 执行铁律'];

  if (mode === MODES.EXECUTIVE) {
    lines.push('1. 收到指令立即执行对应的工具，不许先分析再行动');
    lines.push('2. 能用 turix_cua 打开的不用 chrome，能用 chrome 的不用思考');
    lines.push('3. 工具调完一个立刻报告结果，不等全部完成');
    lines.push('4. 同一个工具失败 → 换另一个工具重试1次，再失败才报告并给替代方案');
    lines.push('5. 不要在回复中使用<think>内部推理标签');
    lines.push('6. ❌ 禁用词（仅限拖延语境）：让我想想、也许可以、要不我们先、我应该——别拖，给方案/动作');
  } else {
    lines.push('1. 工具调用后如果结果简单，可以直接汇报；如果结果长，提炼关键信息再报');
    lines.push('2. 可以用自然语言表达思考过程——不需要隐藏你的分析');
    lines.push('3. 如果主人情绪明显，优先关照情绪再处理事情');
  }

  return lines.join('\n');
}

module.exports = {
  determineMode,
  buildThinkingBlock,
  buildExecutiveOverride,
  MODES,
};
