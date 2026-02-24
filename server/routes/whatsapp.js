const express = require('express');
const router = express.Router();

// Whatsapp — placeholder for integration
// POST /api/whatsapp/send
router.post('/send', async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message)
      return res.status(400).json({ message: 'Phone and message required.' });
    // In production, integrate with WhatsApp Business API or Twilio
    const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    res.json({ success: true, url: waUrl, message: 'WhatsApp link generated.' });
  } catch (err) { next(err); }
});

module.exports = router;
