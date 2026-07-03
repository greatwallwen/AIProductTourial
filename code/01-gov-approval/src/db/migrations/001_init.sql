-- 案例一：政务事项申报审批系统 初始结构
-- 状态值与 src/modules/application/service.ts 的状态机定义逐字一致

CREATE TABLE catalog_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code          TEXT    NOT NULL UNIQUE,
  item_name          TEXT    NOT NULL,
  implement_org      TEXT    NOT NULL,
  item_type          TEXT    NOT NULL CHECK (item_type IN ('许可', '登记')),
  legal_days         INTEGER NOT NULL,           -- 法定办结时限（工作日）
  promise_days       INTEGER NOT NULL,           -- 承诺办结时限（工作日）
  required_materials TEXT    NOT NULL DEFAULT '[]' -- JSON 数组：必备材料名清单
);

CREATE TABLE applications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  apply_no         TEXT    NOT NULL UNIQUE,      -- {行政区划码}-{YYYYMMDD}-{4位序号}
  item_id          INTEGER NOT NULL REFERENCES catalog_items(id),
  applicant_name   TEXT    NOT NULL,
  applicant_id_no  TEXT    NOT NULL,             -- 脱敏存储：310104********0012
  applicant_phone  TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'submitted',
  submitted_at     TEXT    NOT NULL,
  accepted_at      TEXT,
  concluded_at     TEXT,
  licence_no       TEXT
);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_item   ON applications(item_id);

CREATE TABLE application_materials (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  material_name  TEXT    NOT NULL,
  file_ref       TEXT    NOT NULL
);
CREATE INDEX idx_materials_app ON application_materials(application_id);

-- 审计留痕：每一次状态流转一条，不可修改（应用层只 INSERT）
CREATE TABLE approval_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  action         TEXT    NOT NULL,
  from_status    TEXT    NOT NULL,
  to_status      TEXT    NOT NULL,
  operator       TEXT    NOT NULL,
  opinion        TEXT,
  created_at     TEXT    NOT NULL
);
CREATE INDEX idx_logs_app ON approval_logs(application_id);

-- 申报编号发号器：与建单同事务递增，保证不重号
CREATE TABLE apply_seq (
  day TEXT PRIMARY KEY,  -- YYYYMMDD
  seq INTEGER NOT NULL
);
