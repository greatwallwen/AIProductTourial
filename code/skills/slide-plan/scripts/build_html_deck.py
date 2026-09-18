from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from pathlib import Path
from typing import Any


GRAPHIC_RE = re.compile(r"<!--\s*graphic:\s*([^|]+)\|\s*(.*?)\s*-->")


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _is_separator(row: list[str]) -> bool:
    return bool(row) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in row)


def parse_outline(markdown: str) -> dict[str, Any]:
    lines = markdown.splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), "")
    if not title:
        raise ValueError("missing_h1_title")
    subtitle = next((line[2:].strip() for line in lines if line.startswith("> ")), "")
    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for raw_line in lines:
        line = raw_line.strip()
        if line.startswith("## "):
            current = {
                "kind": "content",
                "title": line[3:].strip(),
                "bullets": [],
                "rows": [],
                "graphic": "",
            }
            sections.append(current)
            continue
        if current is None:
            continue
        if line == "<!-- layout: section -->":
            current["kind"] = "section"
        elif line.startswith("- "):
            current["bullets"].append(line[2:].strip())
        elif line.startswith("|") and line.endswith("|"):
            row = _cells(line)
            if not _is_separator(row):
                current["rows"].append(row)
                current["kind"] = "table"
        else:
            match = GRAPHIC_RE.fullmatch(line)
            if match:
                current["graphic_id"] = match.group(1).strip()
                current["graphic"] = match.group(2).strip()
                current["kind"] = "graphic"

    slides: list[dict[str, Any]] = [{"kind": "title", "title": title, "subtitle": subtitle}]
    slides.extend(sections)
    return {"title": title, "subtitle": subtitle, "slides": slides}


def _render_slide(slide: dict[str, Any], index: int, total: int) -> str:
    kind = slide["kind"]
    title = html.escape(slide["title"])
    active = " active visible" if index == 0 else ""
    body = ""

    if kind == "title":
        body = f'''<div class="title-grid">
          <div class="eyebrow reveal">DATA QUALITY / 01</div>
          <h1 class="reveal">{title}</h1>
          <p class="subtitle reveal">{html.escape(slide.get("subtitle", ""))}</p>
          <div class="title-mark reveal" aria-hidden="true"><span>READ</span><span>CHECK</span><span>DECIDE</span></div>
        </div>'''
    elif kind == "section":
        number, _, rest = title.partition(" ")
        body = f'''<div class="section-grid">
          <div class="section-number reveal">{number}</div>
          <h2 class="reveal">{rest or title}</h2>
          <p class="section-note reveal">先确认数据边界，再决定能回答什么。</p>
        </div>'''
    elif kind == "content":
        bullets = "".join(
            f'<li class="reveal"><span>{position:02d}</span>{html.escape(item)}</li>'
            for position, item in enumerate(slide.get("bullets", []), start=1)
        )
        body = f'''<div class="content-grid">
          <header><div class="eyebrow">METHOD / BOUNDARY</div><h2>{title}</h2></header>
          <ol class="principles">{bullets}</ol>
          <aside class="stop-rule reveal"><strong>停止规则</strong><p>缺失原因没有证据时，不自动删除、不自动填补。</p></aside>
        </div>'''
    elif kind == "table":
        rows = slide.get("rows", [])
        head = rows[0] if rows else []
        table_head = "".join(f"<th>{html.escape(cell)}</th>" for cell in head)
        table_body = "".join(
            "<tr>" + "".join(f"<td>{html.escape(cell)}</td>" for cell in row) + "</tr>"
            for row in rows[1:]
        )
        body = f'''<div class="table-grid">
          <header><div class="eyebrow">OBSERVED / MISSING</div><h2>{title}</h2></header>
          <table><thead><tr>{table_head}</tr></thead><tbody>{table_body}</tbody></table>
          <p class="table-note">缺失率使用固定样本总行数计算，本页不解释污染原因。</p>
        </div>'''
    else:
        steps = ["读取", "体检", "人工复核", "分析"]
        flow = "".join(
            f'<div class="flow-step reveal"><span>{position:02d}</span><strong>{step}</strong></div>'
            for position, step in enumerate(steps, start=1)
        )
        body = f'''<div class="flow-grid">
          <header><div class="eyebrow">REVIEW / FLOW</div><h2>{title}</h2></header>
          <div class="flow">{flow}</div>
          <div class="branch reveal"><span>STOP</span><p>字段或口径不足时，回到人工复核，不直接进入分析。</p></div>
          <p class="flow-contract">{html.escape(slide.get("graphic", ""))}</p>
        </div>'''

    return f'''      <section class="slide slide-{kind}{active}" data-index="{index}" aria-label="第 {index + 1} 页，共 {total} 页">
        {body}
        <div class="folio" aria-hidden="true">{index + 1:02d} / {total:02d}</div>
      </section>'''


