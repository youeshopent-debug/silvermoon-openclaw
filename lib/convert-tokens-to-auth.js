const fs = require('fs');
const path = require('path');

const TOKENS_FILE = path.join(__dirname, '..', 'zero_token_tokens_final.json');
const AUTH_FILE = path.join(process.env.USERPROFILE || 'C:\\Users\\User', '.openclaw', 'auth-profiles.json');

function domainCookies(cookies, domain) {
  return cookies
    .filter(c => c.domain.includes(domain))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

const PROVIDER_CONFIG = {
  'deepseek-web': {
    name: 'DeepSeek',
    apiUrl: 'https://chat.deepseek.com/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const bearer = c.find(x => x.name === 'authorization' || x.name === 'Authorization' || x.name === 'token');
      const session = c.find(x => x.name.toLowerCase().includes('session') || x.name.toLowerCase().includes('sid'));
      return { accessToken: bearer?.value || session?.value || '', cookie: domainCookies(c, 'deepseek') };
    },
  },
  'claude-web': {
    name: 'Claude',
    apiUrl: 'https://claude.ai/api/chat_completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const session = c.find(x => x.name.toLowerCase().includes('session') || x.name === '__Secure-next-auth.session-token');
      return { accessToken: session?.value || '', cookie: domainCookies(c, 'claude') };
    },
  },
  'chatgpt-web': {
    name: 'ChatGPT',
    apiUrl: 'https://chatgpt.com/backend-api/conversation',
    tokenExtract: (data) => {
      const c = data.cookies;
      const session = c.find(x => x.name === '__Secure-next-auth.session-token' || x.name.toLowerCase().includes('session'));
      const accessToken = c.find(x => x.name.toLowerCase().includes('access') || x.name.toLowerCase().includes('token'));
      return { accessToken: accessToken?.value || session?.value || '', cookie: domainCookies(c, 'chatgpt') };
    },
  },
  'qwen-web': {
    name: 'Qwen',
    apiUrl: 'https://chat.qwen.ai/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const ls = data.localStorage || {};
      const token = ls['token'] || ls['access_token'] || '';
      const session = c.find(x => x.name.toLowerCase().includes('session') || x.name.toLowerCase().includes('token'));
      return { accessToken: token || session?.value || '', cookie: domainCookies(c, 'qwen') };
    },
  },
  'kimi-web': {
    name: 'Kimi',
    apiUrl: 'https://kimi.com/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const auth = c.find(x => x.name === 'kimi-auth' || x.name.toLowerCase().includes('auth'));
      const ls = data.localStorage || {};
      const token = ls['kimi-auth'] || ls['access_token'] || '';
      return { accessToken: auth?.value || token || '', cookie: domainCookies(c, 'kimi') };
    },
  },
  'gemini-web': {
    name: 'Gemini',
    apiUrl: 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
    tokenExtract: (data) => {
      const c = data.cookies;
      const session = c.find(x => x.name === '__Secure-1PSID' || x.name === '__Secure-1PSIDTS' || x.name.toLowerCase().includes('sid'));
      return { accessToken: session?.value || '', cookie: domainCookies(c, 'google') };
    },
  },
  'grok-web': {
    name: 'Grok',
    apiUrl: 'https://grok.com/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const session = c.find(x => x.name.toLowerCase().includes('session') || x.name.toLowerCase().includes('token') || x.name.toLowerCase().includes('auth'));
      return { accessToken: session?.value || '', cookie: domainCookies(c, 'grok') };
    },
  },
  'doubao-web': {
    name: 'Doubao',
    apiUrl: 'https://www.doubao.com/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const session = c.find(x => x.name.toLowerCase().includes('session') || x.name.toLowerCase().includes('token'));
      return { accessToken: session?.value || '', cookie: domainCookies(c, 'doubao') };
    },
  },
  'glm-web': {
    name: 'GLM',
    apiUrl: 'https://chatglm.cn/api/chat/completions',
    tokenExtract: (data) => {
      const c = data.cookies;
      const token = c.find(x => x.name === 'chatglm_token' || x.name === 'chatglm_refresh_token');
      const ls = data.localStorage || {};
      return { accessToken: token?.value || ls['token'] || '', cookie: domainCookies(c, 'chatglm') };
    },
  },
};

function main() {
  const raw = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  const profiles = { version: 1, profiles: {} };

  for (const [providerId, config] of Object.entries(PROVIDER_CONFIG)) {
    const data = raw[providerId];
    if (!data || data.error) {
      console.log(`  ⚠️ ${config.name}: 无数据，跳过`);
      continue;
    }
    try {
      const token = config.tokenExtract(data);
      const profileKey = `${providerId}:default`;
      profiles.profiles[profileKey] = {
        token: JSON.stringify(token),
        createdAt: new Date().toISOString(),
        source: 'chrome-profile3',
      };
      console.log(`  ✅ ${config.name}: accessToken=${token.accessToken.slice(0, 30)}...`);
    } catch (e) {
      console.log(`  ❌ ${config.name}: ${e.message}`);
    }
  }

  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  console.log(`\n✅ Auth profiles 已写入: ${AUTH_FILE}`);
  console.log(`共 ${Object.keys(profiles.profiles).length} 个 provider`);
}

main();
