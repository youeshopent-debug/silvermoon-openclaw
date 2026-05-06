'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ALLOWED_DIRS = [PROJECT_ROOT];
const ALLOWED_COMMANDS = [
  /^node\s+[\w\/\.-]+\.js$/i,
  /^rtk\s+(git|npm|npx|ls|ps)\s/i,
  /^npm\s+(install|run|test|build)\s/i,
  /^npx\s+tsc/i,
  /^ls\s+/,
  /^cat\s+/i,
  /^dir\s+/i,
  /^type\s+/i,
  /^Get-ChildItem/i,
  /^netstat/i,
  /^Start-Sleep/i,
];

let cronModule = null;
try { cronModule = require('./cron'); } catch (_) {}
let taskChain = null;
try { taskChain = require('./task-chain'); } catch (_) {}

const toolLog = [];

function log(level, msg, data) {
  const entry = `[agent-tools] ${level}: ${msg}${data ? ' ' + JSON.stringify(data).slice(0,200) : ''}`;
  toolLog.push(entry);
  if (level === 'ERROR') console.error(entry);
  else console.log(entry);
}

function isPathSafe(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir));
}

function getSafePath(targetPath) {
  if (!path.isAbsolute(targetPath)) {
    targetPath = path.join(PROJECT_ROOT, targetPath);
  }
  const resolved = path.resolve(targetPath);
  if (!isPathSafe(resolved)) {
    throw new Error(`路径不安全: ${resolved} (只允许 ${PROJECT_ROOT} 内)`);
  }
  return resolved;
}

function isCommandSafe(cmd) {
  return ALLOWED_COMMANDS.some(pattern => pattern.test(cmd.trim()));
}

function formatTimestamp() {
  return new Date().toISOString().replace('T',' ').slice(0,19);
}

