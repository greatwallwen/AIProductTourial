import type { Db } from '../../shared/db.ts';
import { withTransaction } from '../../shared/db.ts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogService } from '../catalog/index.ts';
import type { NotifyService } from '../notify/index.ts';
import { createApplicationRepo } from './repo.ts';
import type { Action, Status, SubmissionInput } from './types.ts';

/**
 * 状态机是一等公民数据结构：合法迁移只在这张表里。
 * 边名与接口 action、状态机 SVG 图逐字一致（图码同源）。
 */
export const TRANSITIONS: Record<Action, { from: Status; to: Status }> = {
  accept: { from: 'submitted', to: 'accepted' },
  reject_accept: { from: 'submitted', to: 'not_accepted' },
  request_supplement: { from: 'accepted', to: 'supplementing' },
  resubmit: { from: 'supplementing', to: 'accepted' },
  start_review: { from: 'accepted', to: 'in_review' },
  approve: { from: 'in_review', to: 'approved' },
  deny: { from: 'in_review', to: 'denied' },
  conclude: { from: 'approved', to: 'concluded' },
};

export function allowedActionsFrom(status: Status): Action[] {
  return (Object.keys(TRANSITIONS) as Action[]).filter((a) => TRANSITIONS[a].from === status);
}

export function createApplicationService(deps: {
  db: Db;
  catalog: CatalogService;
  divisionCode: string;
  notify?: NotifyService;
}) {
  const repo = createApplicationRepo(deps.db);

  return {
    /** 申报：材料齐全性校验是数据驱动的——规则在事项配置里，不在代码里 */
    submit(input: SubmissionInput) {
      const item = deps.catalog.getByCode(input.itemCode);
      const provided = new Set(input.materials.map((m) => m.materialName));
      const missing = item.requiredMaterials.filter((name) => !provided.has(name));
      if (missing.length > 0) {
        throw new AppError('MATERIALS_MISSING', 400, `缺少必备材料 ${missing.length} 项`, { missing });
      }
      return withTransaction(deps.db, () => {
        const applyNo = repo.nextApplyNo(deps.divisionCode);
        const id = repo.insertApplication({
          applyNo,
          itemId: item.id,
          applicantName: input.applicantName,
          applicantIdNo: input.applicantIdNo,
          applicantPhone: input.applicantPhone,
          submittedAt: new Date().toISOString(),
        });
        for (const m of input.materials) {
          repo.insertMaterial(id, m.materialName, m.fileRef);
        }
        repo.insertLog({
          applicationId: id,
          action: 'submit',
          fromStatus: '-',
          toStatus: 'submitted',
          operator: input.applicantName,
        });
        return { applyNo, status: 'submitted' as const };
      });
    },

    /** 流转：非法迁移拒绝并告知当前状态下允许的动作 */
    act(applyNo: string, input: { action: Action; operator: string; opinion?: string }) {
      const record = repo.getByApplyNo(applyNo);
      if (!record) throw new AppError('APPLICATION_NOT_FOUND', 404, `申报单不存在：${applyNo}`);

      const transition = TRANSITIONS[input.action];
      const current = record.status as Status;
      if (transition.from !== current) {
        throw new AppError('ILLEGAL_TRANSITION', 409, `当前状态 ${current} 不允许动作 ${input.action}`, {
          currentStatus: current,
          allowedActions: allowedActionsFrom(current),
        });
      }

      const now = new Date().toISOString();
      const patch: { acceptedAt?: string; concludedAt?: string; licenceNo?: string } = {};
      if (input.action === 'accept') patch.acceptedAt = now;
      if (input.action === 'conclude') {
        patch.concludedAt = now;
        patch.licenceNo = `XK-${applyNo}`; // 演示格式；真实证照编号规则见教程 2.3 节
      }

      withTransaction(deps.db, () => {
        const changed = repo.updateStatus(record.id, current, transition.to, patch);
        if (changed === 0) {
          // 状态在读判与写入之间被并发改动：命中 0 行，拒绝而非静默覆盖
          throw new AppError('CONCURRENT_MODIFICATION', 409, `申报单 ${applyNo} 已被并发修改，请重试`, {
            expectedStatus: current,
          });
        }
        repo.insertLog({
          applicationId: record.id,
          action: input.action,
          fromStatus: current,
          toStatus: transition.to,
          operator: input.operator,
          opinion: input.opinion,
        });
        // 办结即入队短信通知：与状态流转同一事务写出站表，发送交给定时投递（notify 模块）
        if (input.action === 'conclude' && deps.notify) {
          deps.notify.enqueue({
            applicationId: record.id,
            channel: 'sms',
            recipient: record.applicant_phone,
            payload: `您申报的"${record.item_name}"已办结，证照编号 ${patch.licenceNo}，请及时领取。`,
          });
        }
      });
      return { applyNo, status: transition.to };
    },

    detail(applyNo: string) {
      const record = repo.getByApplyNo(applyNo);
      if (!record) throw new AppError('APPLICATION_NOT_FOUND', 404, `申报单不存在：${applyNo}`);
      return {
        applyNo: record.apply_no,
        itemName: record.item_name,
        applicantName: record.applicant_name,
        applicantIdNo: record.applicant_id_no,
        status: record.status as Status,
        submittedAt: record.submitted_at,
        acceptedAt: record.accepted_at,
        concludedAt: record.concluded_at,
        licenceNo: record.licence_no,
        promiseDays: record.promise_days,
        materials: repo.listMaterials(record.id),
        logs: repo.listLogs(record.id),
      };
    },

    list(filter: { status?: string; overdue?: boolean }) {
      return repo.list(filter);
    },
  };
}

export type ApplicationService = ReturnType<typeof createApplicationService>;
