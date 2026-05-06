import https from 'https';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.env.USERPROFILE, '.openclaw', 'auth-profiles.json');
const data = fs.readFileSync(AUTH_FILE, 'utf8');
const authProfiles = JSON.parse(data);
const profile = authProfiles.profiles['kimi-web:default'];
const auth = JSON.parse(profile.token);

console.log('accessToken:', auth.accessToken?.slice(0, 50) + '...');
console.log('cookie:', auth.cookie?.slice(0, 50) + '...');

const body = JSON.stringify({
  model: 'moonshot-v1-128k',
  messages: [{ role: 'user', content: 'Say hello in one sentence' }],
  stream: false,
});

const options = {
  hostname: 'kimi.com',
  path: '/api/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Authorization': `Bearer ${auth.accessToken}`,
    'Cookie': auth.cookie || '',
    'User-Agent': auth.userAgent || 'Mozilla/5.0',
    'Origin': 'https://kimi.com',
    'Referer': 'https://kimi.com/',
  },
  rejectUnauthorized: false,
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    console.log('\nStatus:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers));
    console.log('\nBody:', responseData.slice(0, 500));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
