import type {
  ActorContext,
  AuthorizationResource,
  PermissionCode,
  PermissionDefinition,
  RoleCode,
  RoleDefinition,
} from '@vrc/contracts';

export interface AuthorizationInput {
  permission: PermissionCode;
  requiredScope?: string;
  requiredScopes?: readonly string[];
  requiredEnvironment?: ActorContext['environment'];
  resource?: AuthorizationResource;
  objectStateAllowed?: boolean;
  separationOfDutiesPassed?: boolean;
  subjectActorId?: string;
  prohibitSelfAction?: boolean;
  auditReason?: string;
  auditReasonRequired?: boolean;
}

export type AuthorizationReason =
  | 'ALLOWED'
  | 'MISSING_PERMISSION'
  | 'OUT_OF_SCOPE'
  | 'TENANT_MISMATCH'
  | 'ENVIRONMENT_MISMATCH'
  | 'INVALID_OBJECT_STATE'
  | 'SOD_CONFLICT'
  | 'SELF_ACTION'
  | 'AUDIT_REASON_REQUIRED';

export interface AuthorizationDecision {
  allowed: boolean;
  reason: AuthorizationReason;
}

const permissionDefinitions: readonly PermissionDefinition[] = [
  { code: 'FR1.CATALOG.READ', label: '查看服务目录', module: '服务与授权', action: '查看', risk: 'LOW', description: '查看可提供的数据上车服务及接入条件。' },
  { code: 'FR1.ENTITLEMENT.READ', label: '查看权益与授权', module: '服务与授权', action: '查看', risk: 'MEDIUM', description: '查看企业、车型、环境和覆盖范围授权。' },
  { code: 'FR2.REQUEST.READ', label: '查看订阅申请', module: '订阅申请', action: '查看', risk: 'LOW', description: '查看申请版本和办理状态。' },
  { code: 'FR2.REQUEST.CREATE', label: '创建订阅申请', module: '订阅申请', action: '创建', risk: 'MEDIUM', description: '创建新的订阅申请草稿。' },
  { code: 'FR2.REQUEST.EDIT', label: '编辑订阅申请', module: '订阅申请', action: '编辑', risk: 'MEDIUM', description: '修改尚未提交的申请版本。' },
  { code: 'FR2.REQUEST.SUBMIT', label: '提交订阅申请', module: '订阅申请', action: '提交', risk: 'HIGH', description: '提交申请并进入准入及审批流程。' },
  { code: 'FR2.PRECHECK.READ', label: '查看准入检查', module: '订阅申请', action: '查看', risk: 'LOW', description: '查看准入检查分层结论和检查项。' },
  { code: 'FR2.PRECHECK.EXECUTE', label: '执行准入检查', module: '订阅申请', action: '执行', risk: 'HIGH', description: '发起或重跑订阅准入检查。' },
  { code: 'FR2.PRECHECK.REMEDIATE', label: '处理准入补正', module: '订阅申请', action: '补正', risk: 'HIGH', description: '提交补正材料并申请重新检查，不能直接改写检查结果。' },
  { code: 'FR2.APPROVAL.READ', label: '查看审批处理', module: '订阅申请', action: '查看', risk: 'LOW', description: '查看审批单、会签链和处理上下文。' },
  { code: 'FR2.APPROVAL.DECIDE', label: '作出审批决定', module: '订阅申请', action: '决定', risk: 'CRITICAL', description: '批准、附条件批准、退回或拒绝申请。' },
  { code: 'FR2.SUBSCRIPTION.READ', label: '查看订阅实例', module: '订阅运营', action: '查看', risk: 'LOW', description: '查看订阅及原子实例状态。' },
  { code: 'FR2.SUBSCRIPTION.CHANGE', label: '发起订阅变更', module: '订阅运营', action: '变更', risk: 'HIGH', description: '发起范围、期限或版本变更。' },
  { code: 'FR2.CONTROL.PLAN', label: '制定控制计划', module: '订阅运营', action: '计划', risk: 'HIGH', description: '制定暂停、恢复或终止计划。' },
  { code: 'FR2.CONTROL.PAUSE', label: '暂停订阅', module: '订阅运营', action: '暂停', risk: 'CRITICAL', description: '执行订阅暂停意图。' },
  { code: 'FR2.CONTROL.RESUME', label: '恢复订阅', module: '订阅运营', action: '恢复', risk: 'CRITICAL', description: '执行订阅恢复意图。' },
  { code: 'FR2.CONTROL.TERMINATE', label: '终止订阅', module: '订阅运营', action: '终止', risk: 'CRITICAL', description: '执行订阅终止意图。' },
  { code: 'FR2.DIAGNOSIS.READ', label: '查看运行诊断', module: '订阅运营', action: '查看', risk: 'LOW', description: '跨模块汇总订阅实例的交付链路事实。' },
  { code: 'FR2.AUDIT.READ', label: '查看业务审计', module: '安全与审计', action: '查看', risk: 'MEDIUM', description: '查看受保护的业务操作审计记录。' },
  { code: 'FR2.WORKBENCH.READ', label: '查看运营工作台', module: '运营工作台', action: '查看', risk: 'LOW', description: '查看当前账号可处理的运营事项。' },
  { code: 'FR3.CONFIGURATION.READ', label: '查看参数配置', module: '参数配置', action: '查看', risk: 'LOW', description: '查看配置版本及待补参数。' },
  { code: 'FR3.CONFIGURATION.REQUEST', label: '申请配置变更', module: '参数配置', action: '申请', risk: 'HIGH', description: '提交参数配置新建、调整或回退申请，审批和重测通过后才可能生效。' },
  { code: 'FR3.CONFIGURATION.EDIT', label: '编辑参数配置', module: '参数配置', action: '编辑', risk: 'HIGH', description: '编辑订阅实例配置参数。' },
  { code: 'FR3.CONFIGURATION.VALIDATE', label: '校验参数配置', module: '参数配置', action: '校验', risk: 'HIGH', description: '执行配置完整性和规则校验。' },
  { code: 'FR3.CONFIGURATION.PUBLISH', label: '发布参数配置', module: '参数配置', action: '发布', risk: 'CRITICAL', description: '提交配置版本进入发布链路。' },
  { code: 'FR4.QUALIFICATION.READ', label: '查看联合测试', module: '测试与发布', action: '查看', risk: 'LOW', description: '查看测试任务和用例进度。' },
  { code: 'FR4.QUALIFICATION.EXECUTE', label: '执行联合测试', module: '测试与发布', action: '执行', risk: 'HIGH', description: '发起或重跑联合测试。' },
  { code: 'FR4.RELEASE.READ', label: '查看服务发布', module: '测试与发布', action: '查看', risk: 'LOW', description: '查看发布计划和节点进度。' },
  { code: 'FR4.RELEASE.EXECUTE', label: '执行服务发布', module: '测试与发布', action: '执行', risk: 'CRITICAL', description: '执行灰度或全量发布计划。' },
  { code: 'FR5.EVIDENCE.READ', label: '查看交付证据', module: '运行监控', action: '查看', risk: 'LOW', description: '查看投递、接收、展示和交互证据。' },
  { code: 'FR5.EVIDENCE.EXPORT', label: '导出交付证据', module: '运行监控', action: '导出', risk: 'MEDIUM', description: '导出经过授权范围过滤的交付证据。' },
  { code: 'FR5.INCIDENT.READ', label: '查看事件与工单', module: '运行监控', action: '查看', risk: 'LOW', description: '查看事件事实、严重度和处理状态。' },
  { code: 'FR5.INCIDENT.UPDATE', label: '更新事件与工单', module: '运行监控', action: '更新', risk: 'HIGH', description: '确认、转派或更新事件处理状态。' },
  { code: 'GOVERNANCE.PERMISSION.READ', label: '查看权限策略', module: '安全与审计', action: '查看', risk: 'MEDIUM', description: '查看权限码、角色和有效授权。' },
  { code: 'GOVERNANCE.PERMISSION.SIMULATE', label: '模拟权限决策', module: '安全与审计', action: '模拟', risk: 'MEDIUM', description: '使用预设条件验证权限策略结果。' },
  { code: 'GOVERNANCE.ROLE.READ', label: '查看角色', module: '安全与审计', action: '查看', risk: 'MEDIUM', description: '查看角色定义和职责边界。' },
  { code: 'GOVERNANCE.ROLE.REQUEST', label: '申请权限变更', module: '安全与审计', action: '申请', risk: 'HIGH', description: '提交角色授权、范围或期限变更申请，待审批通过后才可能生效。' },
  { code: 'GOVERNANCE.ROLE.MANAGE', label: '管理角色授权', module: '安全与审计', action: '管理', risk: 'CRITICAL', description: '新增、调整或撤销角色授权。' },
  { code: 'GOVERNANCE.ROLE.CONFIGURE', label: '配置角色权限', module: '安全与审计', action: '配置', risk: 'CRITICAL', description: '编辑角色模板中的功能权限映射，提交草稿并进入审批发布。' },
  { code: 'GOVERNANCE.ACCESS_REVIEW.READ', label: '查看访问复核', module: '安全与审计', action: '查看', risk: 'MEDIUM', description: '查看身份、角色、资源和数据分类的定期访问复核。' },
  { code: 'GOVERNANCE.ACCESS_REVIEW.REQUEST', label: '发起访问复核', module: '安全与审计', action: '复核', risk: 'HIGH', description: '提交保留、收窄或撤销访问权限的复核结论。' },
  { code: 'GOVERNANCE.INTEGRATION.READ', label: '查看对接状态', module: '安全与审计', action: '查看', risk: 'LOW', description: '查看平台、车企、车端和审计系统的数据域接入状态。' },
  { code: 'FR6.PARTNER.READ', label: '查看租户与接入', module: '平台治理', action: '查看', risk: 'LOW', description: '查看合作方、租户、ApplicationClient、环境和接入状态。' },
  { code: 'FR6.PARTNER.REQUEST', label: '申请合作方接入', module: '平台治理', action: '申请', risk: 'HIGH', description: '提交合作方、应用或环境准入申请，进入平台治理审核。' },
  { code: 'FR6.PARTNER.MANAGE', label: '管理租户与应用', module: '平台治理', action: '管理', risk: 'CRITICAL', description: '维护合作方、应用、端点、凭证引用和环境准入状态。' },
];

