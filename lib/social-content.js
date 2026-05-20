const https = require('https');

const OR_BASE = (process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const OR_KEY = String(process.env.OPENROUTER_API_KEY || '').trim();
const OR_MODEL = process.env.OPENROUTER_SOCIAL_MODEL || 'openai/gpt-4o-mini';
const DEEP_MODEL = process.env.OPENROUTER_DEEP_MODEL || 'anthropic/claude-sonnet-20241022';

const BRAND_INFO = {
  name: 'Deep Calm',
  tagline: 'AI-Powered Neural Calm Technology',
  url: 'https://deepcalm-ai.com/en',
  hashtags: ['#DeepCalm', '#NeuralCalm', '#MentalWellness', '#SleepTech', '#AIHealth'],
  tone: 'professional, scientific yet approachable, evidence-based',
};

const PLATFORM_RULES = {
  facebook: { maxLength: 50000, style: 'conversational yet professional, use line breaks, include a call-to-action', imageSize: '1200x630' },
  x: { maxLength: 280, style: 'concise, punchy, hook在前, use 2-3 relevant hashtags', imageSize: '1200x675' },
  reddit: { maxLength: 40000, style: 'community-oriented, authentic, share personal insight or ask a question, avoid pure promotion', imageSize: '1200x600' },
};

function callLLM(messages, model = OR_MODEL, maxTokens = 1024) {
  return new Promise((resolve, reject) => {
    if (!OR_KEY) return reject(new Error('OPENROUTER_API_KEY not set'));
    const body = JSON.stringify({ model, messages, max_tokens: maxTokens });
    const url = new URL(`${OR_BASE}/chat/completions`);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OR_KEY}`,
        'HTTP-Referer': 'https://deepcalm-ai.com',
        'X-Title': 'OpenClaw Social Automation',
      },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          else resolve(parsed.choices?.[0]?.message?.content || '');
        } catch { reject(new Error('LLM response parse failed: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generatePost(topic, platform = 'facebook') {
  const rules = PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;
  const prompt = `You are a social media content creator for ${BRAND_INFO.name}, a ${BRAND_INFO.tagline} product.

Topic: "${topic.title}"
${topic.description ? 'Context: ' + topic.description : ''}

Create a ${platform} post that:
1. Connects the topic to ${BRAND_INFO.name}'s mission of neural calm and mental wellness
2. Naturally incorporates ${BRAND_INFO.name}'s value proposition
3. Includes a link to ${BRAND_INFO.url}
4. Uses ${rules.style}
5. Maximum ${rules.maxLength} characters
6. If relevant, include ${BRAND_INFO.hashtags.slice(0, 3).join(' ')}
7. Must include the call-to-action: "Discover the science of calm at ${BRAND_INFO.url}"

Return ONLY the post content, no explanations.`;

  const content = await callLLM([
    { role: 'system', content: `You are a professional social media copywriter specializing in health-tech and wellness content. Tone: ${BRAND_INFO.tone}.` },
    { role: 'user', content: prompt },
  ]);
  return {
    platform,
    content: content.trim(),
    topic: topic.title,
    source: topic.source,
    url: topic.url,
    hashtags: BRAND_INFO.hashtags,
    createdAt: new Date().toISOString(),
  };
}

async function generateDeepArticle(topic, wordCount = 2000) {
  const prompt = `Write a professional, science-backed article (${wordCount} words) about:

Main Topic: "${topic.title}"
${topic.description ? 'Additional Context: ' + topic.description : ''}

Requirements:
- Connect to ${BRAND_INFO.name}'s mission of neural calm and mental wellness
- Use evidence-based claims and cite relevant research where applicable
- Structure: Hook → Problem → Scientific Explanation → Solution → Call to Action
- Include at least one reference to ${BRAND_INFO.url} as a resource
- End with a conclusion that encourages readers to learn more about ${BRAND_INFO.name}
- Make it accessible to a general audience while maintaining scientific rigor
- Include a compelling headline
- Include 3-5 key takeaways at the end

Format in markdown. No explanations before or after the article.`;

  const content = await callLLM([
    { role: 'system', content: `You are a science and health journalist with expertise in neuroscience, sleep research, and mental wellness. You write for a platform that bridges cutting-edge research with practical wellness solutions.` },
    { role: 'user', content: prompt },
  ], DEEP_MODEL, 4096);

  return {
    title: topic.title,
    content: content.trim(),
    wordCount: content.trim().split(/\s+/).length,
    topic: topic.title,
    createdAt: new Date().toISOString(),
  };
}

async function generateMultiPlatformPosts(topic) {
  const [facebook, x, reddit] = await Promise.all([
    generatePost(topic, 'facebook'),
    generatePost(topic, 'x'),
    generatePost(topic, 'reddit'),
  ]);
  return { facebook, x, reddit };
}

module.exports = { generatePost, generateDeepArticle, generateMultiPlatformPosts, BRAND_INFO, PLATFORM_RULES };
