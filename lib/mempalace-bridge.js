const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEMPALACE_DIR = path.join(__dirname, '..', 'workspace', 'TOOLS', 'mempalace');
const INTEGRATIONS_DIR = path.join(MEMPALACE_DIR, 'integrations', 'openclaw');
const SHARED_MEM_DIR = path.join(__dirname, '..', 'workspace', 'AGENTS_SOUL', 'shared');

if (!fs.existsSync(SHARED_MEM_DIR)) {
  fs.mkdirSync(SHARED_MEM_DIR, { recursive: true });
}

/**
 * MemPalace 桥接模块
 * 
 * 为银月钱庄全体 Agent 提供本地优先的语义记忆存储与检索能力。
 * 基于 MemPalace 的 OpenClaw 原生集成（integrations/openclaw/SKILL.md）。
 */
class MemPalaceBridge {
  constructor() {
    this.ready = fs.existsSync(MEMPALACE_DIR);
  }

  /**
   * 检查 MemPalace 是否可用
   */
  isAvailable() {
    return this.ready;
  }

  /**
   * 将内容存入 Agent 的记忆 wing
   * @param {string} agentId - Agent ID
   * @param {string} content - 要存储的内容
   * @param {string} room - 房间分类（如 trades, code, decisions）
   */
  async store(agentId, content, room = 'general') {
    if (!this.ready) return { ok: false, reason: 'MemPalace not installed' };
    const wingDir = path.join(SHARED_MEM_DIR, agentId, room);
    if (!fs.existsSync(wingDir)) {
      fs.mkdirSync(wingDir, { recursive: true });
    }
    const fileName = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.md`;
    const filePath = path.join(wingDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, file: fileName };
  }

  /**
   * 从 Agent 的记忆 wing 检索内容
   * @param {string} agentId - Agent ID
   * @param {string} query - 搜索关键词
   * @param {number} limit - 返回结果数量上限
   */
  async search(agentId, query, limit = 5) {
    if (!this.ready) return { ok: false, reason: 'MemPalace not installed' };
    const wingDir = path.join(SHARED_MEM_DIR, agentId);
    if (!fs.existsSync(wingDir)) return { ok: true, results: [] };

    const results = [];
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              file: path.relative(wingDir, fullPath),
              content: content.slice(0, 500),
              modifiedAt: fs.statSync(fullPath).mtime,
            });
          }
        }
      }
    };
    walkDir(wingDir);
    results.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return { ok: true, results: results.slice(0, limit) };
  }

  /**
   * 初始化 Agent 的 MemPalace wing
   * @param {string} agentId - Agent ID
   * @param {string} displayName - 显示名称
   */
  async initAgentWing(agentId, displayName) {
    if (!this.ready) return { ok: false, reason: 'MemPalace not installed' };
    const wingDir = path.join(SHARED_MEM_DIR, agentId);
    const rooms = ['general', 'trades', 'code', 'decisions', 'reflections'];
    for (const room of rooms) {
      const roomDir = path.join(wingDir, room);
      if (!fs.existsSync(roomDir)) {
        fs.mkdirSync(roomDir, { recursive: true });
      }
    }
    const initContent = [
      `# ${displayName} (${agentId}) - MemPalace Wing`,
      '',
      `初始化时间: ${new Date().toISOString()}`,
      '',
      '## 房间结构',
      '- general: 通用记忆',
      '- trades: 交易记录（萧炎专用）',
      '- code: 代码变更记录',
      '- decisions: 决策记录',
      '- reflections: 任务反思',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(wingDir, 'README.md'), initContent, 'utf8');
    return { ok: true, agentId, displayName };
  }

  /**
   * 跨 Agent 共享记忆（内部会议）
   * @param {string} topic - 会议主题
   * @param {string[]} participants - 参与 Agent ID 列表
   * @param {string} content - 会议内容
   */
  async meeting(topic, participants, content) {
    if (!this.ready) return { ok: false, reason: 'MemPalace not installed' };
    const meetingDir = path.join(SHARED_MEM_DIR, '_meetings');
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true });
    }
    const fileName = `meeting_${Date.now()}_${topic.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.md`;
    const filePath = path.join(meetingDir, fileName);
    const meetingContent = [
      `# 内部会议: ${topic}`,
      '',
      `时间: ${new Date().toISOString()}`,
      `参与: ${participants.join(', ')}`,
      '',
      '---',
      '',
      content,
      '',
      '---',
      '*会议记录自动归档*',
    ].join('\n');
    fs.writeFileSync(filePath, meetingContent, 'utf8');
    return { ok: true, file: fileName };
  }
}

module.exports = new MemPalaceBridge();
