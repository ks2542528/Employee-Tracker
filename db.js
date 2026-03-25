const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'employee_tracker.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      day TEXT NOT NULL,
      main_worker_shift1 INTEGER DEFAULT 0,
      main_worker_shift2 INTEGER DEFAULT 0,
      helpers_shift1 INTEGER DEFAULT 0,
      helpers_shift2 INTEGER DEFAULT 0,
      water_man INTEGER DEFAULT 0,
      total INTEGER GENERATED ALWAYS AS (
        main_worker_shift1 + main_worker_shift2 + helpers_shift1 + helpers_shift2 + water_man
      ) STORED,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating table:', err.message);
    else console.log('Database ready.');
  });
}

module.exports = db;
