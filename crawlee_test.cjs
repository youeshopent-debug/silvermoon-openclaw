const crawler = require('./lib/xiaoyan-crawler');

async function main() {
  console.log('Crawlee 就绪:', crawler._crawleeReady);
  
  // 如果还没就绪，等它初始化
  if (!crawler._crawleeReady) {
    await crawler._initCrawlee();
    console.log('初始化后:', crawler._crawleeReady);
  }
  
  if (!crawler._crawleeReady) {
    console.log('❌ Crawlee 不可用');
    return;
  }
  
  console.log('✅ Crawlee 可用，开始爬取 AI 极客产品...');
  
  // 爬取 CJ Dropshipping / AliExpress 的 AI 极客产品
  const result = await crawler.crawlEcommerce(
    ['AI smart desk accessories', 'mechanical keyboard', 'RGB mouse pad', 'noise cancelling microphone'],
    ['aliexpress.com', 'amazon.com']
  );
  
  console.log('爬取完成！');
  console.log('成功:', result.success);
  console.log('数据条数:', result.data?.length || 0);
  if (result.data?.length > 0) {
    console.log('前3条数据:');
    result.data.slice(0, 3).forEach((item, i) => {
      console.log(`\n--- 产品 ${i+1} ---`);
      console.log(JSON.stringify(item, null, 2));
    });
  }
  
  // 看看爬取历史
  const summary = crawler.getDataSummary();
  console.log('\n📊 爬取历史:');
  summary.forEach(s => console.log(`  ${s.file} (${(s.size/1024).toFixed(1)}KB)`));
}

main().catch(err => {
  console.error('❌ 出错:', err.message);
  console.error(err.stack);
});
