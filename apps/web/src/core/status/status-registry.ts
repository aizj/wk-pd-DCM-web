import { fr2StateFamilies, type StateFamilyName } from '@vrc/contracts';

export type StatusTone = 'default' | 'processing' | 'success' | 'warning' | 'error';

const success = new Set(['APPROVED', 'ACTIVE', 'AVAILABLE', 'READY', 'CURRENT', 'PASS', 'PASSED', 'COMPLETED', 'SUCCEEDED', 'SATISFIED', 'EXECUTABLE', 'PUBLISHED', 'RESOLVED', 'CLOSED', 'SET']);
const warning = new Set(['NEEDS_INFO', 'CONDITIONALLY_APPROVED', 'EXPIRING', 'PILOT', 'STALE', 'HAS_UNKNOWN', 'PARTIAL', 'PENDING_VERIFY', 'PAUSED', 'READY_FOR_TEST', 'ACKNOWLEDGED', 'WARNING', 'MISSING', 'WITHDRAWN', 'PAUSE_REQUESTED', 'RESUME_REQUESTED', 'STOP_REQUESTED', 'WAIVED']);
const error = new Set(['REJECTED', 'BLOCKED', 'FAILED', 'INVALIDATED', 'REVOKED', 'SUSPENDED', 'TERMINATED', 'TIMED_OUT', 'VIOLATED', 'UNKNOWN', 'HIGH', 'CRITICAL', 'INVALID', 'ABANDONED', 'REQUEST_EXPIRED']);
const processing = new Set(['SUBMITTED', 'IN_REVIEW', 'PENDING_APPROVAL', 'RUNNING', 'EVALUATING', 'EXECUTING', 'CALCULATING', 'ROLLING_BACK', 'IN_PROGRESS', 'IN_TEST', 'SCHEDULED', 'CREATED', 'REQUESTED']);

const statusLabels: Readonly<Record<string, string>> = {
  ACTIVE: '已开通',
  ACKNOWLEDGED: '已确认',
  AVAILABLE: '可申请',
  APPROVED: '已批准',
  BROKEN: '链路中断',
  BLOCKED: '未通过',
  CALCULATING: '计算中',
  CANCELLED: '已取消',
  COMPLETE: '完整',
  COMPLETED: '已完成',
  CONFIRMED: '已确认',
  CREATED: '已创建',
  CLOSED: '已关闭',
  CONDITION: '需满足条件',
  CONDITIONALLY_APPROVED: '附条件批准',
  CONFLICT: '存在冲突',
  CONTROLLED: '受控访问',
  CURRENT: '当前有效',
  DRAFT: '草稿',
  DEGRADED: '服务降级',
  ENABLED: '未暂停',
  EVALUATING: '评估中',
  EXECUTABLE: '可执行',
  EXECUTING: '执行中',
  EXPIRED: '已过期',
  EXPIRING: '即将到期',
  FAILED: '失败',
  CRITICAL: '严重',
  HAS_UNKNOWN: '存在未知项',
  HIGH: '高',
  INFO: '提示',
  INVALID: '校验不通过',
  IN_PROGRESS: '处理中',
  IN_REVIEW: '审批中',
  INCONCLUSIVE: '无法判定',
  INVALIDATED: '已作废',
  LOW: '低',
  MISSING: '待补充',
  MEDIUM: '中',
  NEEDS_INFO: '待补充',
  NOT_EVALUATED: '尚未评估',
  NOT_CONNECTED: '未接入',
  NOT_MONITORED: '尚无运行监测',
  NOT_REQUESTED: '尚未发布',
  NORMAL: '普通',
  OPEN: '待处理',
  PARTIAL: '部分完成',
  PASS: '通过',
  PASSED: '测试通过',
  PASS_WITH_CONDITIONS: '有条件通过',
  PAUSED: '已暂停',
  PILOT: '试点中',
  PENDING: '待处理',
  PENDING_APPROVAL: '待审批',
  PENDING_ACTIVATION: '待开通',
  PENDING_VERIFY: '待核验',
  PUBLISHED: '已发布',
  PLANNED: '待执行',
  NOT_STARTED: '未开始',
  READY_FOR_TEST: '待联合测试',
  IN_TEST: '联合测试中',
  QUEUED: '排队中',
  READY: '已就绪',
  REJECTED: '已拒绝',
  REQUESTED: '已申请',
  RETURNED: '已退回',
  REVOKED: '已撤销',
  ROLLING_BACK: '回退中',
  ROLLBACK_REQUIRED: '需要回退',
  ROLLED_BACK: '已回退',
  RESOLVED: '已恢复',
  RUNNING: '检查中',
  SATISFIED: '已满足',
  SET: '已配置',
  SCHEDULED: '已排期',
  STALE: '已失效',
  SUBMITTED: '已提交',
  SUSPENDED: '已暂停申请',
  SUCCEEDED: '成功',
  SUPERSEDED: '已被替代',
  STOPPED: '已终止',
  WITHDRAWN: '已撤回',
  ABANDONED: '已放弃',
  REQUEST_EXPIRED: '申请已过期',
  RECORDED: '已记录',
  TERMINATED: '已终止',
  TIMED_OUT: '已超时',
  UNKNOWN: '无法确认',
  VERIFIED: '已核验',
  VIOLATED: '未满足',
  WAIVED: '已豁免',
  WARNING: '警告',
  F0: '仅投递记录',
  F1: '已确认接收',
  F2: '已确认展示',
  F3: '已确认交互',
  HEALTHY: '运行正常',
};

export function statusTone(status: string): StatusTone {
  if (success.has(status)) return 'success';
  if (warning.has(status)) return 'warning';
  if (error.has(status)) return 'error';
  if (processing.has(status)) return 'processing';
  return 'default';
}

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

export function stateFamilyCount(): number {
  return Object.keys(fr2StateFamilies).length;
}

export function statesOf<T extends StateFamilyName>(family: T): (typeof fr2StateFamilies)[T] {
  return fr2StateFamilies[family];
}
