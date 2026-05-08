const nodemailer = require('nodemailer');

const CFG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER || 'alanlsl8208@gmail.com',
  pass: process.env.SMTP_PASS || '',
  to: process.env.MAIL_TO || 'alanlsl8208@gmail.com',
  from: process.env.MAIL_FROM || '银月钱庄 <alanlsl8208@gmail.com>',
};

let _transporter = null;
let _state = {
  lastSuccess: null,
  lastFailure: null,
  consecutiveFails: 0,
  circuitOpen: false,
  circuitOpenAt: null,
};
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 熔断 5 分钟后自动重置
const MAX_CONSECUTIVE_FAILS = 5; // 连续 5 次失败开启熔断

function recreateTransporter() {
  _transporter = null;
  if (!CFG.pass) return null;
  _transporter = nodemailer.createTransport({
    host: CFG.host,
    port: CFG.port,
    secure: CFG.port === 465,
    auth: { user: CFG.user, pass: CFG.pass },
    // 连接池 + 超时
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return _transporter;
}

function getTransporter() {
  if (_transporter) return _transporter;
  return recreateTransporter();
}

/** 验证 SMTP 连接是否可用 */
async function verifyConnection() {
  const tp = getTransporter();
  if (!tp) return { ok: false, error: 'SMTP_PASS 未配置' };
  try {
    await tp.verify();
    return { ok: true };
  } catch (e) {
    // verify 失败 → 重建 transporter
    recreateTransporter();
    return { ok: false, error: e.message };
  }
}

async function sendEmail(subject, html, retries = 2) {
  // 熔断检查
  if (_state.circuitOpen) {
    if (Date.now() - _state.circuitOpenAt < CIRCUIT_RESET_MS) {
      return { ok: false, error: '熔断中', circuitOpen: true };
    }
    _state.circuitOpen = false; // 自动重置
  }

  const tp = getTransporter();
  if (!tp) return { ok: false, error: 'SMTP_PASS 未配置' };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const info = await tp.sendMail({
        from: CFG.from,
        to: CFG.to,
        subject: `[银月钱庄] ${subject}`,
        html,
      });
      _state.lastSuccess = Date.now();
      _state.consecutiveFails = 0;
      return { ok: true, messageId: info.messageId };
    } catch (e) {
      _state.lastFailure = Date.now();
      _state.consecutiveFails++;

      if (_state.consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        _state.circuitOpen = true;
        _state.circuitOpenAt = Date.now();
      }

      // 最后一次重试也失败
      if (attempt >= retries) {
        // 重建 transporter 以备下次
        recreateTransporter();
        return { ok: false, error: e.message, circuitOpen: _state.circuitOpen };
      }

      // 指数退避: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
      recreateTransporter();
    }
  }
  return { ok: false, error: '发送失败' };
}

async function sendDailyReport(reportText) {
  const html = `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e0e0e0;border-radius:12px">
    <div style="border-bottom:1px solid #333;padding-bottom:16px;margin-bottom:16px">
      <h1 style="color:#00d4ff;margin:0;font-size:20px">☀ 银月钱庄 · 日报</h1>
      <p style="color:#666;margin:4px 0 0;font-size:12px">${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p>
    </div>
    <div style="line-height:1.6;white-space:pre-wrap">${reportText.replace(/\n/g, '<br>')}</div>
    <div style="border-top:1px solid #333;padding-top:12px;margin-top:16px;font-size:11px;color:#555">
      银月钱庄 · 自动化网关 · 此邮件由系统自动发送
    </div>
  </div>`;
  return sendEmail('日报', html);
}

function getEmailHealth() {
  return { ..._state, configured: !!CFG.pass };
}

module.exports = { sendEmail, sendDailyReport, verifyConnection, getEmailHealth, recreateTransporter };
