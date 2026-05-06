import https from 'https';
import { URL } from 'url';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';
const VER = '2025-10';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${VER}${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject({ status: res.statusCode, errors: parsed.errors || parsed });
          else resolve(parsed);
        } catch (e) { reject({ status: res.statusCode, raw: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Shopify API 批量设置 ===\n');

  // 1. 创建商品分类（Collections）
  console.log('1. 创建商品分类...');
  const collections = [
    { title: 'AI Workflows', description: 'Pre-built AI automation workflows to supercharge your productivity' },
    { title: 'Developer Tools', description: 'Essential tools and scripts for modern developers' },
    { title: 'Digital Guides', description: 'Step-by-step guides for跨境 e-commerce and AI automation' },
    { title: 'Tech Gear', description: 'Curated tech lifestyle merchandise for builders' },
  ];
  for (const c of collections) {
    try {
      await rest('POST', '/custom_collections.json', {
        custom_collection: {
          title: c.title,
          body_html: `<p>${c.description}</p>`,
          published: true,
        }
      });
      console.log(`   ✅ 分类: ${c.title}`);
    } catch (e) {
      console.log(`   ⚠️ 分类 ${c.title}: ${e.errors?.message || e.message}`);
    }
  }

  // 2. 创建页面（About / Contact / FAQ）
  console.log('\n2. 创建页面...');
  const pages = [
    {
      title: 'About SilverMoon Bank',
      body_html: `<h2>Built for Builders</h2>
<p>SilverMoon Bank is a next-gen digital asset gateway founded by Alan Lau. We specialize in AI automation workflows, developer productivity tools, and curated tech lifestyle gear.</p>
<p>Our mission: empower modern builders with the tools they need to ship faster, automate smarter, and live better.</p>
<p>Based in Kuala Lumpur, serving the world.</p>`,
      published: true,
    },
    {
      title: 'Contact Us',
      body_html: `<h2>Get in Touch</h2>
<p>Email: <a href="mailto:hello@silvermoon.bank">hello@silvermoon.bank</a></p>
<p>We typically respond within 24 hours.</p>`,
      published: true,
    },
    {
      title: 'FAQ',
      body_html: `<h2>Frequently Asked Questions</h2>
<h3>What are digital products?</h3>
<p>Our digital products include AI workflow templates, code snippets, and step-by-step guides. They are delivered instantly upon purchase.</p>
<h3>Do you ship internationally?</h3>
<p>Yes! We ship worldwide. Shipping times vary by location.</p>
<h3>What payment methods do you accept?</h3>
<p>We accept all major credit cards, PayPal, and Shop Pay.</p>
<h3>Can I get a refund?</h3>
<p>Digital products are non-refundable but we offer support. Physical items can be returned within 30 days.</p>`,
      published: true,
    },
  ];
  for (const p of pages) {
    try {
      await rest('POST', '/pages.json', { page: p });
      console.log(`   ✅ 页面: ${p.title}`);
    } catch (e) {
      console.log(`   ⚠️ 页面 ${p.title}: ${e.errors?.message || e.message}`);
    }
  }

  // 3. 创建 Webhook（订单创建/支付）
  console.log('\n3. 注册 Webhook...');
  const webhooks = [
    { topic: 'orders/create', address: 'http://127.0.0.1:18791/webhook/shopify/order', format: 'json' },
    { topic: 'orders/paid', address: 'http://127.0.0.1:18791/webhook/shopify/paid', format: 'json' },
    { topic: 'orders/cancelled', address: 'http://127.0.0.1:18791/webhook/shopify/cancel', format: 'json' },
  ];
  for (const w of webhooks) {
    try {
      await rest('POST', '/webhooks.json', { webhook: w });
      console.log(`   ✅ Webhook: ${w.topic}`);
    } catch (e) {
      console.log(`   ⚠️ Webhook ${w.topic}: ${e.errors?.message || e.message}`);
    }
  }

  // 4. 创建价格规则（折扣）
  console.log('\n4. 创建欢迎折扣...');
  try {
    await rest('POST', '/price_rules.json', {
      price_rule: {
        title: 'Welcome10',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: 'percentage',
        value: '-10.0',
        customer_selection: 'all',
        starts_at: new Date().toISOString(),
        usage_limit: 100,
      }
    });
    console.log('   ✅ 欢迎折扣 10% OFF 已创建');
  } catch (e) {
    console.log(`   ⚠️ 折扣创建: ${e.errors?.message || e.message}`);
  }

  // 5. 创建博客文章
  console.log('\n5. 创建博客文章...');
  try {
    // 先查有没有博客
    const blogs = await rest('GET', '/blogs.json');
    let blogId;
    if (blogs.blogs.length === 0) {
      const newBlog = await rest('POST', '/blogs.json', { blog: { title: 'SilverMoon Blog', commentable: 'moderate' } });
      blogId = newBlog.blog.id;
      console.log('   ✅ 博客已创建');
    } else {
      blogId = blogs.blogs[0].id;
      console.log(`   ✅ 使用现有博客 ID: ${blogId}`);
    }
    
    // 创建第一篇博文
    await rest('POST', `/blogs/${blogId}/articles.json`, {
      article: {
        title: 'Welcome to SilverMoon Bank — Your AI Automation Gateway',
        author: 'Alan Lau',
        body_html: `<p>Welcome to SilverMoon Bank! We're excited to launch our platform dedicated to AI automation, developer tools, and curated tech lifestyle gear.</p>
<p>In the coming weeks, we'll be sharing:</p>
<ul>
<li>🔧 Step-by-step AI workflow tutorials</li>
<li>💻 Developer productivity hacks</li>
<li>📦 New product launches and exclusive deals</li>
<li>🌐 Cross-border e-commerce insights</li>
</ul>
<p>Stay tuned and follow us for updates!</p>`,
        published: true,
      }
    });
    console.log('   ✅ 欢迎博文已创建');
  } catch (e) {
    console.log(`   ⚠️ 博客创建: ${e.errors?.message || e.message}`);
  }

  // 6. 创建导航菜单（通过 REST API 的 tend 可能不支持，先跳过）
  console.log('\n6. 设置完成！');
  console.log('\n=== 以下内容需要浏览器操作 ===');
  console.log('   📝 店铺名称 → SilverMoon Bank');
  console.log('   📧 联系邮箱 → hello@silvermoon.bank');
  console.log('   📍 地址信息');
  console.log('   🎨 主题品牌色配置');
  console.log('   🧭 导航菜单');
  console.log('   🔒 关闭密码保护（上线）');
}

main().catch(console.error);
