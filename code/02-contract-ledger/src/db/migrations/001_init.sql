-- 案例二：企业合同管理系统 初始结构
-- 状态值与 src/modules/contract、src/modules/approval 的 as const 定义逐字一致

CREATE TABLE contracts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_no    TEXT    NOT NULL UNIQUE,     -- HT-{年}-{4位序号}
  title          TEXT    NOT NULL,
  counterparty   TEXT    NOT NULL,
  amount_cents   INTEGER NOT NULL,            -- 金额存分：整数不丢精度，换算只在 service 边界
  sign_date      TEXT    NOT NULL,            -- YYYY-MM-DD
  effective_date TEXT    NOT NULL,
  expire_date    TEXT    NOT NULL,
  owner          TEXT    NOT NULL,            -- 我方经办人
  status         TEXT    NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','approving','rejected','active','terminated')),
  created_at     TEXT    NOT NULL
  -- 注意：没有 'expired' 状态——过期是查询时从 expire_date 派生的，不落库
);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_expire ON contracts(expire_date);

-- 审批任务：提交时按金额把审批链物化成行，一步一行
CREATE TABLE approval_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  round       INTEGER NOT NULL,               -- 驳回后重新提交 round+1，历史链保留
  step_no     INTEGER NOT NULL,               -- 链内顺序，从 1 开始
  role        TEXT    NOT NULL,
  assignee    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','skipped')),
  opinion     TEXT,
  decided_at  TEXT,
  UNIQUE (contract_id, round, step_no)
);
CREATE INDEX idx_tasks_contract ON approval_tasks(contract_id);

-- 合同编号发号器：与建单同事务递增（withTransaction），保证同年不重号
CREATE TABLE contract_seq (
  year TEXT PRIMARY KEY,  -- YYYY
  seq  INTEGER NOT NULL
);
