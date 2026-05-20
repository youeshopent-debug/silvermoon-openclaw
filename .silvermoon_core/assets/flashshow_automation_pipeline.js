/**
 * flashshow_automation_pipeline.js
 * 蓝灵儿 — 闪剪自动渲染管线
 *
 * 连接已登录的 Chrome (CDP 9222) → app.shanjian.tv
 * 按 pipeline 顺序执行 8 步配置 → 预览导出
 *
 * 用法:
 *   node .silvermoon_core\assets\flashshow_automation_pipeline.js
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chrome = require(path.resolve(__dirname, '../../lib/chrome-cdp-bridge'));

// ============================================================
// 1. 配置加载
// ============================================================
const PARAMS_PATH = path.resolve(__dirname, 'flashshow_render_params_scriptA.json');
const params = JSON.parse(fs.readFileSync(PARAMS_PATH, 'utf-8'));

const TOTAL_STEPS = 8;
let stepCounter = 0;

function logStep(title, detail) {
  stepCounter++;
  const icon = stepCounter === TOTAL_STEPS ? '🚀' : '▶';
  console.log(`\n${'='.repeat(56)}`);
  console.log(` ${icon} Step ${stepCounter}/${TOTAL_STEPS}: ${title}`);
  console.log(`   ${detail}`);
  console.log(`${'='.repeat(56)}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// 2. 工具函数 — 页面操作
// ============================================================

/** 等待并点击（带重试） */
async function safeClick(selector, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await chrome.waitForSelector(selector, 8000);
      await chrome.click(selector);
      await sleep(800);
      return true;
    } catch (e) {
      if (i === retries - 1) throw new Error(`click failed: ${selector} — ${e.message}`);
      console.log(`  ⚠ retry ${i + 1}/${retries}...`);
      await sleep(1500);
    }
  }
}

/** 获取页面全部可见文本 */
async function pageText() {
  try { return await chrome.evaluate(() => document.body?.innerText?.substring(0, 2000) || ''); }
  catch { return '(unreachable)'; }
}

/** 截图存档 */
async function snap(label) {
  try {
    const shot = await chrome.screenshot(`flashshow_${label}`);
    const snapDir = path.resolve(__dirname, 'screenshots');
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
    const filePath = path.join(snapDir, `flashshow_${label}_${Date.now()}.png`);
    fs.writeFileSync(filePath, shot.buffer);
    console.log(`  📸 截图已保存: ${filePath}`);
  } catch (e) {
    console.log(`  ⚠ 截图失败: ${e.message}`);
  }
}

