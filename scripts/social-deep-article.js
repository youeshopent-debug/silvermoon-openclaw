const path = require('path');
const fs = require('fs');
const alert = require('./alert');
const { generateDeepArticle } = require('../lib/social-content');
const { generateArticleImage } = require('../lib/social-image');
const { postToFacebook, postToX, postToReddit, FB_PAGE_URL } = require('../lib/social-poster');

const ROOT = path.resolve(__dirname, '..');

const DEEP_TOPICS = [
  'The Neuroscience of Deep Calm: How AI-Powered Audio Reshapes Brainwave Patterns',
  'Sleep Architecture and Technology: A Systematic Review of Digital Sleep Interventions',
  'Anxiety in the Digital Age: Neural Mechanisms and Technology-Assisted Relief',
  'Heart Rate Variability (HRV) and Calm: The Biological Bridge Between Mind and Rest',
  'Cognitive Behavioral Therapy Meets AI: Personalized Anxiety Management at Scale',
  'The Impact of Binaural Beats on Sleep Onset: A Meta-Analysis of Recent Studies',
  'Circadian Rhythm Optimization: How Technology Can Restore Natural Sleep-Wake Cycles',
  'Vagus Nerve Stimulation Through Audio: Non-Invasive Pathways to Stress Reduction',
  'Chronic Stress and Neuroplasticity: Rebuilding Calm Through Consistent Practice',
  'Melatonin, Blue Light, and the Modern Sleep Crisis: A Calm Technology Solution',
];

let topicIndex = -1;

function pickNextTopic() {
  topicIndex = (topicIndex + 1) % DEEP_TOPICS.length;
  const topicFile = path.join(ROOT, 'data', '.deep_article_index');
  try {
    fs.writeFileSync(topicFile, String(topicIndex));
  } catch {}
  return DEEP_TOPICS[topicIndex];
}

function loadLastIndex() {
  const topicFile = path.join(ROOT, 'data', '.deep_article_index');
  try {
    topicIndex = parseInt(fs.readFileSync(topicFile, 'utf8').trim(), 10);
    if (isNaN(topicIndex)) topicIndex = -1;
  } catch {
    topicIndex = -1;
  }
}

