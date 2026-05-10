const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED = ['pending', 'under_review', 'approved', 'rejected', 'reupload_required'];

// POST /api/document-reviews/:id/review  { status, notes }
router.post('/:id/review', authenticate, requireRole('admin', 'booking', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED.join(', ')}` });
    }
    const r = await query(
      `UPDATE booking_documents
       SET verification_status = $1,
           verification_notes = $2,
           verified_by = $3,
           verified_at = now()
       WHERE id = $4
       RETURNING *`,
      [status, notes || null, req.user.id, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Document not found' });

    // Fire notification to customer (best-effort)
    try {
      const doc = r.rows[0];
      const b = await query(
        `SELECT id, tracking_id, guest_name, guest_phone, guest_email, user_id
         FROM bookings WHERE id = $1`, [doc.booking_id]
      );
      const booking = b.rows[0];
      if (booking) {
        await query(
          `INSERT INTO notifications (user_id, event_type, title, body, link, severity, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            booking.user_id,
            `document.${status}`,
            `Document ${status.replace(/_/g, ' ')}`,
            `Your ${doc.document_type} for booking ${booking.tracking_id} was ${status.replace(/_/g, ' ')}.${notes ? ' Note: ' + notes : ''}`,
            `/dashboard?booking=${booking.id}`,
            status === 'approved' ? 'success' : status === 'rejected' || status === 'reupload_required' ? 'warning' : 'info',
            JSON.stringify({ booking_id: booking.id, document_id: doc.id, document_type: doc.document_type }),
          ]
        );
      }
    } catch (e) {
      console.error('document review notify failed:', e.message);
    }

    res.json(r.rows[0]);
  } catch (err) {
    console.error('document review error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/document-reviews?status=pending — list documents for review
router.get('/', authenticate, requireRole('admin', 'booking', 'manager'), async (req, res) => {
  try {
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE d.verification_status = $1`;
    }
    const r = await query(
      `SELECT d.*, b.tracking_id, b.guest_name, b.guest_phone
       FROM booking_documents d
       LEFT JOIN bookings b ON b.id = d.booking_id
       ${where}
       ORDER BY d.created_at DESC LIMIT 500`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
