-- 案例四：SaaS 多租户工单系统 初始结构
-- 租户隔离铁律：除 tenants 外所有业务表都带 tenant_id，且 tenant_id 进入联合索引/联合唯一约束
-- 状态值与 src/modules/ticket/service.ts 的状态机定义逐字一致

CREATE TABLE tenants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_code  TEXT    NOT NULL UNIQUE,           -- 大写租户码，进入工单编号前缀
  company_name TEXT    NOT NULL,
  plan         TEXT    NOT NULL CHECK (plan IN ('standard', 'pro')),
  api_key_hash TEXT    NOT NULL UNIQUE,           -- 只存 sha256 哈希，明文 Key 永不落库
  created_at   TEXT    NOT NULL
);

CREATE TABLE users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name      TEXT    NOT NULL,
  email     TEXT    NOT NULL,
  role      TEXT    NOT NULL CHECK (role IN ('admin', 'agent')),
  UNIQUE (tenant_id, email)                       -- 邮箱唯一性以租户为界：不同租户可用同一邮箱
);

CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id),
  ticket_no  TEXT    NOT NULL,                    -- {TENANT_CODE}-0001，每租户独立序列
  title      TEXT    NOT NULL,
  priority   TEXT    NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  status     TEXT    NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assignee   TEXT,
  created_by TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  UNIQUE (tenant_id, ticket_no)                   -- 编号唯一性同样以租户为界
);
CREATE INDEX idx_tickets_tenant_status ON tickets(tenant_id, status);

-- 工单事件流：每一次动作一条，只增不改（应用层只 INSERT）
CREATE TABLE ticket_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id),
  action      TEXT    NOT NULL,
  from_status TEXT    NOT NULL,
  to_status   TEXT    NOT NULL,
  actor       TEXT    NOT NULL,
  note        TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX idx_events_tenant_ticket ON ticket_events(tenant_id, ticket_id);

-- 工单编号发号器：每租户一行，注册开通事务写入 seq=0，与建单同事务递增保证不重号
CREATE TABLE ticket_seq (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id),
  seq       INTEGER NOT NULL
);