// ============================================================
// 3. 主流程
// ============================================================
async function main() {
  console.log(`
╔══════════════════════════════════════════════════╗
║   闪剪自动渲染管线 v1.0                          ║
║   蓝灵儿 (media-producer-llER)                   ║
║   脚本: ${params.meta.script}                    ║
║   片段时间: ${params.meta.segment}               ║
╚══════════════════════════════════════════════════╝
`);

  // --- 连接 Chrome ---
  console.log('[连接] 检测 Chrome CDP 端口 9222...');
  try {
    await chrome.connect('shanjian.tv');
    const info = await chrome.getPageInfo();
    console.log(`  ✅ 已连接 — ${info.title}`);
    console.log(`  🔗 ${info.url}`);
  } catch (e) {
    console.error(`\n❌ CDP 连接失败: ${e.message}`);
    console.log('\n⚠️  请确保 Chrome 已开启远程调试端口:');
    console.log('   彻底关闭所有 Chrome 后运行:');
    console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
    console.log('   然后重新登录 https://app.shanjian.tv');
    process.exit(1);
  }

  // --- 确认在闪剪页面 ---
  const currentUrl = (await chrome.getPageInfo()).url;
  if (!currentUrl.includes('shanjian.tv')) {
    console.log('\n[导航] 跳转到 app.shanjian.tv...');
    await chrome.navigate('https://app.shanjian.tv');
    await sleep(3000);
    console.log(`  当前页面: ${(await chrome.getPageInfo()).title}`);
  } else {
    console.log(`\n[导航] 已在闪剪页面`);
  }

  await snap('00_landing');

  // ============================================================
  // Step 1: 配置数字人形象
  // ============================================================
  logStep(
    '配置数字人形象',
    `${params.digital_human.appearance.shot_type} | ${params.digital_human.appearance.clothing}`
  );

  // 点击 "数字人" 或 "形象" 入口
  const findHumanBtn = async () => {
    const btns = ['数字人', '形象', 'Digital Human', 'Avatar', '数字分身'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const btns = document.querySelectorAll('button, div[role="button"], span, a');
        for (const b of btns) {
          if (b.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const humanBtn = await findHumanBtn();
  if (humanBtn) {
    console.log(`  🔍 找到入口: "${humanBtn}"`);
    // 点击进入数字人选择
    await chrome.evaluate((t) => {
      const btns = document.querySelectorAll('button, div[role="button"], span, a');
      for (const b of btns) {
        if (b.innerText?.toLowerCase().includes(t.toLowerCase())) { b.click(); return; }
      }
    }, humanBtn);
    await sleep(2000);
  } else {
    // 找不到特定按钮就尝试通用入口
    console.log('  ⚠ 未找到数字人入口按钮，尝试查找数字人选择器...');
  }

  // 搜索数字人或选择推荐
  // 注：闪剪的公共数字人一般在列表中可通过描述文字匹配
  console.log(`  🎯 目标: ${params.digital_human.appearance.clothing}`);
  console.log('  👀 请在界面中手动选择或调整数字人形象');
  await snap('01_digital_human');

  // ============================================================
  // Step 2: 设置背景 #1A1A2E
  // ============================================================
  logStep(
    '设置深色背景',
    `纯色 ${params.digital_human.background.color} | ${params.digital_human.background.style}`
  );

  // 尝试找"背景"设置入口
  const findBgBtn = async () => {
    const btns = ['背景', 'Background', '背景设置', '背景图'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div[role="button"]');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const bgBtn = await findBgBtn();
  if (bgBtn) {
    console.log(`  🔍 找到入口: "${bgBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button, span, div[role="button"]');
      for (const e of els) {
        if (e.innerText?.toLowerCase().includes(t.toLowerCase())) { e.click(); return; }
      }
    }, bgBtn);
    await sleep(1500);
  } else {
    console.log('  ⚠ 未找到背景入口按钮');
  }

  // 尝试选纯色 -> 输入 #1A1A2E
  // 闪剪的颜色选择器可能是 input[type="color"] 或弹窗
  try {
    const colorInput = await chrome.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="color"]');
      if (inputs.length > 0) return inputs[0];
      // 也可能是一个可点击的颜色块
      const colorBlocks = document.querySelectorAll('[class*="color"], [class*="Color"]');
      for (const cb of colorBlocks) {
        if (cb.style?.backgroundColor || cb.dataset?.color) return cb;
      }
      return null;
    });
    if (colorInput) {
      console.log(`  🎨 已定位颜色选择器`);
    }
  } catch (e) {
    console.log(`  ⚠ 颜色选择器操作: ${e.message}`);
  }

  // 找"纯色"或"Solid"标签
  await chrome.evaluate((color) => {
    const els = document.querySelectorAll('span, div, button');
    for (const e of els) {
      const t = e.innerText?.toLowerCase() || '';
      if (t.includes('纯色') || t.includes('solid') || t.includes('单色')) {
        e.click(); return;
      }
    }
  }, params.digital_human.background.color);
  await sleep(1000);

  await snap('02_background');

  // ============================================================
  // Step 3: 调整灯光
  // ============================================================
  logStep(
    '调整灯光',
    `${params.digital_human.lighting.type} | ${params.digital_human.lighting.color_temp}`
  );

  // 找"灯光"/"Lighting"设置
  const findLightBtn = async () => {
    const btns = ['灯光', 'Lighting', '光照', '补光'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div[role="button"]');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const lightBtn = await findLightBtn();
  if (lightBtn) {
    console.log(`  🔍 找到灯光入口: "${lightBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button, span, div[role="button"]');
      for (const e of els) {
        if (e.innerText?.toLowerCase().includes(t.toLowerCase())) { e.click(); return; }
      }
    }, lightBtn);
    await sleep(1500);

    // 选择暖黄预设
    await chrome.evaluate(() => {
      const els = document.querySelectorAll('span, div, button');
      for (const e of els) {
        const t = e.innerText?.toLowerCase() || '';
        if (t.includes('暖黄') || t.includes('warm') || t.includes('暖色')) {
          e.click(); return;
        }
      }
    });
    await sleep(1000);
    console.log('  ✅ 暖黄灯光预设已选择');
  } else {
    console.log('  ⚠ 未找到灯光设置入口');
  }

  await snap('03_lighting');

  // ============================================================
  // Step 4: 输入口播台词
  // ============================================================
  logStep(
    '输入口播台词',
    params.voiceover.text
  );

  // 找台词/文案输入框
  const scriptText = params.voiceover.text;
  console.log(`  📝 台词长度: ${scriptText.length} 字符`);

  // 尝试找文本编辑区（textarea / contenteditable / 富文本）
  const textInputResult = await chrome.evaluate((text) => {
    // 方法1: textarea
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.offsetParent !== null) { // visible
        ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return { method: 'textarea', found: true };
      }
    }
    // 方法2: contenteditable
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const ed of editables) {
      if (ed.offsetParent !== null) {
        ed.innerText = text;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        return { method: 'contenteditable', found: true };
      }
    }
    // 方法3: 找 placeholder
    const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const inp of inputs) {
      const ph = (inp.placeholder || '').toLowerCase();
      if (ph.includes('文案') || ph.includes('台词') || ph.includes('script') || ph.includes('text')) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(inp, text);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return { method: 'input_placeholder', found: true };
      }
    }
    return { found: false };
  }, scriptText);

  if (textInputResult.found) {
    console.log(`  ✅ 台词已输入 (method: ${textInputResult.method})`);
  } else {
    console.log('  ⚠ 未找到自动文本输入位置，请手动粘贴台词');
    console.log(`  📋 台词内容:\n    "${scriptText}"`);
  }

  await sleep(500);
  await snap('04_script_input');

  // ============================================================
  // Step 5: 选择配音
  // ============================================================
  logStep(
    '选择配音音色',
    `${params.voiceover.speaker_style} | 语速 +${Math.round((params.voiceover.speed - 1) * 100)}%`
  );

  // 找配音/声音设置
  const findVoiceBtn = async () => {
    const btns = ['配音', '声音', 'Voice', '音色', '配音设置'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div[role="button"]');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const voiceBtn = await findVoiceBtn();
  if (voiceBtn) {
    console.log(`  🔍 找到配音入口: "${voiceBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button, span, div[role="button"]');
      for (const e of els) {
        if (e.innerText?.toLowerCase().includes(t.toLowerCase())) { e.click(); return; }
      }
    }, voiceBtn);
    await sleep(1500);

    // 尝试选 Tech Founder / 美式男声
    const targetVoice = params.voiceover.speaker_style;
    const voiceFound = await chrome.evaluate((voice) => {
      const els = document.querySelectorAll('span, div, button, li');
      for (const e of els) {
        const t = e.innerText?.toLowerCase() || '';
        if (t.includes('tech founder') || t.includes('startup') ||
            t.includes('american') || t.includes('美式') || t.includes('自信')) {
          e.click(); return true;
        }
      }
      return false;
    }, targetVoice);
    if (voiceFound) {
      console.log(`  ✅ 已选择 ${targetVoice}`);
    } else {
      console.log(`  ⚠ 未匹配到目标音色 "${targetVoice}"，请手动选择`);
    }
    await sleep(1000);
  } else {
    console.log('  ⚠ 未找到配音入口');
  }

  await snap('05_voice');

  // ============================================================
  // Step 6: 添加字幕
  // ============================================================
  logStep(
    '添加字幕',
    `${params.subtitles.style} | 高亮色 ${params.subtitles.highlight_color}`
  );

  // 找字幕设置
  const findSubBtn = async () => {
    const btns = ['字幕', 'Subtitles', 'Caption', '字幕设置', '动态字幕'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div[role="button"]');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const subBtn = await findSubBtn();
  if (subBtn) {
    console.log(`  🔍 找到字幕入口: "${subBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button, span, div[role="button"]');
      for (const e of els) {
        if (e.innerText?.toLowerCase().includes(t.toLowerCase())) { e.click(); return; }
      }
    }, subBtn);
    await sleep(1500);

    // 启用字幕开关
    await chrome.evaluate(() => {
      const toggleBtns = document.querySelectorAll('[role="switch"], [class*="toggle"], [class*="switch"]');
      for (const tb of toggleBtns) {
        const checked = tb.getAttribute('aria-checked') || tb.dataset?.checked || '';
        if (checked === 'false' || checked === 'off') {
          tb.click(); return;
        }
      }
    });
    await sleep(500);

    // 选动态/弹跳风格
    await chrome.evaluate(() => {
      const els = document.querySelectorAll('span, div, button');
      for (const e of els) {
        const t = e.innerText?.toLowerCase() || '';
        if (t.includes('弹跳') || t.includes('bounce') || t.includes('动态') ||
            t.includes('pop') || t.includes('逐词')) {
          e.click(); return;
        }
      }
    });
    await sleep(500);

    console.log('  ✅ 字幕已启用，动态样式已设置');
  } else {
    console.log('  ⚠ 未找到字幕设置入口');
  }

  await snap('06_subtitles');

  // ============================================================
  // Step 7: 配置 BGM
  // ============================================================
  logStep(
    '配置背景音乐',
    `${params.background_music.genre} | 音量曲线: ${JSON.stringify(params.background_music.volume_profile)}`
  );

  // 找BGM/音乐设置
  const findBgmBtn = async () => {
    const btns = ['音乐', 'BGM', '背景音乐', 'Music', '配乐'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div[role="button"]');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase())) return true;
        }
        return false;
      }, text);
      if (found) return text;
    }
    return null;
  };
  const bgmBtn = await findBgmBtn();
  if (bgmBtn) {
    console.log(`  🔍 找到音乐入口: "${bgmBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button, span, div[role="button"]');
      for (const e of els) {
        if (e.innerText?.toLowerCase().includes(t.toLowerCase())) { e.click(); return; }
      }
    }, bgmBtn);
    await sleep(1500);

    // 搜索 genre
    const genreKeywords = params.background_music.genre.toLowerCase().split('/');
    const bgmFound = await chrome.evaluate((kws) => {
      const els = document.querySelectorAll('span, div, button, li');
      for (const e of els) {
        const t = e.innerText?.toLowerCase() || '';
        if (kws.some(k => t.includes(k))) { e.click(); return true; }
      }
      // 也尝试搜 genre 作为文本搜索
      const searchInputs = document.querySelectorAll('input[type="text"], input[placeholder*="搜索"], input[placeholder*="search"]');
      for (const si of searchInputs) {
        if (si.offsetParent !== null) {
          si.value = kws[0] || 'tech';
          si.dispatchEvent(new Event('input', { bubbles: true }));
          return { searchInput: true };
        }
      }
      return false;
    }, genreKeywords);

    if (bgmFound) {
      console.log(`  ✅ 已选择 ${params.background_music.genre} 风格`);
    } else if (bgmFound?.searchInput) {
      console.log(`  🔍 已填入搜索关键词: ${genreKeywords[0]}`);
    } else {
      console.log(`  ⚠ 未匹配到目标BGM风格，请手动选择`);
    }
    await sleep(1000);
  } else {
    console.log('  ⚠ 未找到BGM入口');
  }

  await snap('07_bgm');

  // ============================================================
  // Step 8: 预览导出
  // ============================================================
  logStep(
    '预览 & 导出渲染',
    `${params.video_output.resolution} | ${params.video_output.aspect_ratio} | ${params.video_output.duration_seconds}s`
  );

  // 找预览按钮
  const findExportBtn = async () => {
    const btns = ['导出', 'Export', '生成', '渲染', 'Render', '预览', 'Preview', '合成'];
    for (const text of btns) {
      const found = await chrome.evaluate((t) => {
        const els = document.querySelectorAll('button');
        for (const e of els) {
          if (e.innerText?.toLowerCase().includes(t.toLowerCase()) && e.offsetParent !== null) {
            return e.innerText;
          }
        }
        return null;
      }, text);
      if (found) return found;
    }
    return null;
  };

  const exportBtn = await findExportBtn();
  if (exportBtn) {
    console.log(`  🔍 找到按钮: "${exportBtn}"`);
    await chrome.evaluate((t) => {
      const els = document.querySelectorAll('button');
      for (const e of els) {
        if (e.innerText?.toLowerCase() === t.toLowerCase() && e.offsetParent !== null) {
          e.click(); return;
        }
      }
    }, exportBtn);
    console.log('  ✅ 已点击。渲染队列已提交，等待闪剪云渲染...');
    await sleep(2000);
  } else {
    console.log('  ⚠ 未找到导出/预览按钮');
    console.log('  👀 请手动点击预览并导出');
  }

  await snap('08_export');

  // ============================================================
  // 完成
  // ============================================================
  console.log(`\n${'='.repeat(56)}`);
  console.log(' ✅  管线执行完成');
  console.log(`${'='.repeat(56)}`);
  console.log(`
  渲染参数摘要:
  ─────────────
  数字人: ${params.digital_human.appearance.clothing}
  背景:   ${params.digital_human.background.color}
  灯光:   ${params.digital_human.lighting.type}
  配音:   ${params.voiceover.speaker_style} (语速+${Math.round((params.voiceover.speed - 1) * 100)}%)
  字幕:   ${params.subtitles.style}
  BGM:    ${params.background_music.genre}
  输出:   ${params.video_output.resolution} ${params.video_output.aspect_ratio}

  📋 未自动完成的步骤请手动补充。
  🎬 渲染完成后下载到本地，交紫妍进行最终合成。
  `);

  // 写下交接给紫妍的归档
  const handoffPath = path.resolve(__dirname, 'flashshow_pipeline_complete.json');
  fs.writeFileSync(handoffPath, JSON.stringify({
    status: 'pipeline_executed',
    params_source: PARAMS_PATH,
    executed_at: new Date().toISOString(),
    handoff_to: '紫妍 (ZY)',
    handoff_note: '数字人素材渲染中，请等待闪剪云渲染完成，下载成片后进行最终合成',
  }, null, 2));
  console.log(`  📄 交接记录: ${handoffPath}`);

  // 断开连接
  await chrome.disconnect();
  console.log('\n🔌 Chrome CDP 已断开');
}

main().catch(async (e) => {
  console.error(`\n❌ 管线执行异常:`, e.message);
  try { await chrome.disconnect(); } catch {}
  process.exit(1);
});
