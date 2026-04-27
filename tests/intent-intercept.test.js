const assert = require('assert');

async function run() {
  const { tryIntentIntercept } = require('../lib/intent');
  assert.equal(typeof tryIntentIntercept, 'function');

  {
    const out = await tryIntentIntercept('你好', {
      fetchUsdMyr: async () => 4.7,
      fetchMetalsSpotUsd: async () => ({ gold: 2300.1 }),
      fetchCryptoUsd: async () => ({ btc: 65000, eth: 3500, btcChg: 0.1, ethChg: -0.2 }),
    });
    assert.equal(out, null);
  }

  {
    const out = await tryIntentIntercept('现在美元兑马币汇率多少？', {
      fetchUsdMyr: async () => 4.7777,
      fetchMetalsSpotUsd: async () => ({ gold: 2300.1 }),
      fetchCryptoUsd: async () => ({ btc: 65000, eth: 3500, btcChg: 0.1, ethChg: -0.2 }),
    });
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('✅ 主人'), true);
    assert.equal(out.includes('🔹'), true);
    assert.equal(/马币汇率/.test(out), true);
  }

  {
    const out = await tryIntentIntercept('金价怎么样', {
      fetchUsdMyr: async () => 4.7,
      fetchMetalsSpotUsd: async () => ({ gold: 2345.67, silver: 28.9 }),
      fetchCryptoUsd: async () => ({ btc: 65000, eth: 3500, btcChg: 0.1, ethChg: -0.2 }),
    });
    assert.equal(typeof out, 'string');
    assert.equal(/国际黄金|金价/.test(out), true);
  }

  {
    const out = await tryIntentIntercept('BTC 和 ETH 现在多少', {
      fetchUsdMyr: async () => 4.7,
      fetchMetalsSpotUsd: async () => ({ gold: 2345.67 }),
      fetchCryptoUsd: async () => ({ btc: 70000, eth: 3800, btcChg: 1.2, ethChg: -0.5 }),
    });
    assert.equal(typeof out, 'string');
    assert.equal(/比特币|BTC/.test(out), true);
    assert.equal(/以太坊|ETH/.test(out), true);
  }

  {
    const out = await tryIntentIntercept('斗湖今天天气怎么样', {
      fetchWeather: async () => '晴朗，28度',
    });
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('天气快报'), true);
    assert.equal(out.includes('晴朗'), true);
  }

  {
    const out = await tryIntentIntercept('帮我查查 Web3 的最新智讯', {
      fetchNews: async () => 'Web3 峰会今日开幕',
    });
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('今日头条'), true);
    assert.equal(out.includes('Web3'), true);
  }

  {
    const out = await tryIntentIntercept('提醒我明天开会', {});
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('提醒助手'), true);
    assert.equal(out.includes('!remind'), true);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

