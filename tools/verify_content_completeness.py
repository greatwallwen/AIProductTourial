from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_BASE = ROOT / "md"


REQUIRED_TERMS = {
    "01-逻辑证据与AI基础.md": (
        "命题",
        "前提",
        "观察",
        "推断",
        "动作",
        "qwen-plus",
    ),
    "CH02-推理链.md": (
        "与",
        "或",
        "非",
        "蕴含",
        "等价",
        "三段论",
        "反例",
        "证伪",
        "演绎",
    ),
    "CH03-从样本到结论.md": (
        "归纳",
        "抽样",
        "统计",
        "相关",
        "回归",
        "因果",
        "随机",
        "实验",
    ),
    "03-Agent与Skill工程.md": (
        "普通工作流",
        "Agent",
        "Skill",
        "触发",
        "不触发",
        "测试",
        "版本",
        "安全",
    ),
    "04-Grill-Harness-Loop.md": (
        "Grill",
        "Harness",
        "Loop",
        "停止条件",
        "恢复点",
    ),
    "05-产品与系统架构.md": (
        "规格驱动",
        "质量属性",
        "C4",
        "限界上下文",
        "实体",
        "值对象",
        "聚合",
        "领域事件",
        "事件驱动",
        "微服务",
        "幂等",
        "重试",
        "RAG",
        "MCP",
        "A2A",
    ),
}

THEORY_IMAGES = {
    "01-逻辑证据与AI基础.md": (
        "../assets/theory/logic-three-step.svg",
        "../assets/theory/logic-five-layer.svg",
    ),
    "CH02-推理链.md": (
        "../assets/theory/ai-stack.png",
        "../assets/theory/logic-chain-review.svg",
    ),
    "CH03-从样本到结论.md": ("../assets/theory/experiment-five-questions.svg",),
    "04-Grill-Harness-Loop.md": ("../assets/theory/loop.png",),
    "05-产品与系统架构.md": ("../assets/theory/architecture.png",),
}

FORBIDDEN = (
    "讲师使用说明",
    "讲师工作坊",
    "证据边界",
    "失败分支",
    "```mermaid",
)


def main() -> int:
    errors: list[str] = []
    chapter_text: dict[str, str] = {}
    for filename, terms in REQUIRED_TERMS.items():
        path = KNOWLEDGE_BASE / filename
        if not path.is_file():
            errors.append(f"missing chapter: md/{filename}")
            continue
        text = path.read_text(encoding="utf-8")
        chapter_text[filename] = text
        for term in terms:
            if term not in text:
                errors.append(f"{filename} missing required concept: {term}")

    for filename, targets in THEORY_IMAGES.items():
        text = chapter_text.get(filename, "")
        for target in targets:
            if target not in text:
                errors.append(f"{filename} missing theory image: {target}")
            asset = (KNOWLEDGE_BASE / target).resolve()
            if not asset.is_file():
                errors.append(f"theory image does not exist: {target}")

    combined = "\n".join(chapter_text.values())
    for phrase in FORBIDDEN:
        if phrase in combined:
            errors.append(f"forbidden course wording: {phrase}")

    source_card = ROOT / "sources" / "cards" / "knowledge-foundation-officials-2026-07.md"
    if not source_card.is_file():
        errors.append("missing current official knowledge source card")

    if errors:
        print("CONTENT COMPLETENESS FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "CONTENT COMPLETENESS PASSED "
        f"chapters={len(REQUIRED_TERMS)} concepts={sum(map(len, REQUIRED_TERMS.values()))} "
        f"theory_images={sum(map(len, THEORY_IMAGES.values()))}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
