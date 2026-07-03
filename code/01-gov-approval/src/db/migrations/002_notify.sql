-- notify 模块：出站消息表。
-- "出站表 + 定时重试"把"调用短信网关成功"改写为"落表成功"：
-- 办结动作在业务事务里只写这张表，真正的发送发生在事务之外的定时扫描里，
-- 失败退避重试，超限转 dead 人工处理。业务流程不被短信网关的可用性绑架。

CREATE TABLE outbound_messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  channel        TEXT    NOT NULL,               -- 'sms'
  recipient      TEXT    NOT NULL,
  payload        TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dead')),
  retry_count    INTEGER NOT NULL DEFAULT 0,
  next_retry_at  TEXT    NOT NULL,               -- 到点才投递；退避序列 1min/5min/30min/2h
  last_error     TEXT,
  created_at     TEXT    NOT NULL,
  sent_at        TEXT
);
CREATE INDEX idx_outbound_due ON outbound_messages(status, next_retry_at);
CREATE INDEX idx_outbound_app ON outbound_messages(application_id);