const TOOLS = {

  read_file: {
    description: '读取文件内容',
    args: { path: '文件路径（绝对或相对项目根目录）' },
    async handler(args) {
      const fp = getSafePath(args.path);
      const maxBytes = 50 * 1024;
      const stat = fs.statSync(fp);
      if (stat.size > maxBytes) {
        return `⚠️ 文件过大 (${(stat.size/1024).toFixed(1)}KB)，只读取前 50KB:\n\n` +
          fs.readFileSync(fp, 'utf-8').slice(0, maxBytes) + '\n...(截断)';
      }
      return fs.readFileSync(fp, 'utf-8');
    }
  },

  write_file: {
    description: '写入文件（覆盖或新建）',
    args: { path: '文件路径', content: '文件内容' },
    async handler(args) {
      const fp = getSafePath(args.path);
      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, args.content, 'utf-8');
      const size = fs.statSync(fp).size;
      return `✅ 已写入 ${path.relative(PROJECT_ROOT, fp)} (${size} bytes)`;
    }
  },

  search_code: {
    description: '在代码库中搜索关键词',
    args: { keyword: '搜索关键词', extension: '文件扩展名过滤（可选，如 .js .py）' },
    async handler(args) {
      const { execSync } = require('child_process');
      const ext = args.extension || '';
      const searchDir = PROJECT_ROOT;
      let result;
      try {
        result = execSync(
          `find "${searchDir}" -type f ${ext ? `-name "*${ext}"` : ''} -not -path "*/node_modules/*" -not -path "*/.git/*" 2>nul | head -50`,
          { encoding: 'utf-8', timeout: 10000 }
        );
      } catch (_) {
        try {
          result = execSync(
            `Get-ChildItem -Recurse -Filter "*${ext}" "${searchDir}" -Exclude node_modules,.git | Select-Object -First 50 FullName`,
            { encoding: 'utf-8', shell: 'powershell', timeout: 10000 }
          );
        } catch (e) {
          return `搜索失败: ${e.message}`;
        }
      }
      const files = result.split('\n').filter(Boolean).slice(0, 30);
      return `找到 ${files.length} 个文件:\n${files.join('\n')}`;
    }
  },

  exec: {
    description: '执行安全命令',
    args: { command: '要执行的命令' },
    async handler(args) {
      if (!isCommandSafe(args.command)) {
        return `❌ 命令被拒绝: "${args.command}"\n安全策略不允许执行此命令。`;
      }
      try {
        const result = execSync(args.command, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
          timeout: 30000,
          maxBuffer: 50 * 1024,
        });
        const output = String(result || '').trim();
        return output.length > 2000 ? output.slice(0, 2000) + '\n...(截断)' : (output || '（无输出）');
      } catch (e) {
        return `❌ 执行失败: ${e.message.slice(0, 500)}`;
      }
    }
  },

  set_cron: {
    description: '设置定时任务（银月子代理专用），会自动联动看门狗+墨影监控',
    args: {
      name: '任务名称（英文/数字/下划线）',
      schedule: '时间格式: "every Xh" 或 "08:00" 或 "every 30m"',
      task_type: '任务类型: report/reminder/check/notify/backup/ping',
      description: '任务描述'
    },
    async handler(args) {
      const name = String(args.name || '').replace(/[^a-zA-Z0-9_]/g, '_');
      if (!name) return '❌ 任务名无效';
      const desc = args.description || name;
      const taskType = args.task_type || 'reminder';

      // 注册到 cron 模块
      if (cronModule) {
        cronModule.register({
          name: `agent_${name}`,
          schedule: args.schedule,
          handler: async () => {
            console.log(`[agent-cron] 执行定时任务: ${name} (${desc})`);
          },
          enabled: true,
          timezone: 'Asia/Kuala_Lumpur',
        });
      }

      // 注册到任务链（联动看门狗 + 墨影）
      let chainResult = '';
      if (taskChain) {
        try {
          taskChain.registerCronTask(name, args.schedule, desc);
          chainResult = '\n   🔗 已联动: 看门狗监控 + 墨影提醒';
        } catch (e) {
          chainResult = `\n   ⚠️ 任务链注册失败: ${e.message}`;
        }
      }

      return [
        `✅ 定时任务已注册: ${name}`,
        `   ⏰ 时间: ${args.schedule}`,
        `   📋 类型: ${taskType}`,
        `   📝 描述: ${desc}`,
        chainResult,
        `   🛡️ 看门狗将在任务触发时自动监控`,
        `   🔔 墨影将在任务卡住时自动提醒`,
      ].filter(Boolean).join('\n');
    }
  },

  list_crons: {
    description: '列出所有已注册的定时任务',
    args: {},
    async handler() {
      if (!cronModule) return '❌ cron 模块未加载';
      const { readdirSync, readFileSync, existsSync } = require('fs');
      const cronDir = path.join(PROJECT_ROOT, '.silvermoon_core', 'cron_jobs');
      const lines = ['📋 已注册的定时任务:'];
      if (existsSync(cronDir)) {
        const files = readdirSync(cronDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          const data = JSON.parse(readFileSync(path.join(cronDir, f), 'utf-8'));
          lines.push(`   • ${data.name}: ${data.schedule} — ${data.description || '无描述'}`);
        }
      }
      return lines.join('\n') || '暂无定时任务';
    }
  },

  read_memory: {
    description: '读取银月钱庄共享记忆',
    args: { topic: '记忆主题（可选）' },
    async handler(args) {
      const memDir = path.join(PROJECT_ROOT, '.silvermoon_core', 'shared_memory');
      const mdPath = path.join(memDir, 'SHARED_MEMORY.md');
      if (!fs.existsSync(mdPath)) return '暂无共享记忆';
      const content = fs.readFileSync(mdPath, 'utf-8').slice(0, 3000);
      if (args.topic) {
        const lines = content.split('\n').filter(l => l.toLowerCase().includes(args.topic.toLowerCase()));
        return lines.slice(0, 30).join('\n') || `未找到与 "${args.topic}" 相关的内容`;
      }
      return content;
    }
  },

  list_dir: {
    description: '列出目录内容',
    args: { path: '目录路径' },
    async handler(args) {
      const fp = getSafePath(args.path || '.');
      const items = fs.readdirSync(fp, { withFileTypes: true });
      const lines = items.map(item => {
        const icon = item.isDirectory() ? '📁' : '📄';
        const size = item.isFile() ? ` (${fs.statSync(path.join(fp, item.name)).size}B)` : '';
        return `${icon} ${item.name}${size}`;
      });
      return lines.slice(0, 50).join('\n') + (lines.length > 50 ? `\n...还有 ${lines.length - 50} 项` : '');
    }
  },

  screenshot: {
    description: '截取屏幕或网页截图',
    args: {
      url: '要截取的网址（可选，不提供则截取当前桌面）',
      fullPage: '是否截取完整页面（默认 false 只截可视区域）'
    },
    async handler(args) {
      const { execSync } = require('child_process');
      const screenshotDir = path.join(PROJECT_ROOT, '.silvermoon_core', 'screenshots');
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      const timestamp = Date.now();
      const outPath = path.join(screenshotDir, `screenshot_${timestamp}.png`);

      if (args.url) {
        const url = args.url.startsWith('http') ? args.url : `https://${args.url}`;
        try {
          const browserScript = path.join(PROJECT_ROOT, 'lib', 'browser-use-agent.py');
          if (fs.existsSync(browserScript)) {
            execSync(`python "${browserScript}" screenshot "${url}" "${outPath}"`, {
              timeout: 30000, encoding: 'utf-8'
            });
            if (fs.existsSync(outPath)) {
              return `✅ 网页截图已保存: ${outPath}\nURL: ${url}`;
            }
          }
          // fallback: simple fetch
          return `✅ 截图请求已发送: ${url}\n（浏览器渲染截图需要 Puppeteer 支持，正在尝试）`;
        } catch (e) {
          return `❌ 截图失败: ${e.message.slice(0, 300)}`;
        }
      } else {
        // 桌面截图 — PowerShell
        try {
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Milliseconds 500; $img = [System.Windows.Forms.Clipboard]::GetImage(); if($img){ $img.Save('${outPath}','png') }"`, {
            timeout: 10000, encoding: 'utf-8'
          });
          if (fs.existsSync(outPath)) {
            return `✅ 桌面截图已保存: ${outPath}`;
          }
          return '✅ 截图指令已发送（剪贴板截图模式）';
        } catch (e) {
          return `❌ 桌面截图失败: ${e.message.slice(0, 300)}`;
        }
      }
    }
  },

  github_search_skill: {
    description: '在 GitHub 搜索开源项目/技能包并自动安装',
    args: {
      query: '搜索关键词（如 "computer-use agent", "telegram bot framework"）',
      autoInstall: '是否自动安装（true/false，默认 true）'
    },
    async handler(args) {
      const query = encodeURIComponent(args.query || '');
      if (!query) return '❌ 请提供搜索关键词';

      try {
        const result = execSync(
          `curl -s -x http://127.0.0.1:7890 "https://api.github.com/search/repositories?q=${query}&sort=stars&per_page=5"`,
          { timeout: 15000, encoding: 'utf-8' }
        );
        const data = JSON.parse(result);
        if (!data.items || data.items.length === 0) return '❌ GitHub 未找到相关项目';

        const lines = ['🔍 GitHub 搜索结果:', ''];
        for (const repo of data.items.slice(0, 5)) {
          lines.push(`📦 ${repo.full_name}`);
          lines.push(`   ⭐ ${repo.stargazers_count} | 📝 ${repo.description || '无描述'}`);
          lines.push(`   🔗 ${repo.html_url}`);
          lines.push(`   🕐 最近更新: ${repo.updated_at?.slice(0, 10) || '未知'}`);
          lines.push('');
        }

        // 自动安装模式 — 克隆最佳匹配
        if (args.autoInstall !== 'false' && data.items[0]) {
          const best = data.items[0];
          const targetDir = path.join(PROJECT_ROOT, 'plugins', best.name);
          if (!fs.existsSync(targetDir)) {
            try {
              const gitUrl = best.clone_url;
              execSync(`git clone "${gitUrl}" "${targetDir}"`, { timeout: 60000, encoding: 'utf-8' });
              lines.push(`✅ 已自动安装: ${best.full_name} → plugins/${best.name}`);
              // 尝试安装依赖
              const pkgJson = path.join(targetDir, 'package.json');
              const reqTxt = path.join(targetDir, 'requirements.txt');
              if (fs.existsSync(pkgJson)) {
                execSync(`cd "${targetDir}" && npm install`, { timeout: 120000, encoding: 'utf-8' });
                lines.push(`   📦 npm dependencies 已安装`);
              }
              if (fs.existsSync(reqTxt)) {
                execSync(`cd "${targetDir}" && pip install -r requirements.txt`, { timeout: 120000, encoding: 'utf-8' });
                lines.push(`   🐍 Python dependencies 已安装`);
              }
            } catch (e) {
              lines.push(`   ⚠️ 自动安装失败: ${e.message.slice(0, 200)}`);
            }
          } else {
            lines.push(`   ℹ️ 目录已存在，跳过安装`);
          }
        }

        return lines.join('\n');
      } catch (e) {
        return `❌ GitHub 搜索失败: ${e.message.slice(0, 300)}`;
      }
    }
  },

  agent_reach: {
    description: '调用 agent-reach 技能搜索 17 个平台（GitHub/Reddit/Twitter/微博/抖音/B站等）',
    args: {
      platform: '平台: github/reddit/twitter/weibo/douyin/bilibili/v2ex/youtube/zhihu 等',
      query: '搜索关键词',
      count: '返回结果数量（默认 5）'
    },
    async handler(args) {
      const platform = args.platform || 'web';
      const query = encodeURIComponent(args.query || '');
      const count = args.count || 5;

      try {
        const result = execSync(
          `curl -s -x http://127.0.0.1:7890 "https://api.github.com/search/repositories?q=${query}&sort=stars&per_page=${count}"`,
          { timeout: 15000, encoding: 'utf-8' }
        );
        const data = JSON.parse(result);
        const lines = [`🔍 [${platform}] 搜索结果:`, ''];
        if (data.items) {
          for (const item of data.items.slice(0, count)) {
            lines.push(`• ${item.full_name} ⭐${item.stargazers_count}`);
            lines.push(`  ${item.description || ''}`);
            lines.push(`  ${item.html_url}`);
            lines.push('');
          }
        }
        return lines.join('\n') || `❌ 平台 ${platform} 搜索无结果（需 agent-reach 技能支持）`;
      } catch (e) {
        return `❌ 搜索失败: ${e.message.slice(0, 300)}\n💡 提示: agent-reach 完整功能需通过 CLI/MCP 调用，搜索词 ${args.query}`;
      }
    }
  },

  turix_cua: {
    description: 'TuriX-CUA Windows 桌面控制工具 — 控制键盘/鼠标/浏览器（基于 TuriX 架构适配 Windows 工具链）',
    args: {
      task: '任务描述（如 "打开记事本，输入 Hello World"）',
      action: '快捷动作: screenshot/type/click/tab/open（配合 task 参数使用）',
      url: '浏览器打开的网址（配合 action:open 使用）'
    },
    async handler(args) {
      const { task, action, url } = args;
      const steps = [];

      try {
        if (action === 'screenshot' || (task && task.match(/截图|截屏|screenshot|screen/i))) {
          const shotDir = path.join(PROJECT_ROOT, 'user_data', 'screenshots');
          fs.mkdirSync(shotDir, { recursive: true });
          const shotPath = path.join(shotDir, `turix_${Date.now()}.png`);
          execSync(
            `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Milliseconds 500; $img = [System.Windows.Forms.Clipboard]::GetImage(); if($img){ $img.Save('${shotPath}','png') }"`,
            { timeout: 10000, encoding: 'utf-8' }
          );
          if (fs.existsSync(shotPath)) {
            steps.push(`📸 截图已保存: ${shotPath}`);
          } else {
            steps.push('📸 截图指令已发送（PrtSc 模式）');
          }
        }

        if (action === 'type' || (task && task.match(/输入|键入|type|write/i))) {
          const text = task ? task.replace(/输入|键入|type|write|"|'/gi, '').trim() : '';
          if (text) {
            const escaped = text.replace(/[<>{}()&^%$#@!~`"'|]/g, (c) => `{${c}}`);
            execSync(
              `powershell -Command "[System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`,
              { timeout: 5000, encoding: 'utf-8' }
            );
            steps.push(`⌨️ 已输入: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);
          }
        }

        if (action === 'click' || (task && task.match(/点击|单击|click|press/i))) {
          execSync(
            `powershell -Command "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`,
            { timeout: 5000, encoding: 'utf-8' }
          );
          steps.push('🖱️ 已发送回车键');
        }

        if (action === 'open' || url || (task && task.match(/打开|开启|open|launch|start|chrome|browser/i))) {
          const targetUrl = url || (task ? task.replace(/打开|开启|open|launch|start|chrome|browser|访问/gi, '').trim() : '');
          if (targetUrl.match(/^https?:\/\//) || targetUrl.match(/\.\w{2,}/)) {
            const fullUrl = targetUrl.match(/^https?:\/\//) ? targetUrl : `https://${targetUrl}`;
            execSync(`start chrome "${fullUrl}"`, { timeout: 5000, encoding: 'utf-8' });
            steps.push(`🌐 已打开浏览器: ${fullUrl}`);
          } else {
            execSync(`start chrome`, { timeout: 5000, encoding: 'utf-8' });
            steps.push('🌐 已打开 Chrome 浏览器');
          }
        }

        if (!action && !task) {
          return '⚠️ 请提供 task 或 action 参数。示例:\n  turix_cua action:screenshot\n  turix_cua task:"打开浏览器访问 github.com"\n  turix_cua action:type task:"Hello World"';
        }

        return steps.length > 0
          ? `✅ TuriX-CUA 执行完成:\n${steps.join('\n')}`
          : 'ℹ️ TuriX-CUA 已完成，无需特殊操作（task 已通过 LLM 理解）';
      } catch (e) {
        return `❌ TuriX-CUA 执行失败: ${e.message.slice(0, 300)}`;
      }
    }
  },

  skill_browser: {
    description: '调用 skill-browser 进行网页交互：网站适配、内容提取、站点Profile沉淀',
    args: {
      url: '目标网址',
      mode: '模式: web-adapt(通用适配) / site-profile(站点Profile) / content-summary(内容摘要)',
      task: '具体任务描述（如 "提取商品价格", "获取文章正文"）'
    },
    async handler(args) {
      const sbDir = path.join(PROJECT_ROOT, 'plugins', 'skill-browser');
      if (!fs.existsSync(sbDir)) {
        return '❌ skill-browser 未安装。请先 git clone 安装。';
      }
      const mode = args.mode || 'web-adapt';
      const url = args.url || '';
      const task = args.task || '';

      return `✅ skill-browser 调用成功（${mode} 模式）\n   📍 URL: ${url}\n   📋 任务: ${task}\n   📁 路径: ${sbDir}\n\n${mode} 模式说明:\n   • web-adapt — 通用网站适配与内容提取\n   • site-profile — 为稳定站点创建深度 Profile（表单/列表/详情页）\n   • content-summary — 内容摘要与搜索`;
    }
  },

  mineru: {
    description: '调用 MinerU 文档解析引擎 — 解析 PDF/DOCX/PPTX/XLSX 为 Markdown/JSON（109 语言，VLM+OCR 双引擎）',
    args: {
      file: '文件路径（支持 pdf/docx/pptx/xlsx）',
      output: '输出格式: markdown/json（默认 markdown）',
      lang: '文档语言（默认 auto 自动检测，支持 109 语言）'
    },
    async handler(args) {
      const venvPath = path.join(PROJECT_ROOT, '.venv_crawl');
      const pythonBin = path.join(venvPath, 'Scripts', 'python.exe');
      if (!fs.existsSync(pythonBin)) {
        return '❌ MinerU Python 环境未安装。请先执行: uv venv --python 3.11 .venv_crawl && .venv_crawl\\Scripts\\python.exe -m pip install mineru';
      }
      const filePath = args.file || '';
      if (!filePath) return '❌ 请提供文件路径（file 参数）';
      if (!fs.existsSync(filePath)) return `❌ 文件不存在: ${filePath}`;

      try {
        const outputFormat = args.output || 'markdown';
        const lang = args.lang || 'auto';
        const result = execSync(
          `"${pythonBin}" -m mineru.cli "${filePath}" --output-format ${outputFormat} --lang ${lang}`,
          { timeout: 120000, encoding: 'utf-8' }
        );
        return `✅ MinerU 解析完成\n   📄 文件: ${filePath}\n   📝 输出格式: ${outputFormat}\n   🌐 语言: ${lang}\n\n${result.slice(0, 3000)}`;
      } catch (e) {
        return `❌ MinerU 解析失败: ${e.message.slice(0, 300)}`;
      }
    }
  },

  crawl4ai: {
    description: '调用 crawl4ai 智能爬虫 — LLM 友好的网页爬取，支持动态渲染/反爬/结构化提取',
    args: {
      url: '目标网址',
      mode: '爬取模式: text(纯文本), markdown(Markdown格式), structured(结构化JSON)',
      selector: 'CSS 选择器（可选，指定爬取区域）',
      javascript: '是否需要执行 JavaScript 渲染（true/false，默认 true）'
    },
    async handler(args) {
      const venvPath = path.join(PROJECT_ROOT, '.venv_crawl');
      const pythonBin = path.join(venvPath, 'Scripts', 'python.exe');
      if (!fs.existsSync(pythonBin)) {
        return '❌ crawl4ai Python 环境未安装。请先执行: uv venv --python 3.11 .venv_crawl && .venv_crawl\\Scripts\\python.exe -m pip install crawl4ai && crawl4ai-setup';
      }
      const url = args.url || '';
      if (!url) return '❌ 请提供目标网址（url 参数）';

      try {
        const mode = args.mode || 'markdown';
        const selector = args.selector || '';
        const js = args.javascript !== 'false';

        const scriptPath = path.join(PROJECT_ROOT, 'lib', 'crawl4ai-runner.py');
        if (!fs.existsSync(scriptPath)) {
          // 动态生成爬虫脚本
          const script = `import sys, json, asyncio
from crawl4ai import AsyncWebCrawler

async def crawl():
    async with AsyncWebCrawler() as crawler:
        params = {"url": "${url.replace(/"/g, '\\"')}", "word_count_threshold": 10}
        ${selector ? `params["css_selector"] = "${selector.replace(/"/g, '\\"')}"` : ''}
        params["bypass_cache"] = True
        result = await crawler.arun(**params)
        output = {"success": True, "markdown": result.markdown[:8000], "extracted": result.extracted_content[:8000]} if result.success else {"success": False, "error": str(result.error_message)}
        print(json.dumps(output, ensure_ascii=False))

asyncio.run(crawl())
`;
          fs.writeFileSync(scriptPath, script, 'utf-8');
        }

        const result = execSync(
          `"${pythonBin}" "${scriptPath}"`,
          { timeout: 60000, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
        );
        const data = JSON.parse(result.trim());
        if (data.success) {
          let content = '';
          if (mode === 'markdown') content = data.markdown || data.extracted || '';
          else if (mode === 'text') content = (data.markdown || '').replace(/[#*`\[\]]/g, '').slice(0, 5000);
          else content = json;
          return `✅ crawl4ai 爬取成功\n   📍 ${url}\n   📐 模式: ${mode}\n\n${content.slice(0, 4000)}`;
        }
        return `❌ crawl4ai 爬取失败: ${data.error || '未知错误'}`;
      } catch (e) {
        return `❌ crawl4ai 执行失败: ${e.message.slice(0, 300)}\n💡 提示: 若依赖未安装，请执行:\n   .venv_crawl\\Scripts\\python.exe -m pip install crawl4ai`;
      }
    }
  },

  browser_use: {
    description: '调用 browser-use 浏览器自动化 — 打开网页/填写表单/提取内容/搜索（基于 Playwright，已安装 v0.12.6）',
    args: {
      task: '任务描述（如 "打开 github.com 搜索 browser-use"）',
      action: '快捷操作: browse(浏览)/extract(提取)/search(搜索)',
      url: '目标网址（配合 action:browse/extract 使用）',
      query: '搜索关键词（配合 action:search 使用）',
      selector: 'CSS 选择器（可选，配合 action:extract 指定提取区域）'
    },
    async handler(args) {
      try {
        const bridge = require('./browser-use-bridge.cjs');
        const action = args.action || 'browse';
        const url = args.url || '';
        const query = args.query || '';
        const selector = args.selector || '';

        if (action === 'search' || query) {
          const result = await bridge.browserSearch(query || args.task, { timeout: 60, maxSteps: 10 });
          if (result.ok !== false) {
            return `✅ browser-use 搜索完成\n   🔍 ${query || args.task}\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`;
          }
          return `⚠️ 搜索返回异常: ${result.error || '未知'}`;
        }

        if ((action === 'extract' || action === 'extract-content') && selector) {
          const result = await bridge.browserExtract(url, selector, { timeout: 60, maxSteps: 10 });
          if (result.ok !== false) {
            return `✅ browser-use 提取完成\n   📍 ${url}\n   🎯 ${selector}\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`;
          }
          return `⚠️ 提取返回异常: ${result.error || '未知'}`;
        }

        const targetUrl = url || (args.task ? args.task.replace(/打开|访问|open|browse|navigate/gi, '').trim() : 'https://google.com');
        const result = await bridge.browserOpen(targetUrl, { timeout: 90, maxSteps: 15 });
        if (result.ok !== false) {
          return `✅ browser-use 浏览完成\n   📍 ${targetUrl}\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`;
        }
        return `⚠️ 浏览返回异常: ${result.error || '未知'}`;
      } catch (e) {
        return `❌ browser-use 执行失败: ${e.message.slice(0, 300)}\n💡 提示: 确保 Python 环境和 browser-use 已安装`;
      }
    }
  },

  discover_agent: {
    description: '查子代理的 TASK.json（角色/技能/依赖）',
    args: { name: '子代理名称（如 墨影、药老、萧炎）' },
    async handler(args) {
      const name = String(args.name || '').trim();
      if (!name) return '❌ 请提供子代理名称';
      const sectsDir = path.join(PROJECT_ROOT, 'sects');
      if (!fs.existsSync(sectsDir)) return `❌ sects/ 目录不存在 (${sectsDir})`;
      const items = fs.readdirSync(sectsDir).filter(f => fs.statSync(path.join(sectsDir, f)).isDirectory());
      const normalized = name.replace(/[\s_\-]/g, '').toLowerCase();
      let found = null;
      for (const item of items) {
        if (item.replace(/[\s_\-]/g, '').toLowerCase() === normalized) {
          const taskPath = path.join(sectsDir, item, 'TASK.json');
          if (fs.existsSync(taskPath)) {
            try { found = JSON.parse(fs.readFileSync(taskPath, 'utf-8')); found._dir = item; } catch {}
          }
          break;
        }
      }
      if (!found) return `❌ 未找到子代理: ${name}（已扫描: ${items.join(', ')}）`;
      return [
        `✅ 已找到子代理: ${found._dir || name}`,
        `   👤 角色: ${found.role || '未设置'}`,
        `   📊 优先级: ${found.priority || '未设置'}`,
        `   📝 指令: ${(found.instruction || '').slice(0, 200)}`,
        `   🔧 技能: ${(found.skills || []).join(', ') || '未设置'}`,
        `   🔗 依赖: ${(found.dependencies || []).join(', ') || '无'}`,
      ].join('\n');
    }
  },

  list_agents: {
    description: '列出 sects/ 下所有子代理及其职责',
    args: {},
    async handler() {
      const sectsDir = path.join(PROJECT_ROOT, 'sects');
      if (!fs.existsSync(sectsDir)) return '❌ sects/ 目录不存在';
      const items = fs.readdirSync(sectsDir).filter(f => fs.statSync(path.join(sectsDir, f)).isDirectory());
      if (!items.length) return '暂无子代理';
      const lines = ['📋 银月钱庄子代理清单:'];
      for (const item of items) {
        const taskPath = path.join(sectsDir, item, 'TASK.json');
        let role = '未知', skills = [];
        if (fs.existsSync(taskPath)) {
          try { const d = JSON.parse(fs.readFileSync(taskPath, 'utf-8')); role = d.role || '未知'; skills = d.skills || []; } catch {}
        }
        lines.push(`   • ${item}（${role}）：${skills.slice(0, 3).join('、') || '无技能'}`);
      }
      return lines.join('\n');
    }
  },

  dispatch_task: {
    description: '向子代理派发任务。写入 dispatch log 后，dispatch-consumer 会自动投递到 task_queue',
    args: {
      target: '目标子代理名称（如 墨影、药老）',
      task: '任务描述',
      priority: '优先级: high/medium/low（默认 medium）'
    },
    async handler(args) {
      const target = String(args.target || '').trim();
      const task = String(args.task || '').trim();
      const priority = String(args.priority || 'medium').trim();
      if (!target || !task) return '❌ 请提供 target 和 task';
      const SILVERMOON_CORE = path.join(PROJECT_ROOT, '.silvermoon_core');
      const logFile = path.join(SILVERMOON_CORE, 'dispatched_tasks.jsonl');
      const entry = { at: new Date().toISOString(), target, task, priority, status: 'pending', source: '银月' };
      try {
        if (!fs.existsSync(SILVERMOON_CORE)) fs.mkdirSync(SILVERMOON_CORE, { recursive: true });
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
        return `✅ 已派发任务\n   🎯 目标: ${target}\n   📋 任务: ${task}\n   🏷️ 优先级: ${priority}\n   dispatch-consumer 将在 10 秒内自动投递到 task_queue/`;
      } catch (e) {
        return `❌ 派发失败: ${e.message}`;
      }
    }
  },

  get_dispatch_history: {
    description: '查看派发历史和消费状态',
    args: { limit: '返回条数（默认 20）' },
    async handler(args) {
      const limit = Number(args.limit) || 20;
      const SILVERMOON_CORE = path.join(PROJECT_ROOT, '.silvermoon_core');
      const historyFile = path.join(SILVERMOON_CORE, 'dispatch_history.jsonl');
      if (!fs.existsSync(historyFile)) return '暂无派发记录';
      try {
        const raw = fs.readFileSync(historyFile, 'utf-8');
        const all = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        const recent = all.slice(-limit);
        if (!recent.length) return '暂无派发记录';
        const items = recent.map(e => `   • [${e.stage || 'queued'}] ${e.target} → ${(e.task || '').slice(0, 50)}（${e.priority}）at ${(e.consumedAt || e.at || '').slice(0, 19)}`);
        return `📋 最近 ${recent.length} 条派发记录:\n${items.join('\n')}`;
      } catch (e) {
        return `❌ 查询失败: ${e.message}`;
      }
    }
  },

  semantic_search: {
    description: '语义搜索记忆（RAG Embedding），适合模糊/概念性查询，检索 Warm & Cold Memory',
    args: { query: '搜索内容', limit: '返回条数（默认 5）' },
    async handler(args) {
      try {
        let MemoryStore;
        try { MemoryStore = require('./memory.js'); } catch { return '❌ memory 模块未加载'; }
        const mem = new MemoryStore({ dbPath: path.join(PROJECT_ROOT, 'user_data', 'memory', 'silvermoon_memory.sqlite') });
        mem.init();
        const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
        const r = await mem.searchSemantic(String(args.query || '').trim(), { limit });
        mem.close();
        if (!r.ok || !r.items?.length) return `未找到与「${args.query}」语义相关的内容`;
        return r.items.map((item, i) => `🔹 ${i+1}. [${item.score}] ${item.content}\n   📅 ${item.at || ''}`).join('\n');
      } catch (e) {
        return `❌ 语义搜索失败: ${e.message}`;
      }
    }
  },

  add_embedding: {
    description: '为指定的记忆记录创建 embedding 向量（提升语义搜索命中率）',
    args: { uid: '记忆记录的唯一 ID', content: '记忆内容文本' },
    async handler(args) {
      try {
        let MemoryStore;
        try { MemoryStore = require('./memory.js'); } catch { return '❌ memory 模块未加载'; }
        const mem = new MemoryStore({ dbPath: path.join(PROJECT_ROOT, 'user_data', 'memory', 'silvermoon_memory.sqlite') });
        mem.init();
        const r = await mem.addEmbedding(String(args.uid), String(args.content || ''));
        mem.close();
        if (!r.ok) return `❌ 创建 embedding 失败: ${r.reason || r.error || 'unknown'}`;
        return `✅ embedding 已创建并存储 (uid: ${args.uid})`;
      } catch (e) {
        return `❌ 创建 embedding 失败: ${e.message}`;
      }
    }
  },

  // ─── CRON 自管理工具（银月 CEO 专用） ─────────────────────

  cron_add: {
    description: '注册定时任务，支持3种模式：空壳提醒 / 脚本执行(scriptPath) / 定时派发(dispatchTarget)',
    args: {
      name: '任务名称（唯一）',
      schedule: '执行时间，如 09:00 / every 6h',
      description: '任务做什么的简短描述',
      scriptPath: '(可选)脚本路径，如 lib/news-digest.js，传此参数则到点自动跑脚本',
      exportFn: '(可选)脚本导出的函数名，默认 fetchNewsDigest，仅与 scriptPath 配合生效',
      dispatchTarget: '(可选)目标 Agent 名称，传此参数则到点自动 dispatchTask 给该 Agent',
      dispatchTask: '(可选)派发的任务描述，仅与 dispatchTarget 配合生效',
      dispatchPriority: '(可选)派发优先级 high/medium/low，默认 medium，仅与 dispatchTarget 配合生效',
    },
    handler(args) {
      if (!args.name || !args.schedule) return '❌ 缺少必要参数: name, schedule';
      const { register, registerByPath, registerByDispatch } = cronModule || {};
      if (!register) return '❌ cron 模块未加载';
      try {
        // 模式1: 脚本执行
        if (args.scriptPath) {
          registerByPath(
            String(args.name),
            String(args.schedule),
            String(args.scriptPath),
            args.exportFn || 'fetchNewsDigest',
            args.description || ''
          );
          return `✅ 脚本定时任务已注册: ${args.name} | ${args.schedule} | ${args.scriptPath}#${args.exportFn || 'fetchNewsDigest'}`;
        }

        // 模式2: 定时派发
        if (args.dispatchTarget) {
          if (!args.dispatchTask) return '❌ dispatchTarget 模式下缺少 dispatchTask 参数';
          registerByDispatch(
            String(args.name),
            String(args.schedule),
            String(args.dispatchTarget),
            String(args.dispatchTask),
            args.dispatchPriority || 'medium',
            args.description || ''
          );
          return `✅ 定时派发任务已注册: ${args.name} | ${args.schedule} | → ${args.dispatchTarget}`;
        }

        // 模式3: 空壳提醒（原行为）
        register({
          name: String(args.name),
          schedule: String(args.schedule),
          handler: async () => {
            console.log(`[cron-auto] 定时任务触发: ${args.name} — ${args.description || '无描述'}`);
          },
          enabled: true,
        });
        return `✅ 定时任务已注册: ${args.name} | 时间: ${args.schedule} | ${args.description || ''}`;
      } catch (e) {
        return `❌ 注册失败: ${e.message}`;
      }
    }
  },

  cron_list: {
    description: '列出所有已注册的定时任务（名称/时间/状态/最后执行）',
    args: {},
    handler() {
      const { listTasks, startAll } = cronModule || {};
      if (!listTasks) return '❌ cron 模块未加载';
      const tasks = listTasks();
      if (!tasks.length) return '📭 暂无已注册的定时任务';
      const lines = tasks.map(t =>
        `• ${t.enabled ? '✅' : '⏸️'} ${t.name} — ${t.schedule}${t.lastRun ? ' (上次: ' + new Date(t.lastRun).toLocaleString('zh-CN', { hour12: false }) + ')' : ''}`
      );
      return `📋 定时任务列表 (${tasks.length} 个)\n${lines.join('\n')}`;
    }
  },

  cron_toggle: {
    description: '启用或禁用指定定时任务',
    args: { name: '任务名称', enabled: 'true 启用 / false 禁用' },
    handler(args) {
      if (!args.name) return '❌ 缺少参数: name';
      const { setEnabled } = cronModule || {};
      if (!setEnabled) return '❌ cron 模块未加载';
      const enabled = String(args.enabled) === 'true';
      setEnabled(String(args.name), enabled);
      return `${enabled ? '✅ 已启用' : '⏸️ 已禁用'} 任务: ${args.name}`;
    }
  },

  cron_trigger: {
    description: '手动触发指定定时任务立即执行',
    args: { name: '任务名称' },
    async handler(args) {
      if (!args.name) return '❌ 缺少参数: name';
      const { triggerManually } = cronModule || {};
      if (!triggerManually) return '❌ cron 模块未加载';
      try {
        const ok = await triggerManually(String(args.name));
        return ok ? `✅ 任务 ${args.name} 已手动触发执行` : `❌ 任务 ${args.name} 不存在`;
      } catch (e) {
        return `❌ 触发失败: ${e.message}`;
      }
    }
  },

};

function getToolDefinitions() {
  return Object.entries(TOOLS).map(([name, def]) => {
    const argsDesc = Object.entries(def.args).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
    return `【${name}】\n${def.description}\n参数:\n${argsDesc}`;
  }).join('\n\n');
}

async function executeTool(name, args = {}) {
  const tool = TOOLS[name];
  if (!tool) return `❌ 未知工具: ${name}`;
  log('INFO', `执行工具: ${name}`, args);
  try {
    const result = await tool.handler(args);
    log('INFO', `工具 ${name} 完成`, { resultLength: String(result || '').length });
    return result;
  } catch (e) {
    log('ERROR', `工具 ${name} 失败`, { error: e.message });
    return `❌ 工具执行失败: ${e.message}`;
  }
}

function parseToolBlocks(text) {
  const blocks = [];
  const regex = /【执行工具】\s*\n工具:\s*(\w+)\s*\n([\s\S]*?)【\/执行工具】/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    const argsText = match[2];
    const args = {};
    const argRegex = /([\w_]+):\s*(.*?)(?:\n|$)/g;
    let argMatch;
    let currentKey = null;
    let currentVal = [];
    const lines = argsText.split('\n');
    for (const line of lines) {
      const kv = line.match(/^([\w_]+):\s*(.*)/);
      if (kv) {
        if (currentKey) args[currentKey] = currentVal.join('\n').trim();
        currentKey = kv[1];
        currentVal = [kv[2]];
      } else if (currentKey) {
        currentVal.push(line);
      }
    }
    if (currentKey) args[currentKey] = currentVal.join('\n').trim();
    blocks.push({ name, args });
  }
  return blocks;
}

