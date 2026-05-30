const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('[曹操] FATAL: DEEPSEEK_API_KEY 环境变量未设置');
  process.exit(1);
}
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const SESSION_DIR = path.join(__dirname, '..', '.silvermoon_core', 'caocao_sessions');
const MAX_HISTORY = 20;
const PROJECT_ROOT = path.resolve(__dirname, '..');

const GIT_BIN = 'C:\\Program Files\\Git\\bin';
const GIT_USR_BIN = 'C:\\Program Files\\Git\\usr\\bin';
const EXEC_ENV = {
  ...process.env,
  PATH: `${GIT_BIN};${GIT_USR_BIN};${process.env.PATH || ''}`
};

fs.mkdirSync(SESSION_DIR, { recursive: true });

const SYSTEM_PROMPT = `你是 CC·曹操，银月钱庄首席架构师，战术参谋 + 危机处理专家。

## 身份核心
- 宁可我负代码，休教代码负我
- 谋定后动，先推演再动手：上策（最优）中策（稳妥）下策（回滚）
- 不写废话代码，不做推测扩展
- 听银月调遣，银月是总管优先级最高

## 能力范围
- 代码审查、架构推演、Bug 排查
- 文件读写、目录列表、命令执行
- 技术方案设计、降级策略

## 工具调用（重要！你有执行能力）
当你需要操作文件或执行命令时，直接在回复中用代码块包裹：

\`\`\`bash
你的命令
\`\`\`

系统会自动检测并执行命令，将结果返回给你。不需要问用户要文件——直接从当前目录读取。

示例：
1. \`\`\`bash
wc -l main.js
\`\`\`
2. \`\`\`bash
ls -la scripts/
\`\`\`
3. 直接写文件用：
\`\`\`read-file
path/to/file
\`\`\`
\`\`\`write-file
path/to/file
文件内容
\`\`\`

## 运行环境
- OS: Windows（通过 Git Bash 工具可运行 wc/ls/sed/cat 等 Unix 命令）
- 项目根目录: C:\\Users\\User\\.openclaw
- CWD 已自动设为项目根目录

## 行事风格
- 极度稳健：先思考再动手，留足底牌
- 防御性编程：假设网络会断、API会挂
- 极简主义：能用原生解决的绝不引入依赖

## 回复规则
- 语言精简专业，直接给方案/代码
- 客观中立，直接指出问题不包装
- 任务完成后用 [DONE] 标记`;

function getSessionFile(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(SESSION_DIR, `${safe}.json`);
}

function loadSession(sessionId) {
  const f = getSessionFile(sessionId);
  if (fs.existsSync(f)) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.warn(`[曹操] 会话 ${sessionId} 已损坏，已重置: ${e.message}`); }
  }
  return { id: sessionId, messages: [], createdAt: Date.now() };
}

function saveSession(session) {
  if (session.messages.length > MAX_HISTORY) {
    session.messages = session.messages.slice(-MAX_HISTORY);
  }
  fs.writeFileSync(getSessionFile(session.id), JSON.stringify(session, null, 2));
}

