import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

/**
 * 架构守护测试：附录 C.3 的三条硬约定 + 本工程追加的租户隔离规则，
 * 用不到 100 行代码变成可执行的适应度函数。
 * 架构决策若不能被机器守护，就只是墙上的海报。
 */
const SRC = join(import.meta.dirname, '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) specs.push(m[1]!);
  for (const m of text.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]!);
  return specs;
}

/** 相对导入解析为 src 内的绝对路径；裸模块名原样返回 */
function resolveImport(fromFile: string, spec: string): string {
  if (!spec.startsWith('.')) return spec;
  return resolve(dirname(fromFile), spec);
}

const files = walk(SRC);
const moduleOf = (p: string): string | null => {
  const rel = relative(SRC, p).split(sep);
  return rel[0] === 'modules' ? (rel[1] ?? null) : null;
};

describe('架构守护', () => {
  it('规则0：扫描器自检——src 下确实扫到了各层文件（防 glob 空匹配导致规则空过）', () => {
    const count = (suffix: string) => files.filter((p) => p.endsWith(`${sep}${suffix}`)).length;
    assert.ok(count('routes.ts') >= 1, `未扫到 routes.ts，规则1 会空过`);
    assert.ok(count('service.ts') >= 1, `未扫到 service.ts，规则3 会空过`);
    assert.ok(count('repo.ts') >= 1, `未扫到 repo.ts，规则3 会空过`);
    assert.ok(files.length >= 6, `src 下 .ts 文件仅 ${files.length} 个，扫描器可能失效`);
  });

  it('规则1：routes 不得越过 service 直接 import repo', () => {
    for (const f of files.filter((p) => p.endsWith(`${sep}routes.ts`))) {
      for (const spec of importsOf(f)) {
        const target = resolveImport(f, spec);
        assert.ok(!target.endsWith(`${sep}repo.ts`), `${relative(SRC, f)} 直接依赖了 repo：${spec}`);
      }
    }
  });

  it('规则2：跨模块依赖只允许走对方 index.ts', () => {
    for (const f of files) {
      const myModule = moduleOf(f);
      for (const spec of importsOf(f)) {
        const target = resolveImport(f, spec);
        if (spec.startsWith('.') === false) continue;
        const targetModule = moduleOf(target);
        if (targetModule && targetModule !== myModule) {
          assert.ok(
            target.endsWith(`${sep}index.ts`),
            `${relative(SRC, f)} 绕过公共出口依赖了 ${relative(SRC, target)}`
          );
        }
      }
    }
  });

  it('规则3：service 与 repo 对 HTTP 框架无感知（不 import fastify）', () => {
    for (const f of files.filter((p) => p.endsWith(`${sep}service.ts`) || p.endsWith(`${sep}repo.ts`))) {
      for (const spec of importsOf(f)) {
        assert.ok(
          spec !== 'fastify' && !spec.startsWith('@fastify/'),
          `${relative(SRC, f)} 依赖了 HTTP 框架：${spec}`
        );
      }
    }
  });

  // 作用域表：带 tenant_id 列、任何按条件读写都必须租户隔离。
  // tenants 不在此列——它是租户注册表的根，findByCode/findByApiKeyHash 是"请求发现自己属于哪个租户"
  // 的全局查询，按 tenant_id 过滤它会陷入先有鸡还是先有蛋，故按设计豁免。
  const SCOPED = /\b(?:FROM|JOIN|UPDATE)\s+(tickets|ticket_events|users|ticket_seq)\b/gi;
  const TENANT_PRED = /tenant_id\s*=\s*[?$]/gi;

  /**
   * 逐条 SQL 计数：作用域表引用数 N、tenant_id 谓词数 M。要求 M ≥ N。
   * 比"整串 includes('tenant_id = ?')"强——子查询绕过
   * `SELECT * FROM tickets WHERE id IN (SELECT ticket_id FROM ticket_events WHERE tenant_id = ?)`
   * 有 2 个作用域表引用却只 1 个谓词，会被判违规。
   */
  function tenantScopeViolations(sql: string): { refs: number; preds: number } | null {
    if (/^\s*(?:--|\/\*)|INSERT\s+INTO/i.test(sql)) return null; // INSERT 由列携带 tenant_id，豁免
    const refs = (sql.match(SCOPED) ?? []).length;
    if (refs === 0) return null;
    const preds = (sql.match(TENANT_PRED) ?? []).length;
    return preds >= refs ? null : { refs, preds };
  }

  it('规则4（本工程追加）：全部 repo 的作用域表 SQL 每处引用都须有独立 tenant_id 谓词', () => {
    const repos = files.filter((p) => p.endsWith(`${sep}repo.ts`));
    assert.ok(repos.length >= 2, `应扫描到至少 2 个 repo 文件，实际 ${repos.length}——扫描器可能失效`);
    let scanned = 0;
    for (const repo of repos) {
      const text = readFileSync(repo, 'utf8');
      const literals = text.match(/`[^`]*`|'[^']*'|"[^"]*"/g) ?? [];
      for (const sql of literals) {
        if (SCOPED.test(sql)) { SCOPED.lastIndex = 0; scanned++; } else { SCOPED.lastIndex = 0; }
        const v = tenantScopeViolations(sql);
        assert.equal(
          v,
          null,
          `${relative(SRC, repo)} 的 SQL 租户隔离不足（作用域表引用 ${v?.refs}、tenant_id 谓词 ${v?.preds}）：` +
            sql.replaceAll(/\s+/g, ' ').slice(0, 90) + '…'
        );
      }
    }
    assert.ok(scanned >= 4, `应扫描到至少 4 条作用域表 SQL，实际 ${scanned}——扫描器可能失效`);
  });

  it('规则4 自证：构造的子查询绕过样本必须被扫描器判为违规', () => {
    const bypass =
      'SELECT * FROM tickets WHERE id IN (SELECT ticket_id FROM ticket_events WHERE tenant_id = ?)';
    const v = tenantScopeViolations(bypass);
    assert.notEqual(v, null, '整串含 tenant_id=? 却外层未隔离的绕过样本，必须被判违规');
    assert.equal(v?.refs, 2);
    assert.equal(v?.preds, 1);
  });
});
