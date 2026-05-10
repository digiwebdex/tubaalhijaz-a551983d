// Phase 6 — Messaging API routes
const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const dispatcher = require('../services/messageDispatcher');

const router = express.Router();
router.use(authenticate);

// ----- Notification Center -----
router.get('/notifications', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const onlyUnread = String(req.query.unread || '') === 'true';
    const params = [req.user.id];
    let where = `(user_id = $1 OR user_id IS NULL)`;
    if (onlyUnread) where += ` AND read_at IS NULL`;
    const r = await query(
      `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    const u = await query(
      `SELECT count(*)::int AS c FROM notifications
       WHERE (user_id = $1 OR user_id IS NULL) AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ items: r.rows, unread: u.rows[0].c });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    await query(`UPDATE notifications SET read_at = now() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications/read-all', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET read_at = now()
       WHERE (user_id = $1 OR user_id IS NULL) AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications', requireRole('admin'), async (req, res) => {
  try {
    const { user_id = null, event_type, title, body = null, link = null,
            severity = 'info', metadata = {} } = req.body || {};
    if (!event_type || !title) return res.status(400).json({ error: 'event_type, title required' });
    const r = await query(
      `INSERT INTO notifications (user_id, event_type, title, body, link, severity, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [user_id, event_type, title, body, link, severity, JSON.stringify(metadata)]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----- Messaging Config (stored in company_settings) -----
router.get('/messaging/config', requireRole('admin'), async (_req, res) => {
  try {
    const r = await query(
      `SELECT setting_value FROM company_settings WHERE setting_key = 'messaging_config' LIMIT 1`
    );
    let cfg = r.rows[0]?.setting_value || {};
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
    // Mask secrets in response
    const masked = JSON.parse(JSON.stringify(cfg || {}));
    if (masked.whatsapp?.access_token) masked.whatsapp.access_token = '***';
    if (masked.sms?.auth_token) masked.sms.auth_token = '***';
    if (masked.email?.smtp_password) masked.email.smtp_password = '***';
    res.json({ config: masked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/messaging/config', requireRole('admin'), async (req, res) => {
  try {
    const incoming = req.body?.config || {};
    // Merge with existing so masked '***' values don't overwrite real secrets
    const existingR = await query(
      `SELECT setting_value FROM company_settings WHERE setting_key = 'messaging_config' LIMIT 1`
    );
    let existing = existingR.rows[0]?.setting_value || {};
    if (typeof existing === 'string') { try { existing = JSON.parse(existing); } catch { existing = {}; } }
    const merged = JSON.parse(JSON.stringify(existing || {}));
    for (const ch of ['whatsapp', 'sms', 'email']) {
      merged[ch] = { ...(merged[ch] || {}), ...(incoming[ch] || {}) };
      // Restore masked secret if user didn't change it
      if (incoming[ch]?.access_token === '***') merged[ch].access_token = existing[ch]?.access_token;
      if (incoming[ch]?.auth_token === '***') merged[ch].auth_token = existing[ch]?.auth_token;
      if (incoming[ch]?.smtp_password === '***') merged[ch].smtp_password = existing[ch]?.smtp_password;
    }
    if (existingR.rows[0]) {
      await query(
        `UPDATE company_settings SET setting_value = $1::jsonb, updated_at = now(), updated_by = $2
         WHERE setting_key = 'messaging_config'`,
        [JSON.stringify(merged), req.user.id]
      );
    } else {
      await query(
        `INSERT INTO company_settings (setting_key, setting_value, updated_by)
         VALUES ('messaging_config', $1::jsonb, $2)`,
        [JSON.stringify(merged), req.user.id]
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----- Queue actions -----
router.post('/messaging/enqueue', requireRole('admin'), async (req, res) => {
  try {
    const row = await dispatcher.enqueue({ ...req.body, created_by: req.user.id });
    res.status(201).json(row);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/messaging/send-template', requireRole('admin'), async (req, res) => {
  try {
    const row = await dispatcher.enqueueFromTemplate({ ...req.body, created_by: req.user.id });
    res.status(201).json(row);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/messaging/queue/:id/retry', requireRole('admin'), async (req, res) => {
  try {
    await query(
      `UPDATE message_queue SET status = 'pending', next_attempt_at = now(),
         attempts = 0, last_error = NULL, updated_at = now()
       WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/messaging/queue/:id/cancel', requireRole('admin'), async (req, res) => {
  try {
    await query(`UPDATE message_queue SET status = 'cancelled', updated_at = now() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send a one-off test message immediately
router.post('/messaging/test', requireRole('admin'), async (req, res) => {
  try {
    const { channel, recipient, body, subject } = req.body || {};
    if (!channel || !recipient || !body) return res.status(400).json({ error: 'channel, recipient, body required' });
    const cfg = await dispatcher.loadConfig();
    const row = await dispatcher.enqueue({
      channel, recipient, body, subject,
      event_key: 'test', related_type: 'manual', created_by: req.user.id,
    });
    // Process immediately so the user gets feedback
    await dispatcher.processOne(cfg, { ...row, payload: {} });
    const after = await query(`SELECT * FROM message_queue WHERE id = $1`, [row.id]);
    res.json({ queue: after.rows[0] });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
