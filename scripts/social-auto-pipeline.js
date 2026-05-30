const path = require('path');
const fs = require('fs');
const alert = require('./alert');
const { fetchTrends } = require('../lib/trend-fetcher');
const { generateMultiPlatformPosts } = require('../lib/social-content');
const { generateSocialImage } = require('../lib/social-image');
const { postToFacebook, postToX, postToReddit, FB_PAGE_URL } = require('../lib/social-poster');

const ROOT = path.resolve(__dirname, '..');
const DISPATCH_LOG = path.join(ROOT, '.silvermoon_core', 'dispatched_tasks.jsonl');

const GOLDEN_HOURS = {
  facebook: '09:00',
  x: '08:00',
  reddit: '14:00',
};

const SUBREDDIT_MAP = {
  default: 'healthtech',
  sleep: 'sleep',
  anxiety: 'Anxiety',
  meditation: 'Meditation',
  neuroscience: 'neuroscience',
  ai: 'artificial',
  wellness: 'Wellness',
};

async function run() {
  console.log('='.repeat(40));
  console.log(`[social-pipeline] 开始每日社交媒体自动化管线`);
  console.log(`[social-pipeline] 时间: ${new Date().toISOString()}`);
  console.log('='.repeat(40));

  let successCount = 0;
  let failCount = 0;
  const results = [];

  try {
    console.log('\n[Step 1] 抓取热门趋势...');
    const trends = await fetchTrends(5);
    console.log(`[social-pipeline] 抓取到 ${trends.length} 条趋势`);
    trends.forEach((t, i) => console.log(`  ${i+1}. ${t.title} (score: ${t.score})`));

    if (trends.length === 0) {
      console.warn('[social-pipeline] 无可用趋势，使用默认话题');
      trends.push({
        source: 'default',
        title: 'The Science of Sleep: How AI is Revolutionizing Rest',
        description: 'New AI-powered approaches to improving sleep quality and reducing insomnia',
        url: 'https://deepcalm-ai.com/en',
        votes: 100,
        createdAt: Date.now(),
      });
    }

    for (let i = 0; i < trends.length; i++) {
      const topic = trends[i];
      console.log(`\n--- 趋势 ${i+1}/${trends.length}: ${topic.title} ---`);

      try {
        console.log('  [Step 2a] 生成三平台帖文...');
        const posts = await generateMultiPlatformPosts(topic);
        console.log('  ✅ 帖文生成完成');

        const platforms = ['facebook', 'x', 'reddit'];
        for (const platform of platforms) {
          try {
            const post = posts[platform];
            if (!post || !post.content) {
              console.warn(`  ⚠️ ${platform} 无内容，跳过`);
              continue;
            }

            console.log(`  [Step 2b] 生成 ${platform} 配图...`);
            const imgResult = await generateSocialImage(topic.title, platform);
            console.log(`  ✅ ${platform} 配图: ${imgResult.filename}`);

            console.log(`  [Step 2c] 发布到 ${platform}...`);
            let publishResult;
            if (platform === 'facebook') {
              publishResult = await postToFacebook({
                content: post.content,
                imagePath: imgResult.filepath,
                pageUrl: FB_PAGE_URL,
              });
            } else if (platform === 'x') {
              const xContent = post.content.length > 280
                ? post.content.slice(0, 277) + '...'
                : post.content;
              publishResult = await postToX({
                content: xContent,
                imagePath: imgResult.filepath,
              });
            } else if (platform === 'reddit') {
              const subreddit = pickSubreddit(topic);
              publishResult = await postToReddit({
                title: topic.title.slice(0, 300),
                content: post.content,
                imagePath: imgResult.filepath,
                subreddit,
              });
            }

            if (publishResult.success) {
              console.log(`  ✅ ${platform} 发布成功`);
              successCount++;
            } else {
              console.warn(`  ⚠️ ${platform} 发布失败: ${publishResult.error}`);
              failCount++;
            }
            results.push({ platform, topic: topic.title, ...publishResult });
          } catch (err) {
            console.error(`  ❌ ${platform} 异常:`, err.message);
            failCount++;
          }
        }
      } catch (err) {
        console.error(`  ❌ 趋势 ${topic.title} 处理失败:`, err.message);
        failCount++;
      }
    }

    const summary = {
      type: 'social_pipeline',
      timestamp: new Date().toISOString(),
      trendsFound: trends.length,
      successCount,
      failCount,
      total: successCount + failCount,
      results,
    };

    writeDispatch(summary);
    writeReport(summary);

    if (failCount === 0 && successCount > 0) {
      await alert('success', 'SocialPipeline',
        `✅ 社交媒体管线完成 | ${successCount}条帖文已发布 | ${trends.length}条趋势已处理`);
    } else if (failCount > 0) {
      await alert('failure', 'SocialPipeline',
        `⚠️ 社交媒体管线部分完成 | 成功${successCount} 失败${failCount} | ${trends.length}条趋势`,
        new Error(results.filter(r => !r.success).map(r => `${r.platform}:${r.error}`).join('; ')));
    }

    console.log('\n' + '='.repeat(40));
    console.log(`[social-pipeline] 管线完成 | 成功: ${successCount} | 失败: ${failCount}`);
    console.log('='.repeat(40));

    return summary;
  } catch (err) {
    console.error('[social-pipeline] 管线崩溃:', err);
    await alert('failure', 'SocialPipeline', '❌ 社交媒体管线崩溃', err);
    throw err;
  }
}

function pickSubreddit(topic) {
  const text = (topic.title + ' ' + (topic.description || '')).toLowerCase();
  for (const [keyword, sub] of Object.entries(SUBREDDIT_MAP)) {
    if (keyword !== 'default' && text.includes(keyword)) return sub;
  }
  return SUBREDDIT_MAP.default;
}

function writeDispatch(summary) {
  try {
    const dir = path.dirname(DISPATCH_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(DISPATCH_LOG, JSON.stringify({
      at: new Date().toISOString(),
      target: 'xiaoyixian',
      task: `Social pipeline completed: ${summary.successCount} posts published from ${summary.trendsFound} trends`,
      priority: 'medium',
      status: 'pending',
      source: 'social-auto-pipeline',
      summary,
    }) + '\n');
  } catch {}
}

function writeReport(summary) {
  const reportPath = path.join(ROOT, 'data', 'social_pipeline_report.jsonl');
  try {
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(reportPath, JSON.stringify(summary) + '\n');
  } catch {}
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { run };
