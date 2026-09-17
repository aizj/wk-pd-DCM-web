import type { ActorContext } from '@vrc/contracts';

/**
 * 本地验收用的数据上下文。真实环境应由服务端根据 IAM 会话执行租户、环境和数据范围过滤；这里仅让本地模拟与界面切换保持一致。
 */
let currentContext: ActorContext | null = null;

export function setDataScopeContext(actor: ActorContext | null): void {
  currentContext = actor;
}

export function getDataScopeContext(): ActorContext | null {
  return currentContext;
}

export function hasEnvironmentScope(actor: ActorContext, environment: ActorContext['environment']): boolean {
  return actor.scopes.some((scope) => scope === 'ENV:*' || scope === `ENV:${environment}`);
}

/** 按平台租户编码和车企名称进行本地的可见性判断。 */
export function isTenantVisible(actor: ActorContext, tenantId?: string, oemName?: string): boolean {
  if (tenantId) return tenantId === actor.tenantId || actor.scopes.some((scope) => scope === 'TENANT:*' || (scope === 'CITY:*' && tenantId.startsWith('CITY-')));
  if (!oemName) return true;
  if (actor.tenantId === 'OEM-QILU') return oemName?.includes('齐鲁智行') ?? false;
  return actor.tenantId.startsWith('CITY-');
}

type ScopedRecord = { environment?: ActorContext['environment']; oemName?: string; tenantId?: string };

export function isRecordVisible<T>(record: T): boolean {
  const actor = currentContext;
  if (!actor) return true;
  const scoped = record as T & ScopedRecord;
  // 工作环境是会话级数据边界：即使账号同时获准多个环境，当前页面也只读取当前选中的环境。
  if (scoped.environment && (scoped.environment !== actor.environment || !hasEnvironmentScope(actor, scoped.environment))) return false;
  return isTenantVisible(actor, scoped.tenantId, scoped.oemName);
}

export function filterScoped<T>(records: readonly T[]): T[] {
  return records.filter(isRecordVisible);
}

export function anyEnvironmentVisible(environments: readonly ActorContext['environment'][]): boolean {
  const actor = currentContext;
  return !actor || (environments.includes(actor.environment) && hasEnvironmentScope(actor, actor.environment));
}
