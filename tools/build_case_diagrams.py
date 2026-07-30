from __future__ import annotations

import argparse
import html
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "case-diagrams"


CASES = [
    ("B01", "大额取消单核验", "售后专员", "选择取消发票", "核对原单、付款与商品关系", "补证或提交独立复核", "复核人 / 主管", "取消单 CSV", "退货证据核验台", "补证·复核·暂缓", "材料齐全且角色分离", "案卷事件与状态投影"),
    ("B02", "8 元券首批试投", "会员运营", "筛选成长分层", "稳定抽样并核算人民币预算", "保存 240/60 分组方案", "运营主管", "会员行为 CSV", "优惠券试投台", "保存·确认·退回", "同种子同名单且组间不重叠", "试投方案与版本"),
    ("B03", "餐饮评论调查", "餐饮运营", "选择一个评论主题", "对照支持与反向原话", "建立小样本调查任务", "门店主管", "中文评论 CSV", "顾客评论调查台", "建任务·安排·暂不安排", "原话可追溯且不生成门店事实", "调查任务与引用"),
    ("B04", "金融材料补正", "客户经理", "选择匿名申请", "确认真实缺失材料", "登记回传并换人复核", "材料复核员", "申请与材料 CSV", "申请材料复核台", "补件·回传·双岗复核", "补件人和复核人不能相同", "申请事件与材料状态"),
    ("B05", "医院转运更正", "转运协调员", "定位晚到事件", "比较发生时间与接收时间", "追加更正并重新会签", "护士长 / 信息科", "脱敏事件 CSV", "转运交接协调台", "确认·会签·重开", "事件只追加不覆盖且无临床决定", "事件流与会签状态"),
    ("B06", "空气质量摘录", "数据发布员", "选择站点小时记录", "核对六项污染物与缺失", "冻结摘录范围或退回", "数据复核员", "空气质量 CSV", "历史数据摘录台", "冻结·发布·退回", "全空记录不得伪装为零", "摘录版本与复核记录"),
    ("B07", "即时零售履约调查", "架构负责人", "选择场站日期", "并排查看四域 P95 与事件", "记录假设并决定是否改架构", "技术负责人", "订单与运营证据", "履约架构调查台", "保存观察·提交决定", "同窗相关不等于调用因果", "观察、假设与决定"),
    ("B08", "养殖数值冲突", "水产调度员", "选择冲突测点", "对照系统值、现场值与时间", "派发取证并等待主管采信", "现场人员 / 主管", "水质与取证记录", "数值冲突调查台", "派发·回传·采信", "冲突值并存且来源可追溯", "调查事件与采信状态"),
    ("B09", "地铁断档调查", "可靠性工程师", "选择五分钟窗口", "复算样本数与最大间隔", "补记录或提交目视检查", "设备主管", "MetroPT-3 切片", "断档检查申请台", "补记录·提交·确认", "间隔达 120 秒即拒绝提交", "检查申请与审批事件"),
    ("B10", "通信请求中断恢复", "客诉协调员", "选择中断任务", "核对是否发送与外部结果", "查询状态后决定是否重试", "班组主管", "匿名任务 CSV", "请求恢复协调台", "查询·重试·关闭", "外部结果未知时不得重复提交", "幂等记录与任务状态"),
    ("B11", "模型发布补测", "模型发布经理", "选择候选版本", "比较总体与地区切片", "创建补测并双人确认", "独立评测人", "模型评测快照", "模型准入复核台", "补测·签署·确认", "差异、阈值与签署人都要核对", "准入状态与签署记录"),
    ("B12", "冷链材料补齐", "冷链调查员", "选择运输路线", "核对越界记录与交接材料", "补证后重开调查", "冷链主管", "运输温度 CSV", "冷链调查台", "补材料·重开·复核", "温度越界不能推出产品可用性", "调查单与材料状态"),
    ("B13", "制动异响安全分流", "服务顾问", "打开代表进线", "逐题记录能否移动等回答", "补问或转技师安全复核", "技师主管", "中国进线合成表", "售后安全分流台", "保存·补问·转交", "缺回答保留且不生成故障诊断", "问答事实单与交接"),
    ("B14", "浮选高硅调查", "工艺工程师", "选择连续事件窗", "比较槽列与过程字段", "保存核查任务与暂定方向", "工艺主管", "浮选过程 CSV", "高硅调查台", "建任务·回传·确认", "只记录相关线索不写根因", "核查任务与版本"),
    ("B15", "晶圆复测申请", "质量工程师", "选择未通过样本", "核对缺失通道与排名", "限定复测范围并签署", "质量主管", "SECOM 匿名信号", "晶圆复测申请台", "申请·签署·确认", "缺通道不得按零值处理", "复测申请与审批"),
    ("B16", "风机持续下偏检查", "风机运维工程师", "选择 T007 七日窗", "核对风速、功率与有效记录", "申请现场资料并确认收件", "运维主管", "风机日记录 CSV", "风机核查台", "申请·回传·收件", "日级标记不是故障概率", "核查任务与资料状态"),
    ("B17", "切刀波形排检", "设备工程师", "选择 BD-0003", "比较三路波形与缺失口径", "列入候选或继续补资料", "设备主管", "波形与候选队列", "切刀排检台", "建候选·补资料·确认", "三路齐全不等于故障已确认", "排检候选与审批"),
    ("B18", "锅炉主汽低温调查", "值班运行员", "选择 BT-0044 事件", "定位 24 分钟事件与分段", "下发人工检查并记录回传", "值长", "锅炉分钟窗口", "主汽温度调查台", "建检查·下发·回传", "曲线不能直接归因阀门或过热器", "检查任务与事件记录"),
    ("B19", "液压状态复查", "液压维护工程师", "选择第 217 循环", "并排比较三项同级指标", "排列检查顺序并确认", "维护主管", "液压循环 CSV", "液压状态复查台", "排顺序·提交·确认", "同级指标必须说明排序依据", "检查顺序与版本"),
    ("B20", "光伏少发线索核查", "站端工程师", "选择 PV-08 站日", "区分事实、线索与缺记录", "申请站端资料并确认方向", "区域主管", "光伏站日 CSV", "少发线索核查台", "申请·提交·确认", "派生线索不能写成发电损失", "核查任务与方向"),
]


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def text(x: int, y: int, value: str, *, size: int = 25, weight: int = 500, fill: str = "#17243b", anchor: str = "start") -> str:
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{esc(value)}</text>'


