const assert = require('assert');

const {
  uniq,
  isDossierRequest,
  stripTrackingParams,
  guessBrand,
  extractSameOriginCandidateUrlsFromHtml,
  extractKeyLines,
} = require('../lib/link-dossier-utils');

async function run() {
  {
    assert.equal(isDossierRequest('给我报告'), true);
    assert.equal(isDossierRequest('详细资料'), true);
    assert.equal(isDossierRequest('看看链接'), false);
  }

  {
    const u = stripTrackingParams('https://a.test/x?utm_source=fb&fbclid=1&k=2');
    assert.equal(u, 'https://a.test/x?k=2');
  }

  {
    assert.equal(guessBrand({ title: 'VpropTrader | Instant Funded Trading Account' }, 'https://vproptrader.com/home'), 'VpropTrader');
    assert.equal(guessBrand({}, 'https://www.example.com/a/b'), 'example');
  }

  {
    const html = [
      '<a href="/terms">Terms</a>',
      '<a href="https://site.test/privacy-policy?utm_source=x">Privacy</a>',
      '<a href="https://evil.test/about">About</a>',
      '<a href="#x">Skip</a>',
    ].join('\n');
    const urls = extractSameOriginCandidateUrlsFromHtml(html, 'https://site.test/', 10);
    assert.deepEqual(urls, ['https://site.test/terms', 'https://site.test/privacy-policy']);
  }

  {
    const text = [
      'Get funded instantly. No challenge needed.',
      'Profit split up to 95%',
      'Contact us at support@example.com',
      'Random short',
    ].join('\n');
    const out = extractKeyLines(text, [/profit/i, /contact/i], 10);
    assert.deepEqual(out, ['Profit split up to 95%', 'Contact us at support@example.com']);
  }

  {
    assert.deepEqual(uniq(['a', ' a ', '', 'b', 'a']), ['a', 'b']);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

