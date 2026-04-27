const fs = require('fs');
const path = require('path');

const SECTS_DIR = path.join(__dirname, '..', 'sects');
const RTK_RULES_BLOCK = `

## RTK 极致省 Token 协议（强制执行）

你所有 CLI 命令必须使用 \`rtk\` 前缀，可节省 90-98% Token。

### 强制规则

| 原始命令 | RTK 版本 | 节省 |
|---------|----------|------|
| \`git status\` | \`rtk git status\` | ~98% |
| \`git diff\` | \`rtk git diff\` | ~95% |
| \`git log\` | \`rtk git log\` | ~95% |
| \`npm test\` | \`rtk npm test\` | ~99% |
| \`npm run build\` | \`rtk npm run build\` | ~95% |
| \`npx tsc\` | \`rtk npx tsc\` | ~95% |
| \`npx vitest\` | \`rtk npx vitest\` | ~99% |
| \`cargo build\` | \`rtk cargo build\` | ~95% |
| \`cargo test\` | \`rtk cargo test\` | ~98% |
| \`pytest\` | \`rtk pytest\` | ~98% |
| \`docker ps\` | \`rtk docker ps\` | ~95% |
| \`ls\` | \`rtk ls\` | ~97% |
| \`ps\` | \`rtk ps\` | ~95% |
| \`env\` | \`rtk env\` | ~95% |
| \`df\` | \`rtk df\` | ~95% |
| \`du\` | \`rtk du\` | ~95% |
| \`wc\` | \`rtk wc\` | ~95% |
| \`tree\` | \`rtk tree\` | ~95% |
| \`find\` | \`rtk find\` | ~95% |
| \`grep\` | \`rtk grep\` | ~95% |
| \`curl\` | \`rtk curl\` | ~95% |
| \`node script.js\` | \`rtk node script.js\` | ~95% |
| \`ollama run\` | \`rtk ollama run\` | ~95% |
| \`pip list\` | \`rtk pip list\` | ~95% |

### 例外（不使用 RTK）

\`cd\`、\`mkdir\`、\`rm\`、\`cp\`、\`mv\`、\`echo\`、\`printf\`、\`code\`、\`explorer\`、\`start\`、\`cls\`、\`clear\`

### 验证

\`\`\`bash
rtk --version  # 应显示 0.35.0
\`\`\`

### 省 Token 原理

RTK 通过三层过滤实现极致压缩：
1. **命令重写**：将原始命令转为 RTK 内置处理，去掉 ANSI 颜色/光标控制字符
2. **TOML 过滤器**：8 阶段管道过滤（strip_ansi → replace → match_output → strip/keep_lines → truncate → head/tail → max_lines → on_empty）
3. **代码过滤器**：剥离注释/实现体，只保留接口签名和关键逻辑

**不遵守此协议 = 浪费主人 Token = 扣绩效**
`;

function injectRtkRules(soulPath) {
  if (!fs.existsSync(soulPath)) {
    console.log(`  [SKIP] ${soulPath} not found`);
    return false;
  }

  let content = fs.readFileSync(soulPath, 'utf8');

  if (content.includes('RTK 极致省 Token 协议')) {
    console.log(`  [SKIP] ${path.basename(path.dirname(soulPath))} already has RTK rules`);
    return false;
  }

  content += RTK_RULES_BLOCK;
  fs.writeFileSync(soulPath, content, 'utf8');
  console.log(`  [OK] ${path.basename(path.dirname(soulPath))} injected`);
  return true;
}

function main() {
  console.log('=== 银月钱庄 · RTK 极致省 Token 协议注入 ===\n');

  const sects = fs.readdirSync(SECTS_DIR).filter(f => {
    const fullPath = path.join(SECTS_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`发现 ${sects.length} 个 Agent 宗门\n`);

  let injected = 0;
  let skipped = 0;

  for (const sect of sects) {
    const soulPath = path.join(SECTS_DIR, sect, 'SOUL.md');
    if (injectRtkRules(soulPath)) {
      injected++;
    } else {
      skipped++;
    }
  }

  console.log(`\n完成：注入 ${injected} 个，跳过 ${skipped} 个`);
}

main();
