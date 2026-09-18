from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any


SELECTED_TASK = "CN-TEL-2025Q2-0008"
SCENARIO_LABELS = {
    "committed_response_lost": "响应丢失",
    "effect_status_unknown": "效果未知",
    "not_committed": "尚未提交",
}


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_context(source: Path) -> dict[str, Any]:
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("empty_csv")
    selected = next((row for row in rows if row.get("task_id") == SELECTED_TASK), None)
    if selected is None:
        raise ValueError("selected_task_missing")
    scenario_counts = Counter(row["external_lookup_scenario"] for row in rows)
    directory = [selected]
    directory.extend(row for row in rows if row is not selected and len(directory) < 9)
    return {
        "row_count": len(rows),
        "scenario_counts": dict(sorted(scenario_counts.items())),
        "selected": selected,
        "directory": directory,
    }


def _directory_rows(context: dict[str, Any]) -> str:
    items = []
    for row in context["directory"]:
        task_id = html.escape(row["task_id"])
        scenario = row["external_lookup_scenario"]
        active = " is-active" if row["task_id"] == SELECTED_TASK else ""
        pressed = "true" if active else "false"
        items.append(
            f'''<button class="task-row{active}" type="button" data-task="{task_id}" data-scenario="{scenario}" aria-pressed="{pressed}">
              <span><strong>{task_id}</strong><small>{html.escape(row['province'])} · {html.escape(row['city'])}</small></span>
              <span class="status-dot status-{scenario}" aria-label="{SCENARIO_LABELS[scenario]}"></span>
            </button>'''
        )
    return "\n".join(items)


def _variant_styles(variant: str) -> tuple[str, str]:
    if variant == "tabler":
        link = '<link rel="stylesheet" href="vendor/tabler.min.css">'
        additions = '''
    body { --tblr-body-bg:#f3f5f7; }
    .topbar,.directory,.work-panel,.evidence-block,.chain-block { background:var(--tblr-bg-surface,#fff); }
    .topbar,.directory,.work-panel,.evidence-block,.chain-block { border-color:var(--tblr-border-color,#d9dee3); }
    .filter-button,.task-row,.result-option { border-radius:var(--tblr-border-radius,4px); }
    .primary-action { background:var(--tblr-primary,#066fd1); }
    .eyebrow,.metric strong,.chain-step strong { color:var(--tblr-primary,#066fd1); }
'''
    else:
        link = ""
        additions = '''
    body { background:#eef2f1; color:#17211f; }
    .topbar,.directory,.work-panel,.evidence-block,.chain-block { background:#fff; border-color:#ccd6d2; }
    .primary-action { background:#126b5b; }
    .eyebrow,.metric strong,.chain-step strong { color:#126b5b; }
'''
    return link, additions