def render_html(deck: dict[str, Any]) -> str:
    slides = deck["slides"]
    slide_html = "\n".join(_render_slide(slide, index, len(slides)) for index, slide in enumerate(slides))
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(deck["title"])}</title>
  <style>
    :root {{ --ink:#172633; --paper:#f4f1e8; --cyan:#16a6b6; --yellow:#f2b632; --muted:#61717c; --line:#c8d0cf; --stage-bg:#101820; --slide-bg:var(--paper); }}
    * {{ box-sizing:border-box; margin:0; padding:0; }}
    html, body {{ width:100%; height:100%; overflow:hidden; background:var(--stage-bg); color:var(--ink); font-family:"Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",sans-serif; }}
    .deck-viewport {{ position:fixed; inset:0; overflow:hidden; background:var(--stage-bg); }}
    .deck-stage {{ position:absolute; left:0; top:0; width: 1920px; height: 1080px; overflow:hidden; transform-origin:0 0; background:var(--slide-bg); }}
    .slide {{ position:absolute; inset:0; width:1920px; height:1080px; overflow:hidden; visibility:hidden; opacity:0; pointer-events:none; padding:90px 110px; background:var(--slide-bg); }}
    .slide.active, .slide.visible {{ visibility:visible; opacity:1; pointer-events:auto; z-index:1; }}
    img, video, canvas, svg {{ max-width:100%; max-height:100%; }}
    .slide::before {{ content:""; position:absolute; left:0; top:0; width:18px; height:100%; background:var(--cyan); }}
    .eyebrow {{ color:var(--cyan); font-size:22px; font-weight:700; letter-spacing:0; text-transform:uppercase; }}
    h1, h2 {{ font-family:"Noto Serif CJK SC","Source Han Serif SC",SimSun,serif; letter-spacing:0; }}
    h1 {{ max-width:1100px; font-size:132px; line-height:1.08; }}
    h2 {{ font-size:78px; line-height:1.14; }}
    .reveal {{ opacity:0; transform:translateY(28px); transition:opacity .55s ease, transform .55s ease; }}
    .visible .reveal {{ opacity:1; transform:none; }}
    .visible .reveal:nth-child(2) {{ transition-delay:.08s; }} .visible .reveal:nth-child(3) {{ transition-delay:.16s; }} .visible .reveal:nth-child(4) {{ transition-delay:.24s; }}
    .title-grid {{ height:100%; display:grid; grid-template-columns:1fr 430px; grid-template-rows:auto 1fr auto; gap:32px 80px; align-items:center; }}
    .title-grid .eyebrow {{ grid-column:1 / 3; }} .title-grid h1 {{ grid-column:1; align-self:end; }}
    .subtitle {{ grid-column:1; align-self:start; max-width:920px; font-size:34px; color:var(--muted); line-height:1.6; }}
    .title-mark {{ grid-column:2; grid-row:2 / 4; align-self:stretch; display:grid; align-content:end; gap:14px; border-left:2px solid var(--ink); padding:0 0 32px 38px; }}
    .title-mark span {{ display:block; font-size:64px; font-weight:800; }} .title-mark span:nth-child(2) {{ color:var(--cyan); }} .title-mark span:nth-child(3) {{ color:var(--yellow); }}
    .section-grid {{ height:100%; display:grid; grid-template-columns:460px 1fr; align-content:center; column-gap:100px; }}
    .section-number {{ font:800 270px/1 Georgia,serif; color:var(--yellow); }} .section-grid h2 {{ align-self:end; font-size:112px; }}
    .section-note {{ grid-column:2; margin-top:28px; font-size:32px; color:var(--muted); }}
    .content-grid, .table-grid, .flow-grid {{ height:100%; display:grid; grid-template-rows:auto 1fr auto; gap:54px; }}
    header h2 {{ margin-top:15px; }}
    .principles {{ list-style:none; display:grid; grid-template-columns:repeat(3,1fr); gap:28px; align-content:center; }}
    .principles li {{ min-height:280px; border-top:10px solid var(--cyan); background:#fff; padding:42px; font-size:34px; line-height:1.55; box-shadow:0 16px 36px rgba(23,38,51,.08); }}
    .principles li span {{ display:block; margin-bottom:50px; color:var(--yellow); font-size:28px; font-weight:800; }}
    .stop-rule {{ display:flex; gap:30px; align-items:baseline; border-top:2px solid var(--ink); padding-top:22px; }} .stop-rule strong {{ color:#a43b31; font-size:24px; }} .stop-rule p {{ font-size:27px; }}
    table {{ width:100%; align-self:center; border-collapse:collapse; background:#fff; font-size:38px; box-shadow:0 18px 44px rgba(23,38,51,.08); }}
    th, td {{ padding:25px 34px; text-align:left; border-bottom:2px solid var(--line); }} th {{ background:var(--ink); color:#fff; font-size:26px; }} td:not(:first-child), th:not(:first-child) {{ text-align:right; }} tbody tr:last-child td {{ border-bottom:0; }} tbody td:nth-child(3) {{ color:#a43b31; font-weight:800; }}
    .table-note, .flow-contract {{ font-size:24px; color:var(--muted); }}
    .flow {{ display:grid; grid-template-columns:repeat(4,1fr); gap:54px; align-items:center; }}
    .flow-step {{ position:relative; height:210px; display:grid; align-content:center; padding:34px; background:#fff; border:2px solid var(--line); }}
    .flow-step:not(:last-child)::after {{ content:""; position:absolute; right:-43px; top:50%; width:32px; height:4px; background:var(--cyan); }}
    .flow-step span {{ color:var(--cyan); font-size:22px; font-weight:800; }} .flow-step strong {{ margin-top:26px; font-size:40px; }}
    .branch {{ position:absolute; right:120px; bottom:145px; width:500px; display:grid; grid-template-columns:100px 1fr; gap:20px; border-left:8px solid #a43b31; padding:24px 28px; background:#fff; }} .branch span {{ color:#a43b31; font-weight:900; font-size:24px; }} .branch p {{ font-size:22px; line-height:1.45; }}
    .folio {{ position:absolute; right:55px; top:48px; color:var(--muted); font-size:18px; font-weight:700; }}
    .deck-controls {{ position:fixed; left:50%; bottom:20px; z-index:1000; transform:translateX(-50%); display:flex; align-items:center; gap:12px; padding:8px 12px; background:#fff; border:1px solid #d8dfdf; box-shadow:0 6px 18px rgba(0,0,0,.16); }}
    .deck-controls button {{ width:42px; height:42px; border:0; background:transparent; color:var(--ink); font-size:25px; cursor:pointer; }} .deck-controls button:focus-visible {{ outline:3px solid var(--yellow); outline-offset:2px; }}
    .deck-controls button[aria-pressed="true"] {{ background:var(--yellow); }}
    [contenteditable="true"] {{ outline:3px dashed var(--cyan); outline-offset:5px; }}
    #pageStatus {{ min-width:72px; text-align:center; font-size:16px; font-variant-numeric:tabular-nums; }}
    @media print {{ html,body {{ width:1920px; height:auto; overflow:visible; background:#fff; }} .deck-viewport,.deck-stage {{ position:static; width:auto; height:auto; overflow:visible; transform:none!important; }} .slide {{ position:relative; display:block!important; visibility:visible!important; opacity:1!important; width:1920px; height:1080px; break-after:page; }} .deck-controls {{ display:none; }} }}
    @media (prefers-reduced-motion: reduce) {{ *,*::before,*::after {{ animation-duration:.01ms!important; transition-duration:.01ms!important; }} }}
  </style>
</head>
<body>
  <div class="deck-viewport"><main class="deck-stage" id="deckStage">
{slide_html}
  </main></div>
  <nav class="deck-controls" aria-label="幻灯片导航"><button id="previous" aria-label="上一页" title="上一页">&#8592;</button><span id="pageStatus" aria-live="polite">1 / {len(slides)}</span><button id="next" aria-label="下一页" title="下一页">&#8594;</button><button id="edit" aria-label="编辑文字" aria-pressed="false" title="编辑文字 (E)">&#9998;</button></nav>
  <script>
    class SlidePresentation {{
      constructor() {{ this.slides=[...document.querySelectorAll('.slide')]; this.stage=document.getElementById('deckStage'); this.current=0; this.touchX=null; this.lastWheel=0; this.storageKey=`frontend-slides:${{document.title}}`; this.editables=[...this.stage.querySelectorAll('h1,h2,p,li,td,th,strong')]; this.restore(); this.scale(); this.show(0); window.addEventListener('resize',()=>this.scale()); document.addEventListener('keydown',(event)=>this.onKey(event)); document.addEventListener('wheel',(event)=>this.onWheel(event),{{passive:false}}); document.addEventListener('touchstart',(event)=>{{this.touchX=event.changedTouches[0].clientX;}},{{passive:true}}); document.addEventListener('touchend',(event)=>this.onTouch(event),{{passive:true}}); document.getElementById('previous').addEventListener('click',()=>this.show(this.current-1)); document.getElementById('next').addEventListener('click',()=>this.show(this.current+1)); document.getElementById('edit').addEventListener('click',()=>this.toggleEdit()); this.editables.forEach((node)=>node.addEventListener('input',()=>this.save())); }}
      scale() {{ const factor=Math.min(innerWidth/1920,innerHeight/1080); const x=(innerWidth-1920*factor)/2; const y=(innerHeight-1080*factor)/2; this.stage.style.transform=`translate(${{x}}px, ${{y}}px) scale(${{factor}})`; }}
      show(index) {{ this.current=Math.max(0,Math.min(index,this.slides.length-1)); this.slides.forEach((slide,i)=>{{slide.classList.toggle('active',i===this.current);slide.classList.toggle('visible',i===this.current);}}); document.getElementById('pageStatus').textContent=`${{this.current+1}} / ${{this.slides.length}}`; }}
      onKey(event) {{ if(event.target.isContentEditable)return; if(event.key.toLowerCase()==='e'){{event.preventDefault();this.toggleEdit();return;}} if(['ArrowRight','PageDown',' '].includes(event.key)){{event.preventDefault();this.show(this.current+1);}} if(['ArrowLeft','PageUp'].includes(event.key)){{event.preventDefault();this.show(this.current-1);}} if(event.key==='Home')this.show(0); if(event.key==='End')this.show(this.slides.length-1); }}
      onWheel(event) {{ event.preventDefault(); const now=Date.now(); if(now-this.lastWheel<450||Math.abs(event.deltaY)<12)return; this.lastWheel=now; this.show(this.current+(event.deltaY>0?1:-1)); }}
      onTouch(event) {{ if(this.touchX===null)return; const delta=event.changedTouches[0].clientX-this.touchX; if(Math.abs(delta)>45)this.show(this.current+(delta<0?1:-1)); this.touchX=null; }}
      toggleEdit() {{ const button=document.getElementById('edit'); const enabled=button.getAttribute('aria-pressed')!=='true'; button.setAttribute('aria-pressed',String(enabled)); this.editables.forEach((node)=>{{node.contentEditable=String(enabled);}}); if(!enabled)this.save(); }}
      save() {{ localStorage.setItem(this.storageKey,JSON.stringify(this.editables.map((node)=>node.innerHTML))); }}
      restore() {{ try {{ const values=JSON.parse(localStorage.getItem(this.storageKey)||'null'); if(Array.isArray(values)&&values.length===this.editables.length)this.editables.forEach((node,index)=>{{node.innerHTML=values[index];}}); }} catch (_) {{ localStorage.removeItem(this.storageKey); }} }}
    }}
    window.presentation=new SlidePresentation();
  </script>
</body>
</html>
'''


def _load_source(input_value: str, allowed_root_value: str) -> tuple[Path, bytes, str]:
    root = Path(allowed_root_value).resolve()
    source = Path(input_value).resolve()
    if not root.is_dir():
        raise ValueError("allowed_root_missing")
    if not _inside(source, root):
        raise ValueError("input_outside_allowed_root")
    if source.suffix.lower() != ".md" or not source.is_file():
        raise ValueError("input_must_be_existing_markdown")
    raw = source.read_bytes()
    return source, raw, hashlib.sha256(raw).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Build an offline fixed-stage HTML deck from course Markdown.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--allowed-root", required=True)
    parser.add_argument("--html-output", required=True)
    parser.add_argument("--receipt-output", required=True)
    args = parser.parse_args()
    try:
        source, raw, digest = _load_source(args.input, args.allowed_root)
        deck = parse_outline(raw.decode("utf-8-sig"))
        html_output = Path(args.html_output).resolve()
        receipt_output = Path(args.receipt_output).resolve()
        if html_output == source or receipt_output == source:
            raise ValueError("output_must_not_overwrite_input")
        html_output.parent.mkdir(parents=True, exist_ok=True)
        receipt_output.parent.mkdir(parents=True, exist_ok=True)
        html_output.write_text(render_html(deck), encoding="utf-8")
        receipt = {
            "schema_version": "1.0",
            "status": "complete-local",
            "source": {"path": str(source), "sha256": digest, "read_mode": "read-only"},
            "source_skill": "skills/frontend-slides/SKILL.md",
            "skill_commit": "9906a34d640d2111f724544cbc50f7f130569ae1",
            "output_format": "single-file-html",
            "slide_count": len(deck["slides"]),
            "offline": True,
            "fixed_stage": "1920x1080",
            "features": ["keyboard", "wheel", "touch", "inline-edit", "local-save", "print", "reduced-motion"],
        }
        receipt_output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps({"status": "complete-local", "slides": len(deck["slides"]), "html": str(html_output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
