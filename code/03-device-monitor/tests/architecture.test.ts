import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

/**
 * 架构守护测试：附录 C.3 的三条硬约定，用不到 100 行代码变成可执行的适应度函数。
 * 架构决策若不能被机器守护，就只是墙上的海报。
 * 本工程追加规则 4：ingest 与 dashboard 互不依赖（写读分离的模块边界）。
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

  it('规则4：ingest 与 dashboard 互不依赖（写读分离的模块边界——未来的进程边界）', () => {
    const forbidden: Record<string, string> = { ingest: 'dashboard', dashboard: 'ingest' };
    for (const f of files) {
      const myModule = moduleOf(f);
      if (!myModule || !(myModule in forbidden)) continue;
      for (const spec of importsOf(f)) {
        const target = resolveImport(f, spec);
        assert.ok(
          moduleOf(target) !== forbidden[myModule],
          `${relative(SRC, f)} 依赖了 ${forbidden[myModule]} 模块：${spec}`
        );
      }
    }
  });
});
