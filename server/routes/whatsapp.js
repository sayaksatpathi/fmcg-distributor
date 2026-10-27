const express = require('express');
const router = express.Router();

/**
 * Normalise a phone number to digits only (WhatsApp expects E.164 without '+').
 */
function normalisePhone(phone) {
  return String(phone).replace(/[^\d]/g, '');
}

/**
 * Send via the WhatsApp Cloud API (Meta) when credentials are configured.
 * Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, optional WHATSAPP_API_VERSION.
 */
async function sendViaCloudApi(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const resp = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = data?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`WhatsApp Cloud API error: ${detail}`);
  }
  return { provider: 'cloud_api', id: data?.messages?.[0]?.id || null };
}

/**
 * Send via Twilio's WhatsApp channel when credentials are configured.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
 */
async function sendViaTwilio(to, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !authToken || !from) return null;

  const body = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:+${to}`,
    Body: message,
  });
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Twilio error: ${data?.message || `HTTP ${resp.status}`}`);
  }
  return { provider: 'twilio', id: data?.sid || null };
}

// POST /api/whatsapp/send
// Sends a WhatsApp message through a configured provider (Cloud API or Twilio).
// If no provider is configured, returns a click-to-chat link as a graceful fallback.
router.post('/send', async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ message: 'Phone and message required.' });
    }
    const to = normalisePhone(phone);

    const result = (await sendViaCloudApi(to, message)) || (await sendViaTwilio(to, message));

    if (result) {
      return res.json({
        success: true,
        sent: true,
        provider: result.provider,
        messageId: result.id,
        message: 'WhatsApp message sent.',
      });
    }

    // No provider configured — return a click-to-chat link so the UI still works.
    const waUrl = `https://api.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(message)}`;
    return res.json({
      success: true,
      sent: false,
      url: waUrl,
      message:
        'No WhatsApp provider configured — returning a click-to-chat link. ' +
        'Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Cloud API) or TWILIO_* to send automatically.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
