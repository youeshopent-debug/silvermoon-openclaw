const fs = require('fs');
const path = require('path');

// === 配置 ===
const PROJECT_ROOT = 'C:\\Users\\User\\.openclaw';
const DROPBOX_ROOT = 'C:\\Users\\User\\Dropbox\\银月钱庄';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// === 需要同步的目录结构 ===
const SYNC_MAP = [
  // Trae 团队产出
  { src: '.silvermoon_core', dst: 'Trae团队/看板与记忆' },
  { src: 'DESIGN.md', dst: 'Trae团队/设计系统' },
  { src: 'landing', dst: 'Trae团队/落地页' },
  { src: 'shop_final_design.cjs', dst: 'Trae团队/Shopify脚本' },
  { src: 'shop_fix_home.cjs', dst: 'Trae团队/Shopify脚本' },
  { src: 'shop_perfect_design.cjs', dst: 'Trae团队/Shopify脚本' },
  { src: 'shop_verify_final.mjs', dst: 'Trae团队/Shopify脚本' },

  // OpenClaw 团队产出
  { src: 'sects', dst: 'OpenClaw团队/宗门档案' },
  { src: 'data/evolution', dst: 'OpenClaw团队/进化数据' },
  { src: 'lib', dst: 'OpenClaw团队/核心模块' },
  { src: 'main.js', dst: 'OpenClaw团队/网关' },
  { src: 'openclaw.json', dst: 'OpenClaw团队/配置' },
  { src: 'keeper-launcher.js', dst: 'OpenClaw团队/看护系统' },
  { src: 'agents', dst: 'OpenClaw团队/Agent配置' },
  { src: 'tests', dst: 'OpenClaw团队/测试' },

  // 多媒体资产
  { src: '.silvermoon_core/assets', dst: '多媒体资产/音频' },
  { src: '.silvermoon_core/scripts', dst: '多媒体资产/视频脚本' },
  { src: '.silvermoon_core/marketing', dst: '多媒体资产/文案' },
];

// === 忽略列表 ===
const IGNORE = [
  'node_modules', '.git', '.rtk', 'plugins/rtk/target',
  '*.png', '*.jpg', '*.exe', '*.zip', '*.tgz',
  'package-lock.json', 'pnpm-lock.yaml',
];

function shouldIgnore(name) {
  for (const rule of IGNORE) {
    if (rule.includes('*')) {
      const ext = rule.replace('*', '');
      if (name.endsWith(ext)) return true;
    } else if (name === rule) {
      return true;
    }
  }
  return false;
}

function copyItem(srcPath, dstPath) {
  if (!fs.existsSync(srcPath)) return { copied: 0, skipped: 1 };
  const stat = fs.statSync(srcPath);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
    let copied = 0, skipped = 0;
    const entries = fs.readdirSync(srcPath, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldIgnore(entry.name)) { skipped++; continue; }
      const result = copyItem(path.join(srcPath, entry.name), path.join(dstPath, entry.name));
      copied += result.copied;
      skipped += result.skipped;
    }
    return { copied, skipped };
  } else {
    try {
      if (!fs.existsSync(path.dirname(dstPath))) fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
      return { copied: 1, skipped: 0 };
    } catch (e) {
      return { copied: 0, skipped: 1 };
    }
  }
}

// === 主流程 ===
console.log('='.repeat(60));
console.log('  银月钱庄 → Dropbox 全量同步');
console.log('  时间: ' + new Date().toLocaleString('zh-CN'));
console.log('='.repeat(60));

let totalCopied = 0;
let totalSkipped = 0;
const errors = [];

for (const item of SYNC_MAP) {
  const srcPath = path.join(PROJECT_ROOT, item.src);
  const dstPath = path.join(DROPBOX_ROOT, item.dst);

  console.log(`\n📂 ${item.dst}/`);
  console.log(`   源: ${item.src}`);

  try {
    // 如果是文件，dstPath 要带上文件名
    const realDst = fs.statSync(srcPath).isFile()
      ? path.join(DROPBOX_ROOT, item.dst, path.basename(item.src))
      : dstPath;
    const result = copyItem(srcPath, realDst);
    totalCopied += result.copied;
    totalSkipped += result.skipped;
    console.log(`   ✅ ${result.copied} 文件已复制` + (result.skipped > 0 ? ` (${result.skipped} 跳过)` : ''));
  } catch (e) {
    errors.push(`${item.src}: ${e.message}`);
    console.log(`   ❌ 失败: ${e.message}`);
  }
}

// === 生成同步报告 ===
const report = {
  timestamp: new Date().toISOString(),
  totalCopied,
  totalSkipped,
  errors,
  syncMap: SYNC_MAP.map(m => m.dst),
};

const reportPath = path.join(DROPBOX_ROOT, '_同步报告.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`  ✅ 同步完成！`);
console.log(`  复制: ${totalCopied} 个文件`);
console.log(`  跳过: ${totalSkipped} 个文件`);
console.log(`  错误: ${errors.length} 个`);
console.log(`  报告: ${reportPath}`);
console.log('='.repeat(60));
console.log('\n📌 Dropbox 路径:');
console.log(`   ${DROPBOX_ROOT}`);
console.log('\n📌 下次同步直接运行:');
console.log('   node sync_dropbox.cjs');
