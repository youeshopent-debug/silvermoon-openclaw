'use strict';

const emotionAi = require('./emotion-ai');
const thinkingEngine = require('./thinking-engine');
const humanizer = require('./humanizer');
const fs = require('fs');
const path = require('path');

const MEM_DIR = path.join(__dirname, '..', '.silvermoon_core', 'mind_memory');
const MEM_FILE = path.join(MEM_DIR, 'state.json');

function ensureDir() {
  if (!fs.existsSync(MEM_DIR)) {
    fs.mkdirSync(MEM_DIR, { recursive: true });
  }
}

function loadState() {
  ensureDir();
  try {
    if (fs.existsSync(MEM_FILE)) {
      return JSON.parse(fs.readFileSync(MEM_FILE, 'utf8'));
    }
  } catch {}
  return { interactions: 0, lastMode: 'casual', lastEmotion: 'neutral' };
}

function saveState(state) {
  ensureDir();
  fs.writeFileSync(MEM_FILE, JSON.stringify(state, null, 2), 'utf8');
}

let _state = loadState();
function getState() { return _state; }

function processInput(userText, channelId) {
  const text = String(userText || '');
  const state = getState();

  const emotionResult = emotionAi.recordEmotion(channelId || 'default', text);
  state.lastEmotion = emotionResult.primary;

  const modeResult = thinkingEngine.determineMode(text);
  state.lastMode = modeResult.mode;

  state.interactions = (state.interactions || 0) + 1;
  saveState(state);

  return {
    emotion: emotionResult,
    mode: modeResult.mode,
    modeReason: modeResult.reason,
  };
}

function buildSystemPromptBlock(userText, channelId) {
  const text = String(userText || '');
  const state = getState();
  const emotionResult = state.lastEmotion
    ? { primary: state.lastEmotion, intensity: 0.5 }
    : emotionAi.analyzeEmotion(text);

  const modeResult = thinkingEngine.determineMode(text);

  const blocks = [];

  blocks.push(thinkingEngine.buildThinkingBlock(modeResult.mode, text, emotionResult));

  const emotionBlock = emotionAi.buildEmotionBlock(text);
  if (emotionBlock) blocks.push(emotionBlock);

  const summary = emotionAi.getEmotionSummary();
  if (summary) blocks.push(summary);

  blocks.push(thinkingEngine.buildExecutiveOverride(modeResult.mode));

  return {
    block: blocks.join('\n\n'),
    mode: modeResult.mode,
    emotion: emotionResult,
  };
}

function processReply(userText, reply, channelId, mode) {
  const modeToUse = mode || getState().lastMode || 'casual';
  const emotionAnalysis = emotionAi.analyzeEmotion(userText || '');
  let result = String(reply || '');

  if (humanizer.shouldUseHumanizer(modeToUse)) {
    result = humanizer.humanize(result, emotionAnalysis, modeToUse);
  }

  return result;
}

function getModeInfo() {
  const state = getState();
  return {
    currentMode: state.lastMode || 'casual',
    lastEmotion: state.lastEmotion || 'neutral',
    interactions: state.interactions || 0,
    modeDescriptions: {
      empathetic: '共情模式：优先感知和回应主人的情绪',
      casual: '聊天模式：放松自然的日常交流',
      executive: '执行模式：快速执行工具指令',
      deep: '深度思考模式：深入分析复杂问题',
    },
  };
}

module.exports = {
  processInput,
  buildSystemPromptBlock,
  processReply,
  getModeInfo,
  getState,
};