def card(x: int, y: int, width: int, height: int, index: int, title: str, detail: str, color: str) -> str:
    return "\n".join(
        [
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="22" fill="#ffffff" stroke="{color}" stroke-width="2" filter="url(#shadow)"/>',
            f'<circle cx="{x + 42}" cy="{y + 42}" r="20" fill="{color}"/>',
            text(x + 42, y + 50, str(index), size=20, weight=700, fill="#ffffff", anchor="middle"),
            text(x + 76, y + 49, title, size=25, weight=700),
            text(x + 24, y + 98, detail, size=18, weight=400, fill="#52647d"),
        ]
    )


def base(title: str, subtitle: str) -> list[str]:
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img">',
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7fbff"/><stop offset="1" stop-color="#eef5ff"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#24476f" flood-opacity="0.12"/></filter><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#5682b6"/></marker></defs>',
        '<rect width="1600" height="900" fill="url(#bg)"/>',
        '<rect x="0" y="0" width="1600" height="122" fill="#0f2744"/>',
        text(64, 55, title, size=34, weight=700, fill="#ffffff"),
        text(64, 93, subtitle, size=20, weight=400, fill="#bcd4ef"),
    ]


def requirement_svg(case: tuple[str, ...]) -> str:
    case_id, title, role, select, check, task, approver, *_ = case
    steps = [
        ("进入工作", role),
        ("锁定对象", select),
        ("核对材料", check),
        ("保存任务", task),
        ("独立确认", approver),
    ]
    colors = ["#2f7df5", "#00a896", "#7a5af8", "#f59e0b", "#e34d59"]
    parts = base(f"{case_id} · {title}", "需求流程｜谁在什么时刻，根据什么材料，作出什么决定")
    width, gap, start_x, y = 260, 34, 82, 250
    for index, ((step_title, detail), color) in enumerate(zip(steps, colors), start=1):
        x = start_x + (index - 1) * (width + gap)
        parts.append(card(x, y, width, 150, index, step_title, detail, color))
        if index < len(steps):
            parts.append(f'<line x1="{x + width + 8}" y1="{y + 75}" x2="{x + width + gap - 8}" y2="{y + 75}" stroke="#5682b6" stroke-width="3" marker-end="url(#arrow)"/>')
    parts.extend(
        [
            '<rect x="82" y="510" width="692" height="190" rx="26" fill="#eaf8f4" stroke="#6ccbb3" stroke-width="2"/>',
            text(118, 565, "材料够用", size=27, weight=700, fill="#087f68"),
            text(118, 612, "保存当前判断，交给不同角色确认", size=22, fill="#315f58"),
            text(118, 654, "状态变化必须留下版本与操作记录", size=19, fill="#55736d"),
            '<rect x="826" y="510" width="692" height="190" rx="26" fill="#fff4e8" stroke="#f0b35d" stroke-width="2"/>',
            text(862, 565, "材料不够", size=27, weight=700, fill="#a45b00"),
            text(862, 612, "只创建补资料任务，不猜缺失事实", size=22, fill="#795324"),
            text(862, 654, "不可逆动作保持不可用", size=19, fill="#7e6950"),
            text(800, 805, "角色分开 · 对象明确 · 材料可追溯 · 状态可恢复", size=23, weight=600, fill="#365777", anchor="middle"),
            "</svg>",
        ]
    )
    return "\n".join(parts) + "\n"


