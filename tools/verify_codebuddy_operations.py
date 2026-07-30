from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHAPTER = ROOT / "md" / "08-课程项目.md"
RECEIPT = ROOT / "evidence" / "runtime" / "codebuddy" / "receipt.json"
SOURCE_CARD = ROOT / "sources" / "cards" / "codebuddy-official-operations-2026-07.md"


def main() -> int:
    errors: list[str] = []
    chapter = CHAPTER.read_text(encoding="utf-8")

    required_text = (
        "## CodeBuddy：完成一轮，而不是生成一堆文件",
        "CodeBuddy IDE 是主入口",
        "先读取：",
        "用户此刻要完成什么决定",
        "运行该案例的聚焦测试和类型检查",
        "最后只给出：改动文件、测试结果、页面达到的最终状态、仍未验证的事项",
        "## CLI 只做边界清楚的任务",
        "--permission-mode plan",
        '--tools "Read,Glob,Grep"',
        "进入默认权限模式",
        "账号未登录而停止",
    )
    for item in required_text:
        if item not in chapter:
            errors.append(f"course map missing CodeBuddy operation: {item}")

    if "--dangerously-skip-permissions" in chapter or "bypassPermissions" in chapter:
        errors.append("course map recommends bypassing CodeBuddy permissions")

    receipt_link = "../evidence/runtime/codebuddy/receipt.json"
    if receipt_link not in chapter:
        errors.append("course map missing CodeBuddy receipt link")
    if not (CHAPTER.parent / receipt_link).resolve().is_file():
        errors.append("CodeBuddy receipt link does not resolve")

    try:
        receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"CodeBuddy receipt cannot be read: {error}")
        receipt = {}

    ide = receipt.get("ide", {})
    cli = receipt.get("cli", {})
    probe = receipt.get("modelProbe", {})
    claims = receipt.get("claims", {})
    if ide.get("version") != "1.106.1" or ide.get("exitCode") != 0:
        errors.append("IDE program-entry verification changed")
    if cli.get("version") != "2.128.1" or cli.get("exitCode") != 0:
        errors.append("CLI program-entry verification changed")
    if probe.get("status") != "blocked_not_verified":
        errors.append("unauthenticated CLI probe is not marked blocked_not_verified")
    if probe.get("modelResponseObserved") is not False:
        errors.append("CLI receipt incorrectly claims a model response")
    if claims.get("authenticatedCodeBuddyModelRoundTripVerified") is not False:
        errors.append("receipt incorrectly claims authenticated CodeBuddy model verification")

    try:
        card = SOURCE_CARD.read_text(encoding="utf-8")
    except OSError as error:
        errors.append(f"CodeBuddy official source card cannot be read: {error}")
        card = ""
    for url in (
        "https://www.codebuddy.ai/docs/cli/quickstart",
        "https://www.codebuddy.ai/docs/cli/reference",
        "https://www.codebuddy.ai/docs/cli/interactive-mode",
        "https://www.codebuddy.ai/docs/ide/Getting-Started/Installation",
    ):
        if url not in card:
            errors.append(f"official source card missing: {url}")

    if errors:
        print("CODEBUDDY OPERATIONS FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "CODEBUDDY OPERATIONS PASSED "
        "ide=1.106.1 cli=2.128.1 model_roundtrip=blocked_not_verified"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