const roleDefinitions: readonly RoleDefinition[] = [
  { code: 'PLATFORM_ADMIN', label: '平台管理员', description: '维护平台级角色、权限和策略，不直接代办业务审批。', permissionCodes: permissionDefinitions.map((item) => item.code), defaultScopes: ['CITY:*', 'ENV:*'], separationOfDutiesGroup: 'ADMIN' },
  { code: 'SUBSCRIPTION_OPERATOR', label: '订阅运营', description: '办理申请、订阅、配置和运行问题，可发起配置及权限变更申请，不作审批决定。', permissionCodes: ['FR1.CATALOG.READ', 'FR1.ENTITLEMENT.READ', 'FR2.REQUEST.READ', 'FR2.REQUEST.CREATE', 'FR2.REQUEST.EDIT', 'FR2.REQUEST.SUBMIT', 'FR2.PRECHECK.READ', 'FR2.PRECHECK.REMEDIATE', 'FR2.SUBSCRIPTION.READ', 'FR2.SUBSCRIPTION.CHANGE', 'FR2.CONTROL.PLAN', 'FR2.DIAGNOSIS.READ', 'FR2.WORKBENCH.READ', 'FR3.CONFIGURATION.READ', 'FR3.CONFIGURATION.REQUEST', 'FR4.QUALIFICATION.READ', 'FR4.RELEASE.READ', 'FR5.EVIDENCE.READ', 'FR5.INCIDENT.READ', 'GOVERNANCE.PERMISSION.READ', 'GOVERNANCE.ACCESS_REVIEW.READ', 'GOVERNANCE.ROLE.REQUEST', 'GOVERNANCE.INTEGRATION.READ', 'FR6.PARTNER.READ'], defaultScopes: ['CITY:{city}', 'ENV:SANDBOX', 'FR1:*', 'FR2:*', 'FR3:*', 'FR4:*', 'FR5:*'], separationOfDutiesGroup: 'OPERATIONS' },
  { code: 'APPROVER', label: '审批人', description: '独立处理审批决定，不能审批自己发起或参与的申请。', permissionCodes: ['FR1.ENTITLEMENT.READ', 'FR2.REQUEST.READ', 'FR2.PRECHECK.READ', 'FR2.APPROVAL.READ', 'FR2.APPROVAL.DECIDE', 'FR2.SUBSCRIPTION.READ', 'FR2.AUDIT.READ', 'GOVERNANCE.PERMISSION.READ', 'GOVERNANCE.ACCESS_REVIEW.READ', 'FR6.PARTNER.READ'], defaultScopes: ['CITY:{city}', 'ENV:SANDBOX', 'FR2:APPROVAL'], separationOfDutiesGroup: 'APPROVAL' },
  { code: 'OEM_INTEGRATION', label: '车企接入方', description: '维护本企业申请、接入和测试资料，可发起本企业配置及授权变更申请。', permissionCodes: ['FR1.CATALOG.READ', 'FR1.ENTITLEMENT.READ', 'FR2.REQUEST.READ', 'FR2.REQUEST.CREATE', 'FR2.REQUEST.EDIT', 'FR2.REQUEST.SUBMIT', 'FR2.PRECHECK.READ', 'FR2.PRECHECK.REMEDIATE', 'FR2.SUBSCRIPTION.READ', 'FR2.DIAGNOSIS.READ', 'FR3.CONFIGURATION.READ', 'FR3.CONFIGURATION.REQUEST', 'FR4.QUALIFICATION.READ', 'FR4.RELEASE.READ', 'FR5.EVIDENCE.READ', 'FR5.INCIDENT.READ', 'GOVERNANCE.ROLE.REQUEST', 'GOVERNANCE.ACCESS_REVIEW.READ', 'FR6.PARTNER.READ', 'FR6.PARTNER.REQUEST'], defaultScopes: ['TENANT:{tenantId}', 'ENV:SANDBOX'], separationOfDutiesGroup: 'OEM' },
  { code: 'TEST_OPERATOR', label: '测试发布员', description: '执行联合测试和发布操作，不负责订阅审批。', permissionCodes: ['FR1.CATALOG.READ', 'FR2.SUBSCRIPTION.READ', 'FR2.DIAGNOSIS.READ', 'FR3.CONFIGURATION.READ', 'FR3.CONFIGURATION.VALIDATE', 'FR4.QUALIFICATION.READ', 'FR4.QUALIFICATION.EXECUTE', 'FR4.RELEASE.READ', 'FR4.RELEASE.EXECUTE', 'FR5.EVIDENCE.READ', 'FR5.INCIDENT.READ', 'FR5.INCIDENT.UPDATE', 'GOVERNANCE.ACCESS_REVIEW.READ', 'FR6.PARTNER.READ'], defaultScopes: ['CITY:{city}', 'ENV:SANDBOX', 'ENV:TEST', 'FR3:*', 'FR4:*'], separationOfDutiesGroup: 'TEST' },
  { code: 'AUDITOR', label: '审计员', description: '查看权限和业务审计事实，不执行任何业务写操作。', permissionCodes: ['FR1.CATALOG.READ', 'FR1.ENTITLEMENT.READ', 'FR2.REQUEST.READ', 'FR2.PRECHECK.READ', 'FR2.APPROVAL.READ', 'FR2.SUBSCRIPTION.READ', 'FR2.DIAGNOSIS.READ', 'FR2.AUDIT.READ', 'FR3.CONFIGURATION.READ', 'FR4.QUALIFICATION.READ', 'FR4.RELEASE.READ', 'FR5.EVIDENCE.READ', 'FR5.INCIDENT.READ', 'GOVERNANCE.PERMISSION.READ', 'GOVERNANCE.PERMISSION.SIMULATE', 'GOVERNANCE.ROLE.READ', 'GOVERNANCE.ACCESS_REVIEW.READ', 'GOVERNANCE.INTEGRATION.READ', 'FR6.PARTNER.READ'], defaultScopes: ['CITY:*', 'ENV:*'], separationOfDutiesGroup: 'AUDIT' },
];

