const https = require('https');
const TOKEN = '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';
const HOST = 'aigenie-hub.myshopify.com';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = {
      hostname: HOST, path: '/admin/api/2024-04/graphql.json', method: 'POST',
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

async function main() {
  const GID = 'gid://shopify/Product/8006707216483';
  const locId = 'gid://shopify/Location/76375523427';
  const colors = ['Matte Black', 'Glossy White', 'Transparent Smoke', 'Tortoise Shell'];

  // Get current variants
  let r = await gql(`query($id: ID!) { product(id: $id) { options { id name values } variants(first: 20) { edges { node { id selectedOptions { name value } price inventoryQuantity } } } } }`, { id: GID });
  const variants = r.data?.product?.variants?.edges?.map(e => e.node) || [];
  console.log('Current variants:', variants.length);
  variants.forEach(v => console.log(`  ${v.selectedOptions.map(o => o.value).join(', ')}: $${v.price} (id: ${v.id.split('/').pop()})`));

  // Find variants to delete (B and A)
  const toDelete = variants.filter(v => v.selectedOptions.some(o => o.value === 'B' || o.value === 'A')).map(v => v.id);
  if (toDelete.length > 0) {
    console.log(`\nDeleting ${toDelete.length} residual variants...`);
    const delQ = `mutation($p: ID!, $v: [ID!]!) { productVariantsBulkDelete(productId: $p, variantsIds: $v) { userErrors { field message } } }`;
    r = await gql(delQ, { p: GID, v: toDelete });
    const errs = r.data?.productVariantsBulkDelete?.userErrors;
    if (errs && errs.length > 0) {
      console.log('Delete errors:', JSON.stringify(errs));
    } else {
      console.log('Deleted successfully');
    }
  }

  // Update option values to only the 4 colors (use productOptionsUpdate with correct format)
  console.log('\nUpdating option values...');
  const updQ = `mutation($pid: ID!, $opts: [OptionInput!]!) {
    productOptionsUpdate(productId: $pid, options: $opts) {
      product { id options { id name values } }
      userErrors { field message }
    }
  }`;
  r = await gql(updQ, {
    pid: GID,
    opts: [{ name: 'Color', values: colors, position: 1 }]
  });
  console.log('Option update:', JSON.stringify(r.data?.productOptionsUpdate?.userErrors || r.data?.productOptionsUpdate?.product?.options));

  // Final verify
  r = await gql(`query($id: ID!) { product(id: $id) { options { name values } variants(first:10) { edges { node { selectedOptions { name value } price inventoryQuantity } } } } }`, { id: GID });
  console.log('\nFinal:');
  console.log('Options:', JSON.stringify(r.data?.product?.options));
  r.data?.product?.variants?.edges?.forEach(e => {
    console.log(`  ${e.node.selectedOptions.map(o => o.value).join(', ')}: $${e.node.price} (qty: ${e.node.inventoryQuantity})`);
  });
}
main().catch(e => console.error('Error:', e));
