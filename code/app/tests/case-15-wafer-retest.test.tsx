// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { WaferRetestWorkbench } from "../src/components/workbenches/case-specific/WaferRetestWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sensorValues = { sensor_161:"759",sensor_159:"562",sensor_021:"-5447.75",sensor_024:"-1916.5",sensor_158:"",sensor_160:"788",sensor_294:"251.4536",sensor_162:"2100",sensor_296:"325.0672",sensor_295:"329.6406",sensor_022:"2701.75",sensor_090:"9317.1698" };
const rows = Array.from({ length: 4 }, (_, index) => ({ wafer_id:`SECOM-000${index+1}`,test_timestamp:`19/07/2008 13:${String(13+index*2).padStart(2,"0")}:00`,quality_label:index===2?"fail":"pass",review_priority:index===2?"quality-gate-review":"routine-review",...Object.fromEntries(Object.entries(sensorValues).map(([key,value])=>[key,value===""?"":String(Number(value)+index*2)])) }));
const objects: CaseProjection[] = rows.map((payload,index)=>({caseId:"15",objectId:`15-${payload.wafer_id}`,state:"待复核",version:0,payload,updatedAt:"2026-07-26T07:00:00.000Z"}));
const selected = objects[2];
const ranking = Object.keys(sensorValues).map((sensor_id,index)=>({sensor_id,missing_rows:sensor_id==="sensor_158"?"1429":sensor_id==="sensor_090"?"51":"2",rank:String(index+1)}));

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {definition:getCaseDefinition("15")!,objects,selected,events:[],metrics:[{id:"failed",label:"未通过观测",value:"104",note:"质量标签未通过"}],datasetRowCount:1567,sceneRows:rows,supportingArtifacts:{"sensor-ranking.csv":ranking},actorRole:"quality_engineer",roles:["quality_engineer","supervisor"],commands:[{id:"request_retest",label:"隔离记录并提交复测",tone:"primary"}],busy:false,onActorRoleChange:vi.fn(),onCommand:vi.fn(),onReset:vi.fn(),onSelect:vi.fn(),...overrides};
}

describe("WaferRetestWorkbench",()=>{
  it("renders the SECOM observation desk without inventing process identity",()=>{
    render(<WaferRetestWorkbench {...props()} />);
    expect(screen.getByRole("heading",{name:"半导体生产观测复测"})).toBeVisible();
    expect(screen.getByRole("complementary",{name:"演示观测队列"})).toBeVisible();
    expect(screen.getByRole("complementary",{name:"复测任务流程"})).toBeVisible();
    expect(screen.getByLabelText("当前通道证据")).toBeVisible();
    expect(screen.getByLabelText("通道覆盖矩阵")).toBeVisible();
    expect(screen.getByText("演示队列 4 / 数据集 1,567")).toBeVisible();
    expect(screen.getAllByText("8.8%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("覆盖率")).toBeVisible();
    expect(screen.getAllByText("1,567").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,429").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("关联排序不等于根因")).toBeVisible();
    expect(screen.getByText("不能自动报废或放行")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("相邻观测原值")).not.toBeInTheDocument();
  });

  it("filters observations, selects a row and toggles a retest channel",()=>{
    const onSelect=vi.fn(); render(<WaferRetestWorkbench {...props({onSelect})} />);
    fireEvent.click(screen.getByRole("button",{name:"通过"}));
    expect(screen.queryByRole("button",{name:/SECOM-0003/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/SECOM-0002/}));
    expect(onSelect).toHaveBeenCalledWith("15-SECOM-0002");
    const channel=screen.getByRole("button",{name:/将 sensor_021 列入复测/});
    expect(channel).not.toHaveAttribute("aria-pressed","true");
    fireEvent.click(channel); expect(channel).toHaveAttribute("aria-pressed","true");
  });

  it("requires the review checklist and submits a structured retest request",()=>{
    const onCommand=vi.fn(); render(<WaferRetestWorkbench {...props({onCommand})} />);
    const submit=screen.getByRole("button",{name:"隔离记录并提交复测"}); expect(submit).toBeDisabled();
    for(const name of ["保留原始记录与质量标签","核对缺失通道与全局缺失量","确认复测结果仍需人工复核"]) fireEvent.click(screen.getByRole("checkbox",{name}));
    fireEvent.change(screen.getByLabelText("复测说明"),{target:{value:"复测 sensor_158 缺失并保留原始质量标签"}});
    expect(submit).toBeEnabled(); fireEvent.click(submit);
    expect(onCommand).toHaveBeenCalledTimes(1); expect(onCommand.mock.calls[0][0]).toBe("request_retest");
    expect(JSON.parse(String(onCommand.mock.calls[0][1]).replace("wafer-retest:",""))).toEqual({channels:["sensor_158"],checks:{preserve:true,missing:true,manual:true},note:"复测 sensor_158 缺失并保留原始质量标签"});
  });

  it("restores the retest draft, changes role and offers focused recovery",()=>{
    const event={eventId:"evt-15",caseId:"15",objectId:selected.objectId,command:"request_retest",fromState:"待复核",toState:"复测申请已提交",actor:{id:"quality_engineer",role:"quality_engineer"},version:1,occurredAt:"2026-07-26T07:05:00.000Z",reason:'wafer-retest:{"channels":["sensor_158","sensor_090"],"checks":{"preserve":true,"missing":true,"manual":true},"note":"复测缺失通道"}',evidenceIds:[]} satisfies CaseEvent;
    const onActorRoleChange=vi.fn(); const onSelect=vi.fn(); render(<WaferRetestWorkbench {...props({events:[event],error:"对象状态已更新，请刷新后重试。",onActorRoleChange,onSelect})} />);
    expect(screen.getByLabelText("复测说明")).toHaveValue("复测缺失通道");
    expect(screen.getByRole("button",{name:/从复测中移除 sensor_090/})).toHaveAttribute("aria-pressed","true");
    fireEvent.change(screen.getByLabelText("当前操作角色"),{target:{value:"supervisor"}}); expect(onActorRoleChange).toHaveBeenCalledWith("supervisor");
    fireEvent.click(screen.getByRole("button",{name:"刷新当前观测"})); expect(onSelect).toHaveBeenCalledWith(selected.objectId);
  });

  it("keeps server and client markup deterministic",()=>{
    const source=readFileSync(resolve(process.cwd(),"src/components/workbenches/case-specific/WaferRetestWorkbench.tsx"),"utf8");
    expect(source).not.toContain("Date.now(");expect(source).not.toContain("Math.random(");expect(source).not.toContain("typeof window");expect(source).not.toContain("new Date(");
  });
});