export const permissionCatalog = permissionDefinitions;
export const roleCatalog = roleDefinitions;

const permissionByCode = new Map(permissionDefinitions.map((item) => [item.code, item]));
const roleByCode = new Map(roleDefinitions.map((item) => [item.code, item]));

export function getPermissionDefinition(code: PermissionCode): PermissionDefinition | undefined {
  return permissionByCode.get(code);
}

export function getRoleDefinition(code: RoleCode): RoleDefinition | undefined {
  return roleByCode.get(code);
}

export function effectivePermissions(actor: ActorContext): ReadonlySet<PermissionCode> {
  const permissions = new Set<PermissionCode>(actor.permissions);
  actor.roles.forEach((role) => roleByCode.get(role)?.permissionCodes.forEach((permission) => permissions.add(permission)));
  return permissions;
}

export function scopeMatches(granted: string, required: string): boolean {
  if (granted === '*' || granted === required) return true;
  if (granted.endsWith('*')) return required.startsWith(granted.slice(0, -1));
  if (required.endsWith('*')) return granted.startsWith(required.slice(0, -1));
  return false;
}

function actorHasScope(actor: ActorContext, required: string): boolean {
  return actor.scopes.some((scope) => scopeMatches(scope, required));
}

export function authorize(actor: ActorContext, input: AuthorizationInput): AuthorizationDecision {
  if (!effectivePermissions(actor).has(input.permission)) return { allowed: false, reason: 'MISSING_PERMISSION' };
  if (input.resource?.tenantId && input.resource.tenantId !== actor.tenantId) return { allowed: false, reason: 'TENANT_MISMATCH' };
  const requiredScopes = [input.requiredScope, ...(input.requiredScopes ?? []), input.resource?.scope].filter((scope): scope is string => Boolean(scope));
  if (requiredScopes.some((scope) => !actorHasScope(actor, scope))) return { allowed: false, reason: 'OUT_OF_SCOPE' };
  const requiredEnvironment = input.requiredEnvironment ?? input.resource?.environment;
  if (requiredEnvironment && !actorHasScope(actor, `ENV:${requiredEnvironment}`)) return { allowed: false, reason: 'ENVIRONMENT_MISMATCH' };
  if (input.objectStateAllowed === false) return { allowed: false, reason: 'INVALID_OBJECT_STATE' };
  if (input.separationOfDutiesPassed === false) return { allowed: false, reason: 'SOD_CONFLICT' };
  const subjectActorId = input.subjectActorId ?? input.resource?.ownerActorId;
  if (input.prohibitSelfAction && subjectActorId && subjectActorId === actor.actorId) return { allowed: false, reason: 'SELF_ACTION' };
  if (input.auditReasonRequired && !input.auditReason?.trim()) return { allowed: false, reason: 'AUDIT_REASON_REQUIRED' };
  return { allowed: true, reason: 'ALLOWED' };
}

