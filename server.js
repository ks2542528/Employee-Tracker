const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./employees.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create table
db.run(`CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  salary REAL NOT NULL,
  hire_date TEXT NOT NULL,
  status TEXT DEFAULT 'active'
)`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    // Seed sample data if table is empty
    db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
      if (!err && row.count === 0) {
        const sampleEmployees = [
          ['Alice Johnson', 'alice@company.com', 'Engineering', 'Senior Engineer', 95000, '2021-03-15', 'active'],
          ['Bob Smith', 'bob@company.com', 'Marketing', 'Marketing Manager', 78000, '2020-07-22', 'active'],
          ['Carol White', 'carol@company.com', 'HR', 'HR Specialist', 65000, '2022-01-10', 'active'],
          ['David Lee', 'david@company.com', 'Engineering', 'Junior Developer', 72000, '2023-05-01', 'active'],
          ['Eva Martinez', 'eva@company.com', 'Sales', 'Sales Lead', 85000, '2019-11-30', 'active'],
        ];
        const stmt = db.prepare('INSERT INTO employees (name, email, department, position, salary, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        sampleEmployees.forEach(emp => stmt.run(emp));
        stmt.finalize();
        console.log('Sample data seeded.');
      }
    });
  }
});

// ─── ROUTES ────────────────────────────────────────────────────────────────

// GET all employees
app.get('/api/employees', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET single employee
app.get('/api/employees/:id', (req, res) => {
  db.get('SELECT * FROM employees WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.json(row);
  });
});

// POST create employee
app.post('/api/employees', (req, res) => {
  const { name, email, department, position, salary, hire_date, status } = req.body;
  if (!name || !email || !department || !position || !salary || !hire_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const sql = 'INSERT INTO employees (name, email, department, position, salary, hire_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.run(sql, [name, email, department, position, salary, hire_date, status || 'active'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM employees WHERE id = ?', [this.lastID], (err, row) => {
      res.status(201).json(row);
    });
  });
});

// PUT update employee
app.put('/api/employees/:id', (req, res) => {
  const { name, email, department, position, salary, hire_date, status } = req.body;
  const sql = 'UPDATE employees SET name=?, email=?, department=?, position=?, salary=?, hire_date=?, status=? WHERE id=?';
  db.run(sql, [name, email, department, position, salary, hire_date, status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
    db.get('SELECT * FROM employees WHERE id = ?', [req.params.id], (err, row) => {
      res.json(row);
    });
  });
});

// DELETE employee
app.delete('/api/employees/:id', (req, res) => {
  db.run('DELETE FROM employees WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted successfully' });
  });
});

// GET stats
app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
      AVG(salary) as avg_salary,
      COUNT(DISTINCT department) as departments
    FROM employees
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows[0]);
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});