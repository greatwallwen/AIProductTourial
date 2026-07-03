# ADR-002: 隔离双保险——应用层强制 + PostgreSQL 行级安全（RLS）兜底

- 状态：已采纳
- 日期：2026-07-02
- 关联：C-01、Q-01、ADR-001

## 背景（Context）

Pool 模型下，隔离是机制而非物理。机制的敌人是人：新同事写一条忘带 `tenant_id` 过滤的查询，代码评审漏掉，一次串租，产品死亡（C-01）。单防线必被穿——问题只是何时。

## 备选方案

**A. 仅应用层 WHERE 过滤（靠纪律）**
否决理由：纪律不是机制。规模化团队里"总有一天"是确定事件。

**B. 仅数据库 RLS（应用层裸写）**
RLS 缺位应用层语义：无法给出"404 而非 403"的产品语义（返回空集，应用还要补判断）；且所有查询性能都过 RLS 谓词，无应用层过滤时索引利用变差。

**C. 双保险——采纳**：两道独立防线，任何一道单独失效都不导致串租。

## 决策（Decision）

第一道（应用层，主防线）：鉴权钩子解析租户上下文 → repo 层所有函数签名强制 `tenantId` 首参、SQL 一律 `WHERE tenant_id = ?` → 架构守护测试第 4 条扫描 repo 源码中的 SQL 字符串，凡涉业务表必须含 `tenant_id = ?`（机制化的代码评审，工程已实现并实测）。

第二道（数据库层，兜底）：PostgreSQL RLS——

```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tickets
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```

**连接池下的真实工程坑（本 ADR 最值钱的一段）**：租户上下文必须用事务级设置——

```sql
-- 正确：第三参 true = 事务内有效（SET LOCAL 语义），事务结束自动清除
SELECT set_config('app.tenant_id', $1, true);
```

若用会话级（`set_config(..., false)` 或 `SET`），连接归还池后残留上一个租户的上下文，下一个借用该连接的请求将以他人身份查询——双保险反而制造串租。每个事务开始时设置、随事务结束失效，才是与连接池兼容的唯一正确姿势。

## 后果（Consequences）

- 好处：串租需要两道独立机制同时失效；防线本身可被测试证明（跨租户 404 测试 + 守护测试扫描 + RLS 直连库验证）。
- 代价：RLS 谓词的性能开销（tenant_id 联合索引下可忽略）；`app.tenant_id` 的设置纪律要进数据访问层封装，不允许散落。
- 示例工程映射：SQLite 无 RLS——工程完整实现第一道防线（钩子 + repo 强制 + 守护测试第 4 条 + 跨租户 404 实录）；第二道为生产设计，SQL 如上（PG 官方文档语义）。
