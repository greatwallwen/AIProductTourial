from __future__ import annotations

import importlib.util
import csv
import hashlib
import json
from pathlib import Path
import zipfile

import pytest


MODULE_PATH = Path(__file__).with_name("build_demo_expansion.py")


def load_builder():
    assert MODULE_PATH.is_file(), "demo expansion generator module is missing"
    spec = importlib.util.spec_from_file_location("build_demo_expansion", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def require_builder_function(name: str):
    module = load_builder()
    function = getattr(module, name, None)
    assert callable(function), f"generator contract {name} is missing"
    return function


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def test_fixed_row_selection_is_ordered_and_rejects_short_input() -> None:
    fixed_row_selection = require_builder_function("fixed_row_selection")
    rows = [{"row": str(index)} for index in range(1, 7)]

    assert fixed_row_selection(rows, start=2, count=3) == [
        {"row": "3"},
        {"row": "4"},
        {"row": "5"},
    ]
    with pytest.raises(ValueError, match="requested 3 rows from offset 5"):
        fixed_row_selection(rows, start=5, count=3)


def test_source_and_derived_fields_must_be_disjoint() -> None:
    assert_disjoint_fields = require_builder_function("assert_disjoint_fields")

    assert_disjoint_fields(["source_value"], ["review_state"])
    with pytest.raises(ValueError, match="source_value"):
        assert_disjoint_fields(["source_value"], ["source_value", "review_state"])


def test_case13_keeps_public_reference_and_china_intake_unlinked() -> None:
    build_case13_layers = require_builder_function("build_case13_layers")
    public_rows = [
        {
            "客户ID": "1",
            "城市": "Ananthapuram",
            "州": "Andhra Pradesh",
            "服务历史": "Oil Change",
            "常见问题": "Brake noise",
            "解决方案": "Brake pad inspection",
            "车辆品牌": "Maruti Suzuki",
        },
        {
            "客户ID": "2",
            "城市": "Bengaluru",
            "州": "Karnataka",
            "服务历史": "Tire Rotation",
            "常见问题": "Engine overheating",
            "解决方案": "Cooling system inspection",
            "车辆品牌": "Hyundai",
        },
    ]

    intake_rows, reference_rows = build_case13_layers(public_rows, intake_count=3)

    assert len(reference_rows) == 2
    assert len(intake_rows) == 3
    assert {row["data_nature"] for row in reference_rows} == {"public-reference"}
    assert {row["data_nature"] for row in intake_rows} == {
        "deterministic-synthetic-cn-operations"
    }
    assert all(row["row_level_link_to_reference"] == "False" for row in intake_rows)
    assert not ({"reference_id", "客户ID", "customer_id"} & set(intake_rows[0]))


def test_case15_declares_official_uci_secom_cc_by_4() -> None:
    secom_source_contract = require_builder_function("secom_source_contract")

    contract = secom_source_contract()

    assert contract["id"] == "DATA-15"
    assert contract["publisher"] == "UCI Machine Learning Repository"
    assert contract["dataset_id"] == 179
    assert contract["doi"] == "10.24432/C54305"
    assert contract["license"] == "CC BY 4.0"
    assert contract["download_url"] == "https://archive.ics.uci.edu/static/public/179/secom.zip"


def test_case16_aggregation_keeps_every_turbine_for_every_selected_day() -> None:
    aggregate_case16 = require_builder_function("aggregate_case16")
    locations = [
        {"TurbID": "1", "x": "10", "y": "20"},
        {"TurbID": "2", "x": "30", "y": "40"},
    ]
    rows = [
        {
            "TurbID": turbine,
            "Day": day,
            "Wspd": str(4 + index),
            "Patv": str(100 + index),
            "is_underperforming": str(index % 2),
        }
        for turbine in ("1", "2")
        for day in ("1", "2")
        for index in range(2)
    ]

    result = aggregate_case16(rows, locations, selected_days=(1, 2))

    assert {(row["turbine_id"], row["day"]) for row in result} == {
        ("1", "1"),
        ("1", "2"),
        ("2", "1"),
        ("2", "2"),
    }
    assert all(row["manual_inspection_only"] == "True" for row in result)


def test_case16_aggregation_rejects_incomplete_entity_day_grid() -> None:
    aggregate_case16 = require_builder_function("aggregate_case16")
    locations = [
        {"TurbID": "1", "x": "10", "y": "20"},
        {"TurbID": "2", "x": "30", "y": "40"},
    ]
    rows = [
        {"TurbID": "1", "Day": "1", "Wspd": "4", "Patv": "100", "is_underperforming": "0"},
        {"TurbID": "2", "Day": "1", "Wspd": "5", "Patv": "110", "is_underperforming": "0"},
        {"TurbID": "1", "Day": "2", "Wspd": "6", "Patv": "120", "is_underperforming": "1"},
    ]

    with pytest.raises(ValueError, match="missing turbine/day groups: 2/2"):
        aggregate_case16(rows, locations, selected_days=(1, 2))


def test_case20_aggregation_keeps_every_station_for_every_observed_day() -> None:
    aggregate_case20 = require_builder_function("aggregate_case20")
    rows = [
        {
            "Time": f"2019-01-0{day} 12:{minute}:00",
            "station_id": station,
            "capacity_mw": "50",
            "Total solar irradiance (W/m2)": "500",
            "Air temperature": "25",
            "Power (MW)": str(10 + day),
            "eff_ratio": "0.4",
            "temp_derating_pct": "0.1",
            "is_curtailment_suspected": "0",
        }
        for station in ("1", "2")
        for day in (1, 2)
        for minute in ("00", "15")
    ]

    result = aggregate_case20(rows)

    assert {(row["station_id"], row["date"]) for row in result} == {
        ("1", "2019-01-01"),
        ("1", "2019-01-02"),
        ("2", "2019-01-01"),
        ("2", "2019-01-02"),
    }
    assert all(row["automatic_control_allowed"] == "False" for row in result)


def test_case20_aggregation_rejects_missing_expected_station() -> None:
    aggregate_case20 = require_builder_function("aggregate_case20")
    rows = [
        {
            "Time": "2019-01-01 12:00:00",
            "station_id": "1",
            "capacity_mw": "50",
            "Total solar irradiance (W/m2)": "500",
            "Air temperature": "25",
            "Power (MW)": "10",
            "eff_ratio": "0.4",
            "temp_derating_pct": "0.1",
            "is_curtailment_suspected": "0",
        },
        {
            "Time": "2019-01-02 12:00:00",
            "station_id": "1",
            "capacity_mw": "50",
            "Total solar irradiance (W/m2)": "500",
            "Air temperature": "25",
            "Power (MW)": "10",
            "eff_ratio": "0.4",
            "temp_derating_pct": "0.1",
            "is_curtailment_suspected": "0",
        },
        {
            "Time": "2019-01-01 12:00:00",
            "station_id": "2",
            "capacity_mw": "50",
            "Total solar irradiance (W/m2)": "500",
            "Air temperature": "25",
            "Power (MW)": "10",
            "eff_ratio": "0.4",
            "temp_derating_pct": "0.1",
            "is_curtailment_suspected": "0",
        },
    ]

    rows = [row for row in rows if row["station_id"] == "1"]
    with pytest.raises(ValueError, match="missing station entities: 2"):
        aggregate_case20(rows, expected_stations=("1", "2"))


def test_build_all_materializes_eight_contracts_with_receipts(tmp_path) -> None:
    build_all = require_builder_function("build_all")
    source_root = tmp_path / "source"
    output_root = tmp_path / "course"
    (output_root / "dataset").mkdir(parents=True)
    (output_root / "sources").mkdir(parents=True)
    (output_root / "dataset" / "manifest.json").write_text(
        json.dumps({"schema_version": "4.0", "datasets": []}), encoding="utf-8"
    )
    (output_root / "sources" / "source-ledger.json").write_text(
        json.dumps({"schema_version": "2.0", "sources": []}), encoding="utf-8"
    )

    case13 = source_root / "案例01_汽车售后服务辅助决策"
    write_csv(
        case13 / "vehicle_service_records.csv",
        ["客户ID", "城市", "州", "服务历史", "常见问题", "解决方案", "车辆品牌"],
        [{
            "客户ID": "1",
            "城市": "A",
            "州": "B",
            "服务历史": "Oil Change",
            "常见问题": "Brake noise",
            "解决方案": "Inspect brake pads",
            "车辆品牌": "Brand",
        }],
    )

    case14 = source_root / "案例02_精矿杂质提前干预"
    flotation_fields = [
        "监测小时",
        "源采样数",
        "数据完整性状态",
        "给矿铁品位均值",
        "给矿二氧化硅品位均值",
        "淀粉流量均值",
        "胺类捕收剂流量均值",
        "矿浆流量均值",
        "矿浆pH均值",
        "矿浆密度均值",
        *[f"{number}号浮选柱风量均值" for number in range(1, 8)],
        *[f"{number}号浮选柱液位均值" for number in range(1, 8)],
        "精矿铁品位均值",
        "精矿二氧化硅品位均值",
        "最近6小时精矿二氧化硅趋势",
        "质量状态",
        "连续高杂质小时数",
    ]
    write_csv(
        case14 / "flotation_hourly_zh.csv",
        flotation_fields,
        [
            {field: (f"2017-03-10 0{index}:00:00" if field == "监测小时" else "1") for field in flotation_fields}
            for index in (1, 2)
        ],
    )
    write_csv(
        case14 / "flotation_events_zh.csv",
        ["事件ID", "开始小时", "结束小时", "持续小时数", "峰值", "均值", "主要偏离变量", "恢复小时", "规则处置状态", "教学阈值"],
        [{
            "事件ID": "FQ-1",
            "开始小时": "2017-03-10 01:00:00",
            "结束小时": "2017-03-10 02:00:00",
            "持续小时数": "2",
            "峰值": "4",
            "均值": "3.5",
            "主要偏离变量": "淀粉流量",
            "恢复小时": "",
            "规则处置状态": "待复核",
            "教学阈值": "3",
        }],
    )

    secom_archive = tmp_path / "secom.zip"
    with zipfile.ZipFile(secom_archive, "w") as archive:
        archive.writestr("secom.data", "1 2 NaN\n2 4 8\n3 6 9\n4 8 10\n")
        archive.writestr(
            "secom_labels.data",
            '-1 "19/07/2008 11:55:00"\n1 "19/07/2008 12:32:00"\n-1 "19/07/2008 13:17:00"\n1 "19/07/2008 14:43:00"\n',
        )

    case16 = source_root / "案例04_风电机组出力下偏定位台"
    write_csv(
        case16 / "sdwpf_scada_80d.csv",
        ["TurbID", "Day", "Wspd", "Patv", "is_underperforming"],
        [
            {"TurbID": turbine, "Day": day, "Wspd": "5", "Patv": "100", "is_underperforming": "0"}
            for turbine in ("1", "2")
            for day in ("1", "2")
        ],
    )
    write_csv(
        case16 / "sdwpf_baidukddcup2022_turb_location.csv",
        ["TurbID", "x", "y"],
        [{"TurbID": "1", "x": "10", "y": "20"}, {"TurbID": "2", "x": "30", "y": "40"}],
    )

    case17 = source_root / "案例05_包装机切刀劣化复核" / "reference_data_analysis"
    session_fields = [
        "采样会话ID", "来源文件", "观测标签", "源批次序号", "源顺序", "运行模式", "源采样数",
        "切刀转矩均值", "切刀转矩标准差", "切刀转矩RMS", "切刀转矩绝对峰值",
        "切刀跟随误差均值", "切刀跟随误差标准差", "切刀跟随误差RMS", "切刀跟随误差绝对峰值",
        "薄膜跟随误差均值", "薄膜跟随误差标准差", "薄膜跟随误差RMS", "薄膜跟随误差绝对峰值",
        "健康偏离指数", "教学阈值", "证据覆盖状态", "主要偏离信号", "教学复核等级",
    ]
    write_csv(case17 / "blade_sessions_zh.csv", session_fields, [{field: "1" for field in session_fields}])
    queue_fields = ["复核序号", "采样会话ID", "观测标签", "运行模式", "健康偏离指数", "教学阈值", "主要偏离信号", "证据覆盖状态", "教学复核等级", "建议人工动作"]
    write_csv(case17 / "blade_review_queue_zh.csv", queue_fields, [{field: "1" for field in queue_fields}])
    signal_fields = ["采样会话ID", "来源文件", "观测标签", "源批次序号", "运行模式", "会话内采样序号", "会话内时间秒", "切刀电机转矩", "切刀位置跟随误差", "切刀实际位置", "切刀实际速度", "薄膜输送实际位置", "薄膜输送实际速度", "薄膜输送跟随误差", "主轴速度"]
    write_csv(case17 / "blade_signals_zh.csv", signal_fields, [{field: "1" for field in signal_fields}])

    case18 = source_root / "案例06_工业锅炉蒸汽温度持续偏离复核" / "reference_data_analysis"
    minute_fields = ["监测分钟", "有效采样数", "锅炉出口蒸汽温度均值", "锅炉出口蒸汽温度最小值", "锅炉出口蒸汽温度最大值", "锅炉出口蒸汽温度标准差", "温度状态", "连续偏离分钟数", "数据完整性", "近期趋势"]
    write_csv(case18 / "boiler_minutes_zh.csv", minute_fields, [{field: "1" for field in minute_fields}])
    event_fields = ["事件ID", "开始时间", "结束时间", "持续秒数", "方向", "最低温度", "最高温度", "源采样数", "恢复时间", "数据质量状态", "教学复核状态"]
    write_csv(case18 / "boiler_events_zh.csv", event_fields, [{field: "1" for field in event_fields}])
    sample_fields = ["采样时间", "一级减温水流量原始缺失", "一级减温水流量填补值", "填补来源"]
    write_csv(case18 / "boiler_samples_zh.csv", sample_fields, [{"采样时间": "t", "一级减温水流量原始缺失": "是", "一级减温水流量填补值": "2", "填补来源": "来源AutoReg"}])

    case19 = source_root / "案例07_液压系统状态监测" / "reference_data_analysis"
    hydraulic_fields = [
        "周期编号", "主油路压力_均值", "回油路压力_均值", "系统工作压力_均值", "电机功率_均值", "主回路流量_均值", "油箱油液温度_均值", "系统振动_均值",
        "板式冷却器_条件值", "板式冷却器_状态", "板式冷却器_严重度", "比例伺服阀_条件值", "比例伺服阀_状态", "比例伺服阀_严重度",
        "轴向柱塞泵_条件值", "轴向柱塞泵_状态", "轴向柱塞泵_严重度", "皮囊式蓄能器_条件值", "皮囊式蓄能器_状态", "皮囊式蓄能器_严重度",
        "稳定标志", "稳定标志_中文", "综合严重度", "综合严重度_中文", "故障组件数",
    ]
    write_csv(case19 / "液压系统状态监测_归一化.csv", hydraulic_fields, [{field: "1" for field in hydraulic_fields}])

    case20 = source_root / "案例08_辐照转化效率异常归因"
    pv_fields = ["Time", "Total solar irradiance (W/m2)", "Air temperature", "Power (MW)", "station_id", "capacity_mw", "eff_ratio", "temp_derating_pct", "is_curtailment_suspected"]
    write_csv(
        case20 / "stategrid_pv_8stations.csv",
        pv_fields,
        [
            {"Time": f"2019-01-0{day} 12:00:00", "Total solar irradiance (W/m2)": "500", "Air temperature": "25", "Power (MW)": "10", "station_id": station, "capacity_mw": "50", "eff_ratio": "0.4", "temp_derating_pct": "0.1", "is_curtailment_suspected": "0"}
            for station in tuple(str(index) for index in range(1, 9))
            for day in (1, 2)
        ],
    )

    items = build_all(
        source_root=source_root,
        output_root=output_root,
        secom_archive=secom_archive,
        case14_hours=2,
        case16_days=(1, 2),
        case17_waveform_sessions=1,
        case17_waveform_samples=1,
        case13_intakes=3,
    )

    assert [item["case_id"] for item in items] == [str(case_id) for case_id in range(13, 21)]
    manifest = json.loads((output_root / "dataset" / "manifest.json").read_text(encoding="utf-8"))
    assert [item["case_id"] for item in manifest["datasets"]] == [str(case_id) for case_id in range(13, 21)]
    for item in items:
        directory = output_root / item["directory"]
        assert {"case.csv", "README.md", "source.json", "schema.json", "eval.jsonl", "transform.py", "checksums.sha256"}.issubset(
            {path.name for path in directory.iterdir()}
        )
        source = json.loads((directory / "source.json").read_text(encoding="utf-8"))
        assert source["transform_status"] == "derived-verified"
        assert source["materialized_status"] == "verified"
        assert source["rebuild_status"] == "blocked_missing_inputs"
        source_fields = set(source["generation"]["field_lineage"]["source_facts"])
        derived_fields = set(source["generation"]["field_lineage"]["derived_fields"])
        assert source_fields.isdisjoint(derived_fields)
        checksums = {
            relative: expected
            for expected, relative in (
                line.split(None, 1)
                for line in (directory / "checksums.sha256").read_text(encoding="utf-8").splitlines()
                if line.strip()
            )
        }
        assert checksums["source.json"] == hashlib.sha256((directory / "source.json").read_bytes()).hexdigest()

        manifest_item = next(entry for entry in manifest["datasets"] if entry["case_id"] == item["case_id"])
        assert manifest_item["materialized_status"] == "verified"
        assert manifest_item["rebuild_status"] == "blocked_missing_inputs"

    case15_source = json.loads((output_root / "dataset" / "15-wafer-quality-review" / "source.json").read_text(encoding="utf-8"))
    assert case15_source["sources"][0]["license"] == "CC BY 4.0"
    assert case15_source["sources"][0]["publisher"] == "UCI Machine Learning Repository"
    assert not (output_root / "dataset" / "15-wafer-quality-review" / "raw").exists()


def test_csv_reader_strips_utf8_bom_from_source_header(tmp_path) -> None:
    read_source_csv = require_builder_function("read_csv")
    source = tmp_path / "locations.csv"
    source.write_bytes("TurbID,x,y\n1,10,20\n".encode("utf-8-sig"))

    assert read_source_csv(source) == [{"TurbID": "1", "x": "10", "y": "20"}]


def test_build_all_prevalidates_case_specific_required_inputs(tmp_path) -> None:
    build_all = require_builder_function("build_all")
    output_root = tmp_path / "course"

    with pytest.raises(ValueError, match="source_root is required"):
        build_all(
            source_root=None,
            output_root=output_root,
            secom_archive=None,
            selected_cases={"17"},
        )
    assert not output_root.exists()

    with pytest.raises(ValueError, match="secom_archive is required"):
        build_all(
            source_root=tmp_path,
            output_root=output_root,
            secom_archive=None,
            selected_cases={"15"},
        )
    assert not output_root.exists()


def test_cli_requires_only_inputs_used_by_selected_cases(tmp_path, monkeypatch, capsys) -> None:
    module = load_builder()
    calls = []

    def fake_build_all(**kwargs):
        calls.append(kwargs)
        return []

    monkeypatch.setattr(module, "build_all", fake_build_all)
    assert module.main(["--case", "17", "--source-root", str(tmp_path)]) == 0
    assert calls[-1]["secom_archive"] is None
    assert calls[-1]["selected_cases"] == {"17"}

    archive = tmp_path / "secom.zip"
    assert module.main(["--case", "15", "--secom-archive", str(archive)]) == 0
    assert calls[-1]["source_root"] is None
    assert calls[-1]["selected_cases"] == {"15"}

    with pytest.raises(SystemExit) as source_error:
        module.main(["--case", "17"])
    assert source_error.value.code == 2
    assert "--source-root is required when building cases other than 15" in capsys.readouterr().err

    with pytest.raises(SystemExit) as secom_error:
        module.main(["--case", "15"])
    assert secom_error.value.code == 2
    assert "--secom-archive is required when building case 15" in capsys.readouterr().err


def test_cli_help_does_not_require_build_inputs(capsys) -> None:
    module = load_builder()

    with pytest.raises(SystemExit) as help_exit:
        module.main(["--help"])

    assert help_exit.value.code == 0
    help_text = capsys.readouterr().out
    assert "--source-root" in help_text
    assert "--secom-archive" in help_text
