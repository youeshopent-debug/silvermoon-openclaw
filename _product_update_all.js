const API = require('./lib/shopify-api.js');

async function main() {
  console.log('===== 银月钱庄 · 产品全面更新 =====\n');

  // 5款主力产品映射
  const products = [
    {
      id: 8005574623331,
      title: 'SilverMoon Vision — AI Smart Glasses',
      type: 'AI Wearables',
      tags: 'AI Wearables,Smart Glasses,AI Translation,Hands-Free,Tech Gadgets',
      body_html: `<div class="_rte">
<h2>See the World, Translated</h2>
<p>SilverMoon Vision AI Smart Glasses redefine how you interact with the world. Powered by real-time AI translation, these sleek glasses display translated text directly in your field of view — perfect for travel, business meetings, and language learning.</p>
<ul>
<li>Real-time AI translation in 40+ languages</li>
<li>Hands-free voice assistant integration</li>
<li>Lightweight titanium frame, all-day comfort</li>
<li>Bluetooth 5.3 with crystal-clear audio</li>
<li>Up to 8 hours battery life</li>
</ul>
<p>Step into the future of wearable AI. SilverMoon Vision — your window to a connected world.</p>
</div>`,
      seo_title: 'SilverMoon Vision AI Smart Glasses | Real-Time Translation Wearable',
      seo_description: 'Experience real-time AI translation with SilverMoon Vision smart glasses. 40+ languages, hands-free voice assistant, lightweight titanium frame. The future of wearable AI.'
    },
    {
      id: 8006707282019,
      title: 'SilverMoon Buds Pro — AI Translator Earbuds',
      type: 'AI Audio',
      tags: 'AI Audio,Translator Earbuds,Real-Time Translation,Wireless Earbuds,Tech Gadgets',
      body_html: `<div class="_rte">
<h2>Break Language Barriers Instantly</h2>
<p>SilverMoon Buds Pro are next-gen AI translation earbuds that deliver real-time bidirectional translation. Whether you're negotiating a deal or exploring a foreign city, these earbuds make communication seamless.</p>
<ul>
<li>Real-time bidirectional translation in 40+ languages</li>
<li>AI noise cancellation for crystal-clear calls</li>
<li>Premium ergonomic fit with 3 sizes of ear tips</li>
<li>Up to 6 hours playback, 24h with charging case</li>
<li>IPX5 water resistant, perfect for travel</li>
</ul>
<p>Listen. Speak. Understand. SilverMoon Buds Pro — your universal translator.</p>
</div>`,
      seo_title: 'SilverMoon Buds Pro AI Translator Earbuds | Real-Time Translation',
      seo_description: 'Break language barriers with SilverMoon Buds Pro AI translator earbuds. Real-time bidirectional translation in 40+ languages, AI noise cancellation, premium comfort.'
    },
    {
      id: 8006680871011,
      title: 'SilverMoon ScanPen Pro — AI Scanner & Translator Pen',
      type: 'AI Productivity',
      tags: 'AI Productivity,Scan Pen,Text Scanner,OCR,Translator Pen,AI Gadgets',
      body_html: `<div class="_rte">
<h2>Scan. Translate. Digitize.</h2>
<p>SilverMoon ScanPen Pro is the ultimate AI-powered scanning pen for students, professionals, and language learners. Scan printed text and get instant translation, digitization, and even audio pronunciation.</p>
<ul>
<li>Scan and translate in 50+ languages instantly</li>
<li>OCR digitization — text to editable digital format</li>
<li>Built-in AI voice pronunciation for language learning</li>
<li>Offline mode — no internet required for basic functions</li>
<li>Rechargeable battery, 8 hours continuous use</li>
<li>Supports textbooks, documents, labels, and screens</li>
</ul>
<p>Your pocket-sized AI assistant for reading, learning, and translating.</p>
</div>`,
      seo_title: 'SilverMoon ScanPen Pro | AI Scanner & Translator Pen | OCR Digitizer',
      seo_description: 'SilverMoon ScanPen Pro scans, translates, and digitizes text in 50+ languages. AI-powered OCR, voice pronunciation, offline mode. Perfect for students and professionals.'
    },
    {
      id: 8006680641635,
      title: 'SilverMoon RecorderPen — AI Voice Recorder Pen',
      type: 'AI Productivity',
      tags: 'AI Productivity,Voice Recorder,Meeting Recorder,AI Transcription,Dictation Pen',
      body_html: `<div class="_rte">
<h2>Capture Every Word. Intelligently.</h2>
<p>SilverMoon RecorderPen looks like a premium pen but packs powerful AI voice recording and transcription capabilities. Perfect for journalists, students, and professionals who never want to miss a detail.</p>
<ul>
<li>AI-powered voice recording with smart noise filtering</li>
<li>Automatic speech-to-text transcription</li>
<li>32GB internal storage — record up to 480 hours</li>
<li>One-touch recording, discreet and professional</li>
<li>AI summarization of meeting notes</li>
<li>Works as a premium ballpoint pen too</li>
</ul>
<p>Write. Record. Transcribe. SilverMoon RecorderPen — intelligence in your pocket.</p>
</div>`,
      seo_title: 'SilverMoon RecorderPen | AI Voice Recorder & Transcription Pen',
      seo_description: 'SilverMoon RecorderPen combines a premium pen with AI voice recording, auto-transcription, and smart summarization. 32GB storage, 480h recording capacity.'
    },
    {
      id: 8006680772707,
      title: 'SilverMoon Notepad — AI Digital Writing Tablet',
      type: 'AI Productivity',
      tags: 'AI Productivity,Digital Notepad,Writing Tablet,Eco-Friendly,Paperless',
      body_html: `<div class="_rte">
<h2>Write Digitally. Think Sustainably.</h2>
<p>SilverMoon Notepad is an AI-enhanced LCD writing tablet that lets you take notes, sketch ideas, and organize your thoughts — all without wasting a single sheet of paper.</p>
<ul>
<li>Paper-like LCD writing surface, natural feel</li>
<li>AI handwriting recognition and digital export</li>
<li>One-click erase, reusable thousands of times</li>
<li>Ultra-slim 5mm profile, fits any bag</li>
<li>Built-in AI organization — categorize and search notes</li>
<li>No charging needed for months of use</li>
</ul>
<p>Go paperless with intelligence. SilverMoon Notepad — the smartest way to write.</p>
</div>`,
      seo_title: 'SilverMoon Notepad | AI Digital Writing Tablet | Paperless Notes',
      seo_description: 'SilverMoon Notepad AI digital writing tablet with handwriting recognition, digital export, and paperless note-taking. Reusable thousands of times, ultra-slim design.'
    },
    {
      id: 8006707314787,
      title: 'SilverMoon WritePad — LCD E-Writing Tablet',
      type: 'AI Productivity',
      tags: 'AI Productivity,E-Writing Tablet,LCD Notepad,Doodle Board,Office Supplies',
      body_html: `<div class="_rte">
<h2>Doodle. Note. Create.</h2>
<p>SilverMoon WritePad is your go-to LCD e-writing tablet for quick notes, sketches, memos, and to-do lists. The large writing surface and pressure-sensitive technology make it feel just like pen on paper.</p>
<ul>
<li>Large 12-inch LCD writing surface</li>
<li>Pressure-sensitive, natural writing experience</li>
<li>One-click clear, reusable 100,000+ times</li>
<li>Ultra-lightweight design, fits in any bag</li>
<li>No batteries needed — zero maintenance</li>
<li>Perfect for office, home, and classroom</li>
</ul>
<p>Write freely. Save trees. SilverMoon WritePad — simple, sustainable, smart.</p>
</div>`,
      seo_title: 'SilverMoon WritePad | LCD E-Writing Tablet | Reusable Notepad',
      seo_description: 'SilverMoon WritePad LCD e-writing tablet with pressure-sensitive surface, one-click erase, reusable 100,000+ times. The eco-friendly way to take notes.'
    }
  ];

  // Fix duplicate Notepad → WritePad
  console.log('--- 处理重复命名 ---');

  // 清理4个draft产品
  const drafts = [8006707216483, 8006707249251, 8006707347555, 8006707380323];
  console.log(`\n--- 清理 ${drafts.length} 个草稿产品 ---`);

  for (const id of drafts) {
    try {
      await API.deleteProduct(id);
      console.log(`  ✅ 已删除草稿产品 #${id}`);
    } catch (e) {
      console.log(`  ⚠️ 删除草稿 #${id} 失败: ${e.message}`);
    }
  }

  // 更新6个产品
  let success = 0;
  let fail = 0;

  for (const p of products) {
    const data = {
      title: p.title,
      body_html: p.body_html,
      product_type: p.type,
      tags: p.tags,
      metafields_global_title_tag: p.seo_title,
      metafields_global_description_tag: p.seo_description
    };

    try {
      const res = await API.updateProduct(p.id, data);
      const updated = res.product;
      console.log(`  ✅ [#${p.id}] ${updated.title}`);
      console.log(`     Type: ${updated.product_type}`);
      console.log(`     Tags: ${updated.tags}`);
      console.log(`     SEO: ${updated.handle}`);
      console.log('');
      success++;
    } catch (e) {
      console.log(`  ❌ [#${p.id}] ${p.title} — 失败: ${e.message}\n`);
      fail++;
    }
  }

  // 处理第7个产品（Tech Gear Item — 不属于5款主力, 标记或删除）
  try {
    await API.updateProduct(8006680739939, {
      product_type: 'Uncategorized',
      tags: 'Review Needed,Not Yet Assigned',
      published: false
    });
    console.log('  ✅ [#8006680739939] Tech Gear Item → 已标记为 Uncategorized, 下架待审');
  } catch (e) {
    console.log(`  ⚠️ 处理 Tech Gear Item 失败: ${e.message}`);
  }

  console.log(`\n===== 更新完成: ${success} 成功, ${fail} 失败 =====`);
}

main().catch(console.error);