export function authorizationReasonLabel(reason: AuthorizationReason): string {
  return {
    ALLOWED: '允许访问',
    MISSING_PERMISSION: '缺少权限',
    OUT_OF_SCOPE: '超出数据范围',
    TENANT_MISMATCH: '租户不匹配',
    ENVIRONMENT_MISMATCH: '环境范围不匹配',
    INVALID_OBJECT_STATE: '对象状态不允许',
    SOD_CONFLICT: '存在职责分离冲突',
    SELF_ACTION: '禁止处理本人发起的事项',
    AUDIT_REASON_REQUIRED: '高风险操作必须填写原因',
  }[reason];
}

export const mockActor: ActorContext = {
  actorId: 'U-PLATFORM-001',
  displayName: '平台产品验证员',
  tenantId: 'CITY-JINAN',
  environment: 'SANDBOX',
  roles: ['SUBSCRIPTION_OPERATOR'],
  scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'FR1:*', 'FR2:*', 'FR3:*', 'FR4:*', 'FR5:*', 'GOVERNANCE:PERMISSION'],
  permissions: new Set<PermissionCode>([
    'FR1.CATALOG.READ', 'FR1.ENTITLEMENT.READ',
    'FR2.REQUEST.READ', 'FR2.REQUEST.CREATE', 'FR2.REQUEST.EDIT', 'FR2.REQUEST.SUBMIT',
    'FR2.PRECHECK.READ', 'FR2.PRECHECK.EXECUTE', 'FR2.PRECHECK.REMEDIATE', 'FR2.APPROVAL.READ',
    'FR2.SUBSCRIPTION.READ', 'FR2.SUBSCRIPTION.CHANGE', 'FR2.CONTROL.PLAN', 'FR2.DIAGNOSIS.READ',
    'FR2.AUDIT.READ', 'FR2.WORKBENCH.READ', 'FR3.CONFIGURATION.READ', 'FR3.CONFIGURATION.REQUEST', 'FR4.QUALIFICATION.READ',
    'FR4.RELEASE.READ', 'FR5.EVIDENCE.READ', 'FR5.INCIDENT.READ', 'GOVERNANCE.PERMISSION.READ',
    'GOVERNANCE.PERMISSION.SIMULATE', 'GOVERNANCE.ROLE.READ', 'GOVERNANCE.ROLE.REQUEST', 'GOVERNANCE.INTEGRATION.READ',
  ]),
};

