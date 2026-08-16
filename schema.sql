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

-- Ảnh đồ mượn được lưu trong R2; D1 chỉ lưu metadata và R2 object key.
CREATE TABLE IF NOT EXISTS loan_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT,
  content_type TEXT,
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loan_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loan_images_loan ON loan_images(loan_id);


-- Danh mục đồ mượn đa ngôn ngữ, cho phép quản lý thêm/sửa/xóa mà không sửa code.
CREATE TABLE IF NOT EXISTS item_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department TEXT NOT NULL CHECK(department IN ('fb','housekeeping','reception')),
  name_vi TEXT NOT NULL,
  name_en TEXT,
  name_zh TEXT,
  name_ko TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_catalog_unique ON item_catalog(department, name_vi COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_item_catalog_dept ON item_catalog(department, active, name_vi);