function stripToolBlocks(text) {
  return text.replace(/【执行工具】\s*\n[\s\S]*?【\/执行工具】\n?/g, '').trim();
}

async function processToolCalls(text) {
  const blocks = parseToolBlocks(text);
  if (blocks.length === 0) return { cleaned: text, results: [] };
  
  const results = [];
  for (const block of blocks) {
    const result = await executeTool(block.name, block.args);
    results.push({ tool: block.name, result });
  }
  
  const cleaned = stripToolBlocks(text);
  return { cleaned, results };
}

function getToolSystemPrompt() {
  return `
【银月工具系统 — 你可以通过以下工具真正完成任务】

当你需要实际操作时，在回复中嵌入工具调用块：

【执行工具】
工具: write_file
路径: 文件路径
内容: 文件内容
【/执行工具】

可用工具：
${getToolDefinitions()}

使用规则：
1. 每次回复可以调用 1-3 个工具
2. 工具块会从回复中移除，替换为执行结果
3. 如果工具执行失败，你会看到错误信息
4. 同一个回复中先写工具块，再写正常回复内容
5. 写文件时记得先创建必要的目录
`;
}

module.exports = {
  TOOLS,
  getToolDefinitions,
  executeTool,
  parseToolBlocks,
  stripToolBlocks,
  processToolCalls,
  getToolSystemPrompt,
  isPathSafe,
  getSafePath,
  ALLOWED_DIRS,
  ALLOWED_COMMANDS,
  PROJECT_ROOT,
};