async function run() {
  console.log('='.repeat(40));
  console.log('[deep-article] 开始每周深度论文管线');
  console.log(`[deep-article] 时间: ${new Date().toISOString()}`);
  console.log('='.repeat(40));

  let results = [];

  try {
    loadLastIndex();
    const topic = pickNextTopic();
    console.log(`\n[Step 1] 选定主题: ${topic}`);

    console.log('[Step 2] 生成深度论文内容...');
    const article = await generateDeepArticle(topic, 2500);
    console.log(`[deep-article] 论文生成完成 (${article.wordCount} 字)`);

    console.log('[Step 3] 生成论文配图...');
    const imgResult = await generateArticleImage(article.title, 'Deep Calm — AI-Powered Neural Calm Technology');
    console.log(`[deep-article] 配图: ${imgResult.filename}`);

    const facebookContent = [
      article.title,
      '',
      article.content.slice(0, 3000),
      '',
      '---',
      '',
      'This article is part of the Deep Calm Research Series.',
      'Discover the science of neural calm at https://deepcalm-ai.com/en',
      '',
      '#DeepCalm #Neuroscience #SleepHealth #MentalWellness #AIHealth',
    ].join('\n');

    const redditContent = [
      article.title,
      '',
      article.content.slice(0, 5000),
      '',
      '---',
      '',
      '*This post is part of the Deep Calm Research Series.*',
      'Learn more: https://deepcalm-ai.com/en',
    ].join('\n');

    const xThread = threadContent(article.title, article.content);

    console.log('[Step 4] 发布到Facebook...');
    try {
      const fbResult = await postToFacebook({ content: facebookContent, imagePath: imgResult.filepath, pageUrl: FB_PAGE_URL });
      results.push({ platform: 'facebook', ...fbResult });
      console.log(fbResult.success ? '  ✅ Facebook 发布成功' : `  ⚠️ Facebook 失败: ${fbResult.error}`);
    } catch (err) {
      console.error('  ❌ Facebook 异常:', err.message);
      results.push({ platform: 'facebook', success: false, error: err.message });
    }

    console.log('[Step 5] 发布到X (Thread)...');
    try {
      for (let t = 0; t < xThread.length; t++) {
        console.log(`  X Thread 第${t+1}/${xThread.length}条...`);
        const xResult = await postToX({ content: xThread[t], imagePath: t === 0 ? imgResult.filepath : undefined });
        if (!xResult.success) {
          results.push({ platform: 'x', success: false, error: xResult.error, tweetIndex: t });
          break;
        }
        if (t === 0) results.push({ platform: 'x', success: true, threadLength: xThread.length });
      }
    } catch (err) {
      console.error('  ❌ X 异常:', err.message);
      if (!results.find(r => r.platform === 'x')) results.push({ platform: 'x', success: false, error: err.message });
    }

    console.log('[Step 6] 发布到Reddit...');
    try {
      const rdResult = await postToReddit({
        title: article.title.slice(0, 300),
        content: redditContent,
        imagePath: imgResult.filepath,
        subreddit: 'healthtech',
      });
      results.push({ platform: 'reddit', ...rdResult });
      console.log(rdResult.success ? '  ✅ Reddit 发布成功' : `  ⚠️ Reddit 失败: ${rdResult.error}`);
    } catch (err) {
      console.error('  ❌ Reddit 异常:', err.message);
      results.push({ platform: 'reddit', success: false, error: err.message });
    }

    const totalSuccess = results.filter(r => r.success).length;
    const totalFail = results.filter(r => !r.success).length;

    const summary = {
      type: 'deep_article',
      timestamp: new Date().toISOString(),
      topic,
      articleTitle: article.title,
      wordCount: article.wordCount,
      nextTopicIndex: topicIndex,
      results,
    };

    writeReport(summary);

    if (totalFail === 0) {
      await alert('success', 'DeepArticle',
        `📄 深度论文发布完成 | "${article.title.slice(0, 60)}..." | ${totalSuccess}个平台`);
    } else {
      await alert('failure', 'DeepArticle',
        `⚠️ 深度论文部分失败 | 成功${totalSuccess} 失败${totalFail}`,
        new Error(results.filter(r => !r.success).map(r => `${r.platform}:${r.error}`).join('; ')));
    }

    console.log('\n' + '='.repeat(40));
    console.log(`[deep-article] 完成 | 成功: ${totalSuccess} | 失败: ${totalFail}`);
    console.log('='.repeat(40));

    return summary;
  } catch (err) {
    console.error('[deep-article] 管线崩溃:', err);
    await alert('failure', 'DeepArticle', '❌ 深度论文管线崩溃', err);
    throw err;
  }
}

function threadContent(title, content) {
  const intro = `🧵 ${title}\n\nA thread on the science behind Deep Calm.\n\n🧠`;
  const body = content.split('\n').filter(Boolean).slice(0, 8).join('\n\n').slice(0, 2000);
  const outro = `👇\nExperience the science of calm → https://deepcalm-ai.com/en\n\n#DeepCalm #Neuroscience #SleepHealth`;

  const all = [intro, body, outro];
  const tweets = [];
  let current = '';
  for (const part of all) {
    if ((current + '\n\n' + part).length < 280) {
      current = current ? current + '\n\n' + part : part;
    } else {
      if (current) tweets.push(current);
      current = part;
    }
  }
  if (current) tweets.push(current);
  return tweets;
}

function writeReport(summary) {
  const reportPath = path.join(ROOT, 'data', 'deep_article_report.jsonl');
  try {
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(reportPath, JSON.stringify(summary) + '\n');
  } catch {}
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { run, pickNextTopic, DEEP_TOPICS };