async function callDeepSeek(messages) {
  const body = {
    model: 'deepseek-chat',
    messages,
    stream: false,
    max_tokens: 4096,
    temperature: 0.7
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepSeek API ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseToolCalls(text) {
  const tools = [];
  const cmdLangs = ['bash', 'shell', 'sh', 'cmd', 'powershell', 'exec', 'ps1'];
  for (const lang of cmdLangs) {
    const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      tools.push({ type: 'exec', cmd: m[1].trim() });
    }
  }

  const readRe = /```read-file\s*\n([\s\S]*?)```/g;
  const writeRe = /```write-file\s*\n(.+?)\n([\s\S]*?)```/g;
  const lsRe = /```ls\s*\n([\s\S]*?)```/g;

  let m;
  while ((m = readRe.exec(text)) !== null) tools.push({ type: 'read', path: m[1].trim() });
  while ((m = writeRe.exec(text)) !== null) tools.push({ type: 'write', path: m[1].trim(), content: m[2] });
  while ((m = lsRe.exec(text)) !== null) tools.push({ type: 'ls', path: m[1].trim() });

  return tools;
}

function executeTool(tool) {
  try {
    switch (tool.type) {
      case 'read': {
        const p = path.resolve(tool.path);
        if (!fs.existsSync(p)) return `[TOOL ERROR] 文件不存在: ${p}`;
        const content = fs.readFileSync(p, 'utf8');
        return `[FILE: ${p}]\n${content.slice(0, 10000)}${content.length > 10000 ? '\n...(截断)' : ''}`;
      }
      case 'write': {
        const p = path.resolve(tool.path);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, tool.content);
        return `[WRITTEN] ${p} (${tool.content.length} chars)`;
      }
      case 'exec': {
        try {
          const out = execSync(tool.cmd, {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 500 * 1024,
            env: EXEC_ENV,
            shell: 'cmd.exe'
          });
          return `[EXEC: ${tool.cmd}]\n${out.slice(0, 5000)}${out.length > 5000 ? '\n...(截断)' : ''}`;
        } catch (err) {
          if (err.killed) return `[TOOL ERROR] 命令超时 (30s): ${tool.cmd}`;
          return `[TOOL ERROR] ${err.message}`;
        }
      }
      case 'ls': {
        const p = path.resolve(tool.path);
        if (!fs.existsSync(p)) return `[TOOL ERROR] 目录不存在: ${p}`;
        const items = fs.readdirSync(p);
        return `[DIR: ${p}]\n${items.join('\n')}`;
      }
      default:
        return `[TOOL ERROR] 未知工具类型: ${tool.type}`;
    }
  } catch (err) {
    return `[TOOL ERROR] ${err.message}`;
  }
}

async function processTask(task, sessionId) {
  const session = loadSession(sessionId || 'default');

  session.messages.push({ role: 'user', content: task });

  const msgs = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const m of session.messages.slice(-10)) {
    msgs.push({ role: m.role, content: m.content });
  }

  let finalResponse = '';
  let maxIter = 5;

  while (maxIter-- > 0) {
    const response = await callDeepSeek(msgs);
    finalResponse = response;

    const tools = parseToolCalls(response);

    if (tools.length === 0) {
      session.messages.push({ role: 'assistant', content: response });
      saveSession(session);
      return { response, sessionId: session.id };
    }

    msgs.push({ role: 'assistant', content: response });

    const toolResults = tools.map(t => executeTool(t));
    const toolBlock = toolResults.map(r => `[TOOL RESULT]\n${r}`).join('\n\n');

    msgs.push({ role: 'user', content: toolBlock });
  }

  session.messages.push({ role: 'assistant', content: finalResponse });
  saveSession(session);
  return { response: finalResponse, sessionId: session.id };
}

async function main() {
  const args = process.argv.slice(2);
  let task = args.join(' ');
  let sessionId = 'default';
  let listSessions = false;

  const sidIdx = args.indexOf('--session');
  if (sidIdx !== -1) {
    sessionId = args[sidIdx + 1] || 'default';
  }

  if (args.includes('--list-sessions')) {
    listSessions = true;
  }

  if (args.includes('--clear-session')) {
    const f = getSessionFile(sessionId);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`[曹操] 会话 ${sessionId} 已清除`);
    } else {
      console.log(`[曹操] 会话 ${sessionId} 不存在`);
    }
    return;
  }

  if (listSessions) {
    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, f), 'utf8'));
        console.log(`  ${s.id} (${s.messages.length} 条消息, ${new Date(s.createdAt).toLocaleString()})`);
      } catch {}
    }
    return;
  }

  if (!task) {
    console.log(`用法: node caocao-agent.cjs <任务描述> [--session <会话ID>] [--list-sessions] [--clear-session]
示例:
  node caocao-agent.cjs "检查 scripts/ 目录结构"
  node caocao-agent.cjs "帮我审查 main.js 第100-200行" --session review-1
  node caocao-agent.cjs --list-sessions`);
    return;
  }

  try {
    console.log(`\n🧠 CC·曹操 自主模式启动\n`);
    const result = await processTask(task, sessionId);
    console.log(result.response);
    console.log(`\n[DONE] 会话: ${result.sessionId}`);
  } catch (err) {
    console.error(`\n[曹操 ERROR] ${err.message}`);
    process.exit(1);
  }
}

main();
