const templates = [
  {
    tone: 'pro',
    body: (title, price, profit) => `<div style="font-family: 'Inter',system-ui,sans-serif;max-width:680px;color:#1a1a2e;">
<h2 style="font-size:1.5em;margin:0 0 12px;font-weight:700;">${escapeHtml(title)}</h2>
<p style="font-size:1em;line-height:1.6;margin:0 0 16px;color:#444;">
Designed for the modern builder. Every component in our curated collection goes through rigorous
sourcing and quality verification before it reaches your workspace.
</p>
<ul style="padding-left:20px;line-height:1.8;color:#555;">
<li><strong>Carefully Sourced</strong> — Direct from verified suppliers, no middlemen markup</li>
<li><strong>Built for Productivity</strong> — Form meets function in your daily workflow</li>
<li><strong>Zero Compromise</strong> — Quality-checked at every step of the supply chain</li>
</ul>
<p style="margin:16px 0 0;padding:12px 16px;background:#f8f9fa;border-radius:8px;font-size:0.9em;color:#666;">
🚀 Part of <strong>SilverMoon Bank</strong>'s curated collection for developers, creators, and automation engineers.
</p>
</div>`,
  },
  {
    tone: 'minimal',
    body: (title) => `<div style="font-family:system-ui,sans-serif;max-width:680px;">
<h2>${escapeHtml(title)}</h2>
<p>Premium tech gear curated by SilverMoon Bank. Quality-checked, ready to ship.</p>
</div>`,
  },
  {
    tone: 'tech',
    body: (title, price) => `<div style="font-family:'SF Mono','Fira Code',monospace;max-width:680px;background:#0d1117;color:#c9d1d9;padding:24px;border-radius:12px;">
<pre style="margin:0;font-size:0.9em;line-height:1.7;">
<span style="color:#8b949e;"># ${escapeHtml(title)}</span>
<span style="color:#79c0ff;">status:</span> verified
<span style="color:#79c0ff;">price:</span> $${price}
<span style="color:#79c0ff;">source:</span> SilverMoon Bank ← curated
<span style="color:#58a6ff;">────────────────────────────────</span>
<span style="color:#c9d1d9;">Ready to ship. No bloat. Just what you need.</span>
</pre>
</div>`,
  },
];

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]);
}

function generateDescription({ productName, sellingPriceUSD, profit, profitRate, tone = 'pro' }) {
  const tmpl = templates.find(t => t.tone === tone) || templates[0];
  return tmpl.body(productName, sellingPriceUSD, profit);
}

module.exports = { generateDescription, templates };
