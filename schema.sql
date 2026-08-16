CREATE TABLE IF NOT EXISTS loan_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL CHECK(department IN ('fb','housekeeping','reception')),
  guest_name TEXT NOT NULL,
  room_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK(qty > 0),
  returned_qty INTEGER NOT NULL DEFAULT 0,
  lost_qty INTEGER NOT NULL DEFAULT 0,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  staff_name TEXT,
  expected_return_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS loan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loan_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loans_room ON loan_records(room_no);
CREATE INDEX IF NOT EXISTS idx_loans_department ON loan_records(department);
CREATE INDEX IF NOT EXISTS idx_loans_created ON loan_records(created_at);
CREATE INDEX IF NOT EXISTS idx_history_loan ON loan_history(loan_id);