def render_page(context: dict[str, Any], variant: str) -> str:
    if variant not in {"skill", "tabler"}:
        raise ValueError("unknown_variant")
    selected = context["selected"]
    counts = context["scenario_counts"]
    tabler_link, variant_css = _variant_styles(variant)
    tabler_classes = {
        "panel": " card" if variant == "tabler" else "",
        "button": " btn btn-primary" if variant == "tabler" else "",
        "badge": " badge bg-azure-lt" if variant == "tabler" else "",
        "table": " table table-vcenter" if variant == "tabler" else "",
    }
    title_suffix = "UI Workbench + Tabler UI Kit" if variant == "tabler" else "UI Workbench Skill"
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通信请求恢复核查 · {title_suffix}</title>
  {tabler_link}
  <style>
    :root {{ --ink:#17211f; --muted:#64726e; --line:#ccd6d2; --surface:#fff; --green:#126b5b; --amber:#a66a13; --red:#ae3e32; }}
    * {{ box-sizing:border-box; }}
    html,body {{ margin:0; min-height:100%; font-family:"Noto Sans CJK SC","Microsoft YaHei",sans-serif; letter-spacing:0; }}
    body {{ font-size:14px; line-height:1.45; }}
    button,input,textarea {{ font:inherit; }}
    button {{ cursor:pointer; }}
    .skip-link {{ position:fixed; left:12px; top:10px; z-index:100; padding:8px 12px; background:#111; color:#fff; transform:translateY(-160%); }}
    .skip-link:focus {{ transform:none; }}
    .topbar {{ min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:14px 24px; border-bottom:1px solid var(--line); }}
    .brand {{ display:flex; align-items:center; gap:13px; min-width:0; }}
    .brand-mark {{ width:11px; height:36px; background:#19a78f; }}
    .brand h1 {{ margin:0; font-size:20px; line-height:1.25; }}
    .brand p {{ margin:3px 0 0; color:var(--muted); font-size:12px; }}
    .top-metrics {{ display:flex; gap:28px; }}
    .metric {{ display:grid; gap:1px; text-align:right; }} .metric strong {{ font-size:20px; }} .metric span {{ color:var(--muted); font-size:11px; }}
    .shell {{ display:grid; grid-template-columns:270px minmax(520px,1fr) 330px; min-height:calc(100vh - 72px); }}
    .directory,.work-panel {{ border-right:1px solid var(--line); }}
    .directory,.work-panel,.decision-panel {{ min-width:0; padding:18px; }}
    .section-head {{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }}
    .section-head h2,.section-head h3 {{ margin:0; font-size:15px; }}
    .eyebrow {{ font-size:11px; font-weight:800; text-transform:uppercase; }}
    .search {{ width:100%; height:38px; padding:0 11px; border:1px solid var(--line); background:#fff; color:var(--ink); }}
    .filter-row {{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:10px 0 12px; }}
    .filter-button {{ min-height:52px; border:1px solid var(--line); background:#f8faf9; color:var(--ink); padding:7px 4px; }}
    .filter-button strong,.filter-button span {{ display:block; }} .filter-button span {{ color:var(--muted); font-size:11px; }}
    .filter-button[aria-pressed="true"] {{ border-color:#126b5b; box-shadow:inset 0 -3px #126b5b; }}
    .task-list {{ display:grid; gap:6px; }}
    .task-row {{ width:100%; min-height:56px; display:flex; justify-content:space-between; align-items:center; gap:12px; text-align:left; padding:9px 10px; border:1px solid transparent; background:transparent; color:var(--ink); }}
    .task-row:hover,.task-row:focus-visible {{ background:#f2f7f5; border-color:var(--line); }} .task-row.is-active {{ background:#e8f3ef; border-color:#8ec3b6; }}
    .task-row span:first-child {{ min-width:0; }} .task-row strong,.task-row small {{ display:block; overflow:hidden; text-overflow:ellipsis; }} .task-row strong {{ font-size:12px; white-space:nowrap; }} .task-row small {{ margin-top:4px; color:var(--muted); }}
    .status-dot {{ flex:0 0 auto; width:9px; height:9px; border-radius:50%; background:#7b8582; }} .status-committed_response_lost {{ background:#d08918; }} .status-effect_status_unknown {{ background:#b44438; }} .status-not_committed {{ background:#3e8878; }}
    .record-head {{ display:flex; justify-content:space-between; gap:24px; align-items:start; padding:4px 2px 18px; }}
    .record-head h2 {{ margin:4px 0 5px; font-size:24px; }} .record-head p {{ margin:0; color:var(--muted); }}
    .state-badge {{ display:inline-flex; align-items:center; min-height:28px; padding:4px 9px; background:#fff1d8; color:#7a4b08; border:1px solid #e4be7a; white-space:nowrap; }}
    .chain-block,.evidence-block,.decision-card {{ border:1px solid var(--line); }}
    .chain-block {{ padding:18px; }}
    .chain {{ display:grid; grid-template-columns:repeat(3,1fr); gap:28px; margin-top:18px; }}
    .chain-step {{ position:relative; min-height:115px; padding:15px; border-top:4px solid #126b5b; background:#f7f9f8; }}
    .chain-step:not(:last-child)::after {{ content:"→"; position:absolute; right:-21px; top:42px; color:#8a9692; font-size:18px; }}
    .chain-step strong,.chain-step span {{ display:block; }} .chain-step strong {{ margin-bottom:12px; }} .chain-step span {{ color:var(--muted); }}
    .evidence-block {{ margin-top:14px; overflow:hidden; }} .evidence-block .section-head {{ padding:16px 18px 0; }}
    .evidence-table {{ width:100%; border-collapse:collapse; }}
    .evidence-table th,.evidence-table td {{ padding:12px 16px; text-align:left; border-top:1px solid var(--line); vertical-align:top; }} .evidence-table th {{ color:var(--muted); font-size:11px; }}
    .fact {{ color:#245c50; }} .unknown {{ color:#a53b32; font-weight:700; }}
    .decision-panel {{ background:#f7f8f7; }}
    .decision-card {{ background:#fff; padding:17px; }}
    .decision-card fieldset {{ border:0; padding:0; margin:18px 0; }} .decision-card legend {{ margin-bottom:8px; font-weight:700; }}
    .form-row {{ display:grid; gap:6px; margin-top:13px; }} .form-row label {{ font-weight:700; font-size:12px; }}
    .form-row input,.form-row textarea {{ width:100%; border:1px solid var(--line); padding:9px 10px; background:#fff; color:var(--ink); }} .form-row textarea {{ min-height:78px; resize:vertical; }}
    .result-grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }}
    .result-option {{ display:flex; align-items:center; justify-content:center; gap:5px; min-height:42px; border:1px solid var(--line); background:#fff; }}
    .actions {{ display:grid; gap:8px; margin-top:16px; }}
    .actions button {{ min-height:42px; border:1px solid var(--line); padding:8px 12px; }}
    .primary-action {{ border-color:transparent!important; color:#fff!important; }} .secondary-action {{ background:#fff; color:var(--ink); }}
    .actions button:disabled {{ cursor:not-allowed; opacity:.45; }}
    .gate-list {{ margin:16px 0 0; padding:13px 0 0 18px; border-top:1px solid var(--line); color:var(--muted); }}
    .live-status {{ min-height:22px; margin:10px 0 0; color:#245c50; font-size:12px; }}
    :focus-visible {{ outline:3px solid #f2b544; outline-offset:2px; }}
    [hidden] {{ display:none!important; }}
    {variant_css}
    @media (max-width: 1050px) {{ .shell {{ grid-template-columns:230px minmax(440px,1fr); }} .decision-panel {{ grid-column:1 / -1; border-top:1px solid var(--line); }} .decision-card {{ max-width:none; }} }}
    @media (max-width: 760px) {{ .topbar {{ align-items:flex-start; padding:12px 14px; }} .top-metrics {{ display:none; }} .shell {{ display:block; }} .directory,.work-panel {{ border-right:0; border-bottom:1px solid var(--line); }} .directory,.work-panel,.decision-panel {{ padding:14px; }} .chain {{ grid-template-columns:1fr; gap:8px; }} .chain-step:not(:last-child)::after {{ display:none; }} .record-head {{ display:grid; gap:10px; }} .record-head h2 {{ font-size:20px; }} .evidence-block {{ overflow-x:auto; }} .evidence-table {{ min-width:620px; }} .filter-row {{ grid-template-columns:1fr; }} .result-grid {{ grid-template-columns:1fr; }} }}
  </style>
</head>
<body>
  <a class="skip-link" href="#workspace">跳到核查工作区</a>
  <header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><div><h1>通信请求恢复核查</h1><p>{title_suffix} · 课程离线样本</p></div></div>
    <div class="top-metrics" aria-label="任务概览">
      <div class="metric"><strong>{context['row_count']:,}</strong><span>匿名课程任务</span></div>
      <div class="metric"><strong>{counts['committed_response_lost']}</strong><span>响应丢失</span></div>
      <div class="metric"><strong>{counts['effect_status_unknown']}</strong><span>效果未知</span></div>
    </div>
  </header>
  <main class="shell" id="workspace">
    <aside class="directory" aria-label="匿名恢复核查单目录">
      <div class="section-head"><div><div class="eyebrow">Queue</div><h2>待核查任务</h2></div><span>{len(context['directory'])} / {context['row_count']}</span></div>
      <label class="visually-hidden" for="task-search">搜索任务</label>
      <input class="search" id="task-search" type="search" placeholder="任务号、地区或类别" autocomplete="off">
      <div class="filter-row" aria-label="状态筛选">
        <button class="filter-button" type="button" data-filter="committed_response_lost" aria-pressed="true"><strong>{counts['committed_response_lost']}</strong><span>响应丢失</span></button>
        <button class="filter-button" type="button" data-filter="effect_status_unknown" aria-pressed="false"><strong>{counts['effect_status_unknown']}</strong><span>效果未知</span></button>
        <button class="filter-button" type="button" data-filter="not_committed" aria-pressed="false"><strong>{counts['not_committed']}</strong><span>尚未提交</span></button>
      </div>
      <div class="task-list">{_directory_rows(context)}</div>
    </aside>

    <section class="work-panel" aria-label="通信请求恢复记录">
      <div class="record-head"><div><div class="eyebrow">Recovery record</div><h2>{html.escape(selected['task_id'])}</h2><p>{html.escape(selected['province'])} · {html.escape(selected['city'])} · {html.escape(selected['subcategory'])} · {html.escape(selected['priority'])}优先级</p></div><span class="state-badge{tabler_classes['badge']}">外部效果未知</span></div>
      <section class="chain-block{tabler_classes['panel']}" aria-label="调用链路取证">
        <div class="section-head"><div><div class="eyebrow">Trace</div><h3>调用链路取证</h3></div><span>只陈述已观察事实</span></div>
        <div class="chain">
          <div class="chain-step"><strong>本地系统</strong><span class="fact">已登记任务与恢复关联键</span></div>
          <div class="chain-step"><strong>网络边界</strong><span class="fact">查询发出后响应未取得</span></div>
          <div class="chain-step"><strong>外部系统</strong><span class="unknown">外部效果未知</span></div>
        </div>
      </section>
      <section class="evidence-block{tabler_classes['panel']}" aria-label="证据对比矩阵">
        <div class="section-head"><div><div class="eyebrow">Evidence matrix</div><h3>观察、材料与结论分开</h3></div></div>
        <table class="evidence-table{tabler_classes['table']}"><thead><tr><th>核对项</th><th>当前观察</th><th>可用材料</th><th>允许结论</th></tr></thead><tbody>
          <tr><td>本地任务</td><td class="fact">任务已登记</td><td>任务号、接收时间</td><td>可确认</td></tr>
          <tr><td>查询发送</td><td class="fact">存在发送线索</td><td>恢复关联键</td><td>可确认</td></tr>
          <tr><td>查询响应</td><td class="unknown">响应未取得</td><td>暂无外部回执</td><td>不可推断失败</td></tr>
          <tr><td>外部效果</td><td class="unknown">尚未核对</td><td>需补查询材料</td><td>保持待核对</td></tr>
        </tbody></table>
      </section>
    </section>

    <aside class="decision-panel" aria-label="核对结果与完成条件">
      <form class="decision-card{tabler_classes['panel']}" id="result-form" novalidate>
        <div class="section-head"><div><div class="eyebrow">Decision gate</div><h2>核对结果</h2></div></div>
        <div class="form-row"><label for="lookup-target">查询目标</label><input id="lookup-target" value="计费中心"></div>
        <div class="form-row"><label for="lookup-note">查询说明</label><textarea id="lookup-note">只查询套餐变更是否已经生效，不重放原请求</textarea></div>
        <fieldset><legend>外部核对结果</legend><div class="result-grid">
          <label class="result-option"><input type="radio" name="result" value="unknown" checked>仍未知</label>
          <label class="result-option"><input type="radio" name="result" value="effective">已生效</label>
          <label class="result-option"><input type="radio" name="result" value="ineffective">未生效</label>
        </div></fieldset>
        <div class="form-row"><label for="result-summary">查询结果摘要</label><textarea id="result-summary" placeholder="写明观察，不把用户陈述改成事实"></textarea></div>
        <div class="form-row"><label for="evidence-id">证据编号</label><input id="evidence-id" placeholder="明确结果时必填"></div>
        <div class="actions"><button class="primary-action{tabler_classes['button']}" id="record-result" type="submit" disabled>记录核对结果</button><button class="secondary-action" id="keep-pending" type="button" disabled>保留待核对</button><button class="secondary-action" type="button" disabled>关闭课程恢复核查</button></div>
        <p class="live-status" id="live-status" aria-live="polite"></p>
        <ul class="gate-list"><li>明确结果需要摘要和证据编号</li><li>仍未知需要说明原因</li><li>关闭人与查询发起人必须不同</li></ul>
      </form>
    </aside>
  </main>
  <script>
    const search=document.getElementById('task-search');
    const filters=[...document.querySelectorAll('[data-filter]')];
    const tasks=[...document.querySelectorAll('.task-row')];
    let activeFilter='committed_response_lost';
    function applyDirectoryFilter(){{const query=search.value.trim().toLowerCase();tasks.forEach(task=>{{const matchesFilter=task.dataset.scenario===activeFilter;const matchesQuery=task.innerText.toLowerCase().includes(query);task.hidden=!(matchesFilter&&matchesQuery);}});}}
    filters.forEach(button=>button.addEventListener('click',()=>{{activeFilter=button.dataset.filter;filters.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));applyDirectoryFilter();}}));
    search.addEventListener('input',applyDirectoryFilter);
    tasks.forEach(task=>task.addEventListener('click',()=>{{tasks.forEach(item=>{{item.classList.toggle('is-active',item===task);item.setAttribute('aria-pressed',String(item===task));}});document.getElementById('live-status').textContent=`已选择 ${{task.dataset.task}}；演示数据面板仍固定展示代表任务 0008。`;}}));
    const form=document.getElementById('result-form');const summary=document.getElementById('result-summary');const evidence=document.getElementById('evidence-id');const record=document.getElementById('record-result');const pending=document.getElementById('keep-pending');const live=document.getElementById('live-status');
    function validateResult(){{const status=form.elements.result.value;const hasSummary=summary.value.trim().length>=8;const hasEvidence=evidence.value.trim().length>=6;record.disabled=status==='unknown'||!hasSummary||!hasEvidence;pending.disabled=status!=='unknown'||!hasSummary;evidence.required=status!=='unknown';return {{status,hasSummary,hasEvidence}};}}
    form.addEventListener('input',validateResult);form.addEventListener('change',validateResult);
    form.addEventListener('submit',event=>{{event.preventDefault();const state=validateResult();if(record.disabled)return;live.textContent=`已记录“${{state.status==='effective'?'已生效':'未生效'}}”演示结果；未向外部系统发送请求。`;}});
    pending.addEventListener('click',()=>{{if(pending.disabled)return;live.textContent='已保留待核对；演示页没有改写外部效果。';}});
    validateResult();applyDirectoryFilter();
  </script>
</body>
</html>
'''


def _prompts() -> dict[str, str]:
    return {
        "A-ordinary.txt": "做一个好看的通信投诉后台。\n",
        "B-structured.txt": (
            "基于 B10 通信请求恢复核查，做一个桌面优先且可响应的后台工作台。"
            "左侧是可搜索、可按三种场景筛选的匿名任务目录；中间显示本地记录、网络边界、"
            "外部效果三段调用链和证据矩阵；右侧记录查询目标、说明、仍未知/已生效/未生效、"
            "结果摘要和证据编号。必须包含空白、禁用、待核对、明确结果和错误提示状态，"
            "键盘可达，手机端不得水平溢出，不得生成个人信息或虚构外部结果。\n"
        ),
        "C-ui-workbench-skill.txt": (
            "使用 $ui-workbench 读取 dataset/10-telecom-complaint-orchestration/case.csv，"
            "按其工作流、状态矩阵、可访问性和浏览器验收规则生成 B10 工作台；不加载外部 UI Kit。\n"
        ),
        "D-ui-workbench-tabler.txt": (
            "使用 $ui-workbench 读取同一 B10 数据和交互合同，并使用固定版本 @tabler/core@1.4.0"
            "实现按钮、徽标、卡片和表格；不得把 Tabler 写成 Skill，保持与 C 组相同功能和文案。\n"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Prompt/Skill/UI Kit comparison from B10 data.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--tabler-css", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    try:
        root = Path(args.allowed_root).resolve()
        source = Path(args.input).resolve()
        css = Path(args.tabler_css).resolve()
        output = Path(args.output_dir).resolve()
        if not root.is_dir() or not _inside(source, root):
            raise ValueError("input_outside_allowed_root")
        if source.suffix.lower() != ".csv" or not source.is_file():
            raise ValueError("input_must_be_existing_csv")
        if not css.is_file() or css.name != "tabler.min.css":
            raise ValueError("tabler_css_missing")
        context = load_context(source)
        skill_dir = output / "skill-only"
        tabler_dir = output / "tabler"
        prompt_dir = output / "prompts"
        for directory in (skill_dir, tabler_dir / "vendor", prompt_dir):
            directory.mkdir(parents=True, exist_ok=True)
        (skill_dir / "index.html").write_text(render_page(context, "skill"), encoding="utf-8")
        (tabler_dir / "index.html").write_text(render_page(context, "tabler"), encoding="utf-8")
        shutil.copy2(css, tabler_dir / "vendor" / "tabler.min.css")
        for name, content in _prompts().items():
            (prompt_dir / name).write_text(content, encoding="utf-8")
        receipt = {
            "schema_version": "1.0",
            "status": "complete-local",
            "source": {"path": str(source), "sha256": _sha256(source), "read_mode": "read-only"},
            "row_count": context["row_count"],
            "selected_task": SELECTED_TASK,
            "source_skill": "code/skills/ui-workbench/SKILL.md",
            "ui_kit": "@tabler/core@1.4.0",
            "ui_kit_css_sha256": _sha256(css),
            "outputs": ["skill-only/index.html", "tabler/index.html"],
            "claims": {"a_output_generated": False, "b_output_generated": False, "c_output_generated": True, "d_output_generated": True},
        }
        (output / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps({"status": "complete-local", "row_count": context["row_count"], "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
