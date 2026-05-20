const ShopifyAPI = require('./lib/shopify-api.js');
const { shopifyRequest } = ShopifyAPI;

const PRODUCTS = {
  glasses: { id: 8007615742051, name: 'SilverMoon Air' },
  voiceRec: { id: 8007615774819, name: 'SilverMoon VoiceRec' },
  scanPen: { id: 8007615840355, name: 'SilverMoon ScanPen Pro 3' },
};

const IMAGE_CANDIDATES = {
  glasses: [
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/99fdc8f7af3560a7389120f4be6db7ba~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783309939&x-signature=7AbkPD4ewRLe3U8cvdLxsdLwOM4%3D',
    'https://ae-pic-a1.aliexpress-media.com/kf/S3d4f771a10b647e2b68e2294182daed28.jpg',
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/0a9b9d9aa2aea96cf89d3a447b619095~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783309948&x-signature=oBHn3C6jjrz8QCQOrTAvppqXO6o%3D',
  ],
  voiceRec: [
    'https://ae-pic-a1.aliexpress-media.com/kf/S2c20d9fcc9b043059546394e1c6de16cw.jpg',
    'https://ae-pic-a1.aliexpress-media.com/kf/Sd5f006cd06ac461cb9bcd9ec5c7f0b43M.jpg',
    'https://ae-pic-a1.aliexpress-media.com/kf/S5aff8a0ac0af48a497dd2359bfaf7b77b.jpg',
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/ca567842269a3016cd603f594d4e4569~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783311019&x-signature=0WGkKLUu1Wku3wStHmf%2F6ThlERU%3D',
    'https://p19-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/ca567842269a3016cd603f594d4e4569~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783311170&x-signature=FLwSc%2F55V%2BYnPo7WgXndaM4Wm%2Bk%3D',
    'https://p19-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/57b4a6eb7b97f84f66aabe10eb2b97f9~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783311170&x-signature=A6r0Eb5yAx1J6MFRz%2Fsu%2BAYEc8g%3D',
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/eb961c61a4d04c50935955487d384263~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783311170&x-signature=aAevDU0b9KSl7wGX%2FvKEEvilCnI%3D',
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/2b9e6e5779a14387c62b99bd085f9842~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783311171&x-signature=RUF3DawdEfostZ5VAfCgKWObzFw%3D',
  ],
  scanPen: [
    'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/img/e37d774ab3876c42efded39aea5498ec~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783310036&x-signature=4U78GSfJUMXpWbZCyIH%2BI5BTmmM%3D',
    'https://ae-pic-a1.aliexpress-media.com/kf/Sb3cfa790c54a462f8f23e9004f3a2e5em.jpg',
    'https://ae-pic-a1.aliexpress-media.com/kf/Sd29be1892a92470d99efa99f04e8bc1bd.jpg',
  ],
};

async function uploadImageBySrc(productId, srcUrl) {
  const result = await shopifyRequest('POST', `/products/${productId}/images.json`, {
    image: { src: srcUrl },
  });
  return result;
}

function extractError(err) {
  if (!err) return 'unknown error';
  if (err.errors) return `HTTP ${err.status}: ${JSON.stringify(err.errors).slice(0, 200)}`;
  if (err.raw) return `HTTP ${err.status}: raw=${err.raw.slice(0, 200)}`;
  if (err.message) return err.message;
  return `HTTP ${err.status || '?'}`;
}

async function main() {
  for (const [key, product] of Object.entries(PRODUCTS)) {
    console.log(`\n=== ${product.name} (ID: ${product.id}) ===`);
    let found = false;
    for (const url of IMAGE_CANDIDATES[key]) {
      if (found) break;
      process.stdout.write(`  Trying ${url.slice(0, 70)}... `);
      try {
        const result = await uploadImageBySrc(product.id, url);
        console.log(`✅ Image ID: ${result.image.id}`);
        found = true;
      } catch (err) {
        console.log(`❌ ${extractError(err)}`);
      }
    }
  }
  console.log('\n=== All done ===');
}

main().catch(console.error);
