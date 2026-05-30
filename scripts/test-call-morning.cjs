const http = require('http');
const data = JSON.stringify({ force: true, source: 'diagnostic' });
const req = http.request({
  hostname: '127.0.0.1', port: 18791,
  path: '/api/actions/morning-brief',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body.slice(0, 1000)));
});
req.on('error', e => console.error('REQ ERROR:', e.message));
req.write(data);
req.end();
