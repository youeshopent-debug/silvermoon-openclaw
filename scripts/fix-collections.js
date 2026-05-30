const https = require('https');
const TOKEN = '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';
const HOST = 'aigenie-hub.myshopify.com';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = {
      hostname: HOST, path: '/admin/api/2024-10/graphql.json', method: 'POST',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('Parse failed: ' + d.slice(0, 500))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1) List all collections
  console.log('=== Collections ===');
  let r = await gql(`query { collections(first: 50) { edges { node { id title } } } }`);
  const cols = r.data?.collections?.edges?.map(e => ({ id: e.node.id, title: e.node.title, shortId: e.node.id.split('/').pop() })) || [];
  cols.forEach(c => console.log(`  [${c.shortId}] ${c.title}`));

  // 2) List all products
  console.log('\n=== Products ===');
  r = await gql(`query { products(first: 50) { edges { node { id title } } } }`);
  const products = r.data?.products?.edges?.map(e => ({ id: e.node.id, title: e.node.title, shortId: e.node.id.split('/').pop() })) || [];
  products.forEach(p => console.log(`  [${p.shortId}] ${p.title}`));

  // 3) For each collection, list its products
  console.log('\n=== Collection Members ===');
  for (const c of cols) {
    r = await gql(`query($id: ID!) { collection(id: $id) { products(first: 50) { edges { node { id title } } } } }`, { id: c.id });
    const members = r.data?.collection?.products?.edges?.map(e => e.node.title) || [];
    console.log(`\n  ${c.title} [${c.shortId}]:`);
    if (members.length === 0) console.log('    (empty)');
    else members.forEach(m => console.log(`    - ${m}`));
  }

  // 4) Find specific IDs
  const techGear = cols.find(c => c.title === 'Tech Gear');
  const electronics = cols.find(c => c.title.includes('Electronics'));
  const newCam = products.find(p => p.title.includes('800W Camera'));
  const exampleProd = products.find(p => p.title.includes('Example'));
  const aiGlasses2 = products.find(p => p.shortId === '8005574623331');

  console.log('\n\n=== Targets ===');
  console.log(`Tech Gear:       ${techGear ? techGear.shortId : 'NOT FOUND'}`);
  console.log(`Electronics:     ${electronics ? electronics.shortId : 'NOT FOUND'}`);
  console.log(`New 800W Camera: ${newCam ? newCam.shortId + ' ' + newCam.title.slice(0, 40) : 'NOT FOUND'}`);
  console.log(`Example Product: ${exampleProd ? exampleProd.shortId : 'NOT FOUND'}`);

  if (!techGear || !electronics || !newCam) {
    console.log('\nMissing required collections/products, aborting.');
    return;
  }

  function checkGqlErr(resp, label) {
    if (resp.errors) { console.log(`❌ ${label} GraphQL errors:`, JSON.stringify(resp.errors)); return false; }
    const ue = resp.data?.[Object.keys(resp.data)[0]]?.userErrors;
    if (ue && ue.length > 0) { console.log(`❌ ${label} userErrors:`, JSON.stringify(ue)); return false; }
    console.log(`✅ ${label}`);
    return true;
  }

  // 5) Add New 800W Camera Glasses to Tech Gear
  console.log('\n=== Adding New 800W Camera Glasses to Tech Gear ===');
  r = await gql(`mutation($id: ID!, $pids: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $pids) {
      userErrors { field message }
    }
  }`, { id: techGear.id, pids: [newCam.id] });
  checkGqlErr(r, 'Add to Tech Gear');

  // 6) Remove Example product from Electronics
  if (exampleProd) {
    console.log('\n=== Removing Example Product from Electronics ===');
    r = await gql(`mutation($id: ID!, $pids: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $pids) {
        userErrors { field message }
      }
    }`, { id: electronics.id, pids: [exampleProd.id] });
    checkGqlErr(r, 'Remove Example from Electronics');
  }

  // 7) Remove old AI Glasses (8005574623331) from Electronics (keep in Tech Gear)
  if (aiGlasses2) {
    console.log('\n=== Removing old AI Glasses from Electronics ===');
    r = await gql(`mutation($id: ID!, $pids: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $pids) {
        userErrors { field message }
      }
    }`, { id: electronics.id, pids: [aiGlasses2.id] });
    checkGqlErr(r, 'Remove old AI Glasses from Electronics');
  }

  // Wait a bit for async processing
  await sleep(3000);

  // 8) Verify final state
  console.log('\n\n=== Final Verification ===');
  for (const c of cols) {
    r = await gql(`query($id: ID!) { collection(id: $id) { products(first: 50) { edges { node { id title } } } } }`, { id: c.id });
    const members = r.data?.collection?.products?.edges?.map(e => e.node.title) || [];
    console.log(`\n  ${c.title} [${c.shortId}]:`);
    if (members.length === 0) console.log('    (empty)');
    else members.forEach(m => console.log(`    - ${m}`));
  }
}

main().catch(e => console.error('Fatal:', e));