/**
 * 可切换的登录工作身份仅用于本地开发与验收。
 * 生产实现应由统一身份平台返回当前用户的租户、角色、环境和数据范围，
 * 前端只保存当前会话选择，不自行授予权限。
 */
export const actorProfiles: readonly ActorContext[] = [
  mockActor,
  {
    actorId: 'U-PLATFORM-ADMIN-001', displayName: '平台管理员', tenantId: 'CITY-JINAN', environment: 'PRODUCTION',
    roles: ['PLATFORM_ADMIN'], scopes: ['TENANT:*', 'CITY:*', 'ENV:*', 'FR1:*', 'FR2:*', 'FR3:*', 'FR4:*', 'FR5:*', 'GOVERNANCE:*'], permissions: new Set(),
  },
  {
    actorId: 'U-APPROVER-001', displayName: '订阅审批人', tenantId: 'CITY-JINAN', environment: 'SANDBOX',
    roles: ['APPROVER'], scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'ENV:TEST', 'FR2:APPROVAL'], permissions: new Set(),
  },
  {
    actorId: 'U-OEM-QILU-021', displayName: '车企接入负责人', tenantId: 'OEM-QILU', environment: 'TEST',
    roles: ['OEM_INTEGRATION'], scopes: ['TENANT:OEM-QILU', 'ENV:SANDBOX', 'ENV:TEST'], permissions: new Set(),
  },
  {
    actorId: 'U-TEST-OPERATOR-001', displayName: '测试发布员', tenantId: 'CITY-JINAN', environment: 'TEST',
    roles: ['TEST_OPERATOR'], scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'ENV:TEST', 'FR3:*', 'FR4:*'], permissions: new Set(),
  },
  {
    actorId: 'U-AUDITOR-001', displayName: '安全审计员', tenantId: 'CITY-JINAN', environment: 'PRODUCTION',
    roles: ['AUDITOR'], scopes: ['CITY:*', 'ENV:*'], permissions: new Set(),
  },
];