def architecture_svg(case: tuple[str, ...]) -> str:
    case_id, title, _, _, _, _, _, data, workbench, commands, rule, store = case
    parts = base(f"{case_id} · {title}", "技术架构｜数据、界面、类型化命令、领域规则与状态记录")
    nodes = [
        (96, 218, 300, 150, "数据层", data, "#2f7df5"),
        (476, 218, 300, 150, "Next.js 工作台", workbench, "#00a896"),
        (856, 218, 300, 150, "类型化命令", commands, "#7a5af8"),
        (1236, 218, 268, 150, "领域规则", rule, "#e34d59"),
        (476, 520, 300, 150, "服务端处理", "鉴权·版本·幂等·字段校验", "#0d9488"),
        (856, 520, 300, 150, "事件与投影", store, "#f59e0b"),
    ]
    for x, y, w, h, heading, detail, color in nodes:
        parts.extend(
            [
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="#ffffff" stroke="{color}" stroke-width="2" filter="url(#shadow)"/>',
                text(x + 24, y + 48, heading, size=25, weight=700, fill=color),
                text(x + 24, y + 94, detail, size=18, fill="#52647d"),
                f'<rect x="{x + 24}" y="{y + 112}" width="{w - 48}" height="5" rx="3" fill="{color}" opacity="0.25"/>',
            ]
        )
    arrows = [
        (396, 293, 466, 293),
        (776, 293, 846, 293),
        (1156, 293, 1226, 293),
        (1006, 378, 1006, 510),
        (846, 595, 786, 595),
        (626, 510, 626, 378),
    ]
    for x1, y1, x2, y2 in arrows:
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#5682b6" stroke-width="3" marker-end="url(#arrow)"/>')
    parts.extend(
        [
            '<rect x="96" y="520" width="300" height="150" rx="22" fill="#0f2744" filter="url(#shadow)"/>',
            text(120, 568, "聚焦测试", size=25, weight=700, fill="#ffffff"),
            text(120, 612, "状态门禁·角色权限·刷新恢复", size=18, fill="#c9d9eb"),
            text(120, 646, "不把界面文字当服务端结果", size=17, fill="#91afd0"),
            '<line x1="396" y1="595" x2="466" y2="595" stroke="#5682b6" stroke-width="3" marker-end="url(#arrow)"/>',
            text(800, 805, "浏览器不执行任意命令；所有状态变化都经过服务端领域校验", size=23, weight=600, fill="#365777", anchor="middle"),
            "</svg>",
        ]
    )
    return "\n".join(parts) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build editable Chinese requirement and architecture diagrams for B01-B20")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    expected: dict[Path, str] = {}
    for case in CASES:
        case_id = case[0]
        expected[OUTPUT / f"{case_id}-requirement.svg"] = requirement_svg(case)
        expected[OUTPUT / f"{case_id}-architecture.svg"] = architecture_svg(case)
    drift = [path for path, content in expected.items() if not path.is_file() or path.read_text(encoding="utf-8") != content]
    if args.check:
        if drift:
            print("CASE DIAGRAMS FAILED")
            for path in drift:
                print(f"- stale or missing: {path.relative_to(ROOT).as_posix()}")
            return 1
    else:
        for path, content in expected.items():
            path.write_text(content, encoding="utf-8")
    print(f"CASE DIAGRAMS PASSED cases={len(CASES)} svgs={len(expected)} mode={'check' if args.check else 'build'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
