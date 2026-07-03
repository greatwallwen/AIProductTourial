#!/usr/bin/env bash
# 四个示例工程的总验证入口："教程代码真实可运行"的最终证明
# 用法：bash scripts/verify-all.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECTS=(01-gov-approval 02-contract-ledger 03-device-monitor 04-saas-ticket)

declare -A RESULT
FAIL=0
for p in "${PROJECTS[@]}"; do
  echo ""
  echo "════════════ code/$p ════════════"
  if (cd "$ROOT/code/$p" && npm ci --silent && npm run verify); then
    RESULT[$p]="通过 ✅"
  else
    RESULT[$p]="失败 ❌"
    FAIL=1
  fi
done

echo ""
echo "══════════════ 汇总 ══════════════"
printf '%-24s %s\n' "工程" "结果"
for p in "${PROJECTS[@]}"; do
  printf '%-24s %s\n' "$p" "${RESULT[$p]}"
done
exit $FAIL
