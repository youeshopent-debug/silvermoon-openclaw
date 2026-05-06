const https = require('https');

const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiI1N2UxMzZlYzM4Yzk2Y2EyODNmNzRlZDAwNzZjYThhMjU3NmQ2NTA5NWE0MTY4YzczMTViNDk1NzlhZjgyMWNmNmVmMTkyM2Q4YzZkMGFlYiIsImlhdCI6MTc3NzI4MjkxOC43ODAzNSwibmJmIjoxNzc3MjgyOTE4Ljc4MDM1MywiZXhwIjoxOTI0OTA1NjAwLjAzMTk4Nywic3ViIjoiNjg3MjM0MSIsInNjb3BlcyI6W119.CBujgFztVslfIVYB8Q8R_0UZMiyTQ9lQkK7NVdi_JJ5VCHndhtwxgdnnVX493_LoXOF-EUbEinkQaJGxYrFFm9OqA9eRj0JKhxn_B-5We9s_2035fgjSD760C937NjYrV9yFUGAeVf8UiKAfqomYTnLaTWsf6hCGaiuLBN1pugIzEXCruZE7EapQTzHHRyORXyE0SzH1o1fkg6kdvpYUwUC67tqSvxEAA8d3IN7q5gZVT8EvtZ0nIv1gnko-7hbpV9_hljknJHsJEyW-EVtgDGBTO8AAWWtfjsnVBpN4YnHaOYHVEPckYWwGc-XUnFJz77ZvdaojREowigXWscwaTXc_m5wFZHhilQmVOX_yT5a6OIu0J6IyG1Du9NKVShdCkFi_Rq-xTIt1mjURv3HdZelF-j3a-1zawvT7OedOS7a967zC_9Vwp6JzxZULbN8uWspTtxc0VhR9c50a9xNzH4D4olk6B_nxFkX3HOKcOzEwFnRKzB1QougQq95EvsnbUROP6lWG3mHIiLH9k7Oq5Q6zEH62Mdaa0FCLh-Z-iiiRizZKpBPb8r4Mh1rPYETXMNDzG7uXXiSbRrlmGT2uEWeEaJrDVu06jtzfsDlmgVeBgq-YL-bJilzXc0XOkHB_WcwpFh4oMWQ7922HClwohdYNynfYJEHUyMYYQynqH5A';
const BASE = 'https://api.lemonsqueezy.com/v1';
const HEADERS = {
  'Accept': 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
  'Authorization': `Bearer ${API_KEY}`
};

function fetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse failed: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== ALL ORDERS (no date filter) ===');
  const orders = await fetch('/v1/orders');
  console.log(JSON.stringify(orders, null, 2));
})();
