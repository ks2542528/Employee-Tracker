const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/records/summary/totals
router.get('/summary/totals', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN date = ? THEN total END), 0) AS today_total,
      COALESCE(SUM(CASE WHEN date >= ? THEN total END), 0) AS week_total,
      COALESCE(SUM(CASE WHEN date >= ? THEN total END), 0) AS month_total,
      COALESCE(SUM(total), 0) AS grand_total,
      COUNT(*) AS record_count
    FROM daily_records
  `, [today, weekAgo, monthAgo], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// GET /api/records/search?q=
router.get('/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  db.all(
    `SELECT * FROM daily_records WHERE date LIKE ? OR day LIKE ? OR notes LIKE ? ORDER BY date DESC LIMIT 50`,
    [q, q, q],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ records: rows, total: rows.length });
    }
  );
});

// GET /api/records — paginated list
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const sort = ['date', 'total', 'day'].includes(req.query.sort) ? req.query.sort : 'date';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  db.get('SELECT COUNT(*) AS cnt FROM daily_records', (err, count) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(
      `SELECT * FROM daily_records ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ records: rows, total: count.cnt, page, pages: Math.ceil(count.cnt / limit) });
      }
    );
  });
});

// GET /api/records/:id
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM daily_records WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Record not found' });
    res.json(row);
  });
});

// POST /api/records
router.post('/', (req, res) => {
  const { date, day, main_worker_shift1, main_worker_shift2, helpers_shift1, helpers_shift2, water_man, notes } = req.body;
  if (!date || !day) return res.status(400).json({ error: 'date and day are required' });

  db.run(
    `INSERT INTO daily_records (date, day, main_worker_shift1, main_worker_shift2, helpers_shift1, helpers_shift2, water_man, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [date, day, main_worker_shift1 || 0, main_worker_shift2 || 0, helpers_shift1 || 0, helpers_shift2 || 0, water_man || 0, notes || ''],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A record for this date already exists.' });
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM daily_records WHERE id = ?', [this.lastID], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

// PUT /api/records/:id
router.put('/:id', (req, res) => {
  const { date, day, main_worker_shift1, main_worker_shift2, helpers_shift1, helpers_shift2, water_man, notes } = req.body;
  db.run(
    `UPDATE daily_records SET date=?, day=?, main_worker_shift1=?, main_worker_shift2=?, helpers_shift1=?, helpers_shift2=?, water_man=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [date, day, main_worker_shift1 || 0, main_worker_shift2 || 0, helpers_shift1 || 0, helpers_shift2 || 0, water_man || 0, notes || '', req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Record not found' });
      db.get('SELECT * FROM daily_records WHERE id = ?', [req.params.id], (err, row) => res.json(row));
    }
  );
});

// DELETE /api/records/:id
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM daily_records WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, id: req.params.id });
  });
});

module.exports = router;
