import type {
  ApprovalCaseDetail,
  ApprovalCaseSummary,
  ApprovalDecisionInput,
  ApprovalDecisionReceipt,
  AuditEventSummary,
  ConfigurationSummary,
  ConfigurationDetail,
  ConfigurationChangeInput,
  ConfigurationChangeReceipt,
  DeliveryEvidenceSummary,
  DeliveryEvidenceDetail,
  EntitlementSummary,
  IncidentSummary,
  IncidentDetail,
  IncidentActionInput,
  IncidentActionReceipt,
  QualificationSummary,
  QualificationDetail,
  QualificationExecutionInput,
  QualificationExecutionReceipt,
  ReleasePlanSummary,
  ReleasePlanDetail,
  ReleaseExecutionInput,
  ReleaseExecutionReceipt,
  SubscriptionChangeInput,
  SubscriptionChangeReceipt,
  ControlPlanInput,
  ControlPlanReceipt,
  RoleAssignmentChangeInput,
  RoleAssignmentChangeReceipt,
  RoleAssignmentSummary,
  RolePermissionConfigChangeInput,
  RolePermissionConfigChangeReceipt,
  ServiceCatalogSummary,
  DashboardMetric,
  EvidenceSummary,
  PageResult,
  PrecheckFinding,
  PrecheckRunDetail,
  RemediationCaseDetail,
  RemediationActionInput,
  RemediationActionReceipt,
  SubmissionContext,
  SubmissionReceipt,
  SubscriptionDraftInput,
  SubscriptionDraftReceipt,
  SubscriptionDetail,
  SubscriptionInstanceSummary,
  SubscriptionRequestSummary,
  SubscriptionRevisionDiff,
  SubscriptionRevisionSummary,
  SubscriptionSummary,
  SystemIntegrationSummary,
  PermissionCode,
  PartnerSummary,
  ApplicationClientSummary,
  PartnerOnboardingInput,
  PartnerOnboardingReceipt,
  PartnerOnboardingReasonCode,
  PartnerLifecycleChangeInput,
  PartnerLifecycleChangeReceipt,
  ApplicationAccessActionInput,
  ApplicationAccessActionReceipt,
  EndpointCredentialSummary,
  EndpointVerificationCheckSummary,
  EndpointVerificationCheckStatus,
  AccessReviewSummary,
  AccessReviewRequestInput,
  AccessReviewRequestReceipt,
} from '@vrc/contracts';
import { effectivePermissions, permissionCatalog, roleCatalog } from '../core/auth/permissions';
import { anyEnvironmentVisible, filterScoped, getDataScopeContext, hasEnvironmentScope, isTenantVisible } from '../core/auth/data-scope';

const requests: readonly SubscriptionRequestSummary[] = [
  { requestId: 'REQ-240916-003', requestRevision: 1, oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', serviceName: '信号灯提醒服务', channelType: 'UU_A', coverageSummary: '经十路示范走廊 · 38路口', requestStatus: 'DRAFT', precheckOutcome: 'PASS_WITH_CONDITIONS', precheckValidity: 'CURRENT', blockerCount: 0, ownerName: '赵明', updatedAt: '2026-09-16 10:20', etag: 'W/"req-003-r1"' },
  { requestId: 'REQ-240916-001', requestRevision: 3, oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', serviceName: '信号灯提醒服务', channelType: 'UU_A', coverageSummary: '经十路示范走廊 · 38路口', requestStatus: 'IN_REVIEW', precheckOutcome: 'PASS_WITH_CONDITIONS', precheckValidity: 'CURRENT', blockerCount: 0, ownerName: '赵明', updatedAt: '2026-09-16 10:24', etag: 'W/"req-001-r3"' },
];

const catalog: readonly ServiceCatalogSummary[] = [
  { serviceId: 'SVC-SPAT-2.3', serviceName: '信号灯提醒服务', serviceVersion: '2.3', description: '向车企云提供路口信号灯状态、剩余时间和通行建议数据。', scenarioTags: ['绿波车速引导', '信号灯上车提醒'], channelTypes: ['UU_A', 'UU_B'], supportedEnvironments: ['SANDBOX', 'TEST'], coverageSummary: '经十路示范走廊 · 38路口', qualificationProfile: 'SPAT-UU-A-基础链路 v1.2', availability: 'AVAILABLE', updatedAt: '2026-09-16 10:12' },
  { serviceId: 'SVC-VRU-1.5', serviceName: '超视距弱势交通参与者碰撞预警', serviceVersion: '1.5', description: '提供弱势交通参与者风险事件和碰撞预警提示，支持车企云接入。', scenarioTags: ['弱势交通参与者预警', '超视距碰撞预警'], channelTypes: ['UU_A'], supportedEnvironments: ['SANDBOX', 'TEST'], coverageSummary: '济南西站示范区', qualificationProfile: 'VRU-COLLISION-UU-A v2.0', availability: 'PILOT', updatedAt: '2026-09-16 09:40' },
  { serviceId: 'SVC-QUEUE-1.0', serviceName: '前方拥堵预警服务', serviceVersion: '1.0', description: '提供路段拥堵等级、排队长度和事件影响范围，当前暂停申请，需完成上线评审后恢复。', scenarioTags: ['前方拥堵预警', '异常停车预警'], channelTypes: ['UU_A'], supportedEnvironments: ['SANDBOX'], coverageSummary: '济南市重点示范道路', qualificationProfile: 'TRAFFIC-EVENT-UU-A v1.0', availability: 'SUSPENDED', updatedAt: '2026-09-15 18:20' },
];

const entitlements: readonly EntitlementSummary[] = [
  { entitlementId: 'ENT-JN-SANDBOX-001', serviceId: 'SVC-SPAT-2.3', serviceName: '信号灯提醒服务', oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', coverageSummary: '经十路示范走廊 · 38路口', capabilitySummary: 'CAP-OEM-CONFIRMED-01 · 3个车型系列', validFrom: '2026-09-01 00:00', validTo: '2026-11-30 00:00', status: 'ACTIVE', revision: 5, ownerName: '权益服务负责人', updatedAt: '2026-09-16 10:12' },
  { entitlementId: 'ENT-JN-TEST-004', serviceId: 'SVC-VRU-1.5', serviceName: '超视距弱势交通参与者碰撞预警', oemName: '齐鲁智行汽车', applicationName: '弱势交通参与者预警', environment: 'TEST', coverageSummary: '济南西站示范区', capabilitySummary: 'CAP-VRU-CONFIRMED-02 · 2个车型系列', validFrom: '2026-09-10 00:00', validTo: '2026-10-15 00:00', status: 'EXPIRING', revision: 2, ownerName: '权益服务负责人', updatedAt: '2026-09-16 09:40' },
  { entitlementId: 'ENT-JN-SANDBOX-005', serviceId: 'SVC-QUEUE-1.0', serviceName: '前方拥堵预警服务', oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', coverageSummary: '济南市重点示范道路', capabilitySummary: '暂无车型能力授权', validFrom: '2026-09-01 00:00', validTo: '2026-09-30 00:00', status: 'REVOKED', revision: 1, ownerName: '权益服务负责人', updatedAt: '2026-09-15 18:20' },
];

const evidence: readonly DeliveryEvidenceSummary[] = [
  { evidenceId: 'EVD-JN-0001-A', releasePlanId: 'REL-JN-0001-A', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-A', serviceName: '信号灯提醒服务', environment: 'SANDBOX', receiveGrade: 'F1', displayGrade: 'UNKNOWN', interactionGrade: 'UNKNOWN', lastObservedAt: '2026-09-16 10:35', sourceSystem: '车企云回执适配器', ownerName: '运行运营负责人', updatedAt: '2026-09-16 10:36' },
  { evidenceId: 'EVD-JN-0001-B', releasePlanId: 'REL-JN-0001-B', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-B', serviceName: '信号灯提醒服务', environment: 'SANDBOX', receiveGrade: 'F0', displayGrade: 'UNKNOWN', interactionGrade: 'UNKNOWN', lastObservedAt: '—', sourceSystem: '平台投递日志', ownerName: '运行运营负责人', updatedAt: '2026-09-16 10:26' },
  { evidenceId: 'EVD-JN-0004-A', releasePlanId: 'REL-JN-0004-A', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', environment: 'TEST', receiveGrade: 'F1', displayGrade: 'F2', interactionGrade: 'UNKNOWN', lastObservedAt: '2026-09-16 10:04', sourceSystem: '车端测试回传', ownerName: '运行运营负责人', updatedAt: '2026-09-16 10:05' },
];

const incidents: readonly IncidentSummary[] = [
  { incidentId: 'INC-JN-0001', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-B', serviceName: '信号灯提醒服务', environment: 'SANDBOX', category: 'DELIVERY', severity: 'WARNING', status: 'OPEN', summary: '发布计划未完成，实例尚未产生接收回执', ownerName: '运行运营负责人', firstSeenAt: '2026-09-16 10:26', updatedAt: '2026-09-16 10:26' },
  { incidentId: 'INC-JN-0004', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', environment: 'TEST', category: 'RELEASE', severity: 'HIGH', status: 'IN_PROGRESS', summary: '灰度发布节点执行失败，等待重新核对测试结果', ownerName: '发布负责人', firstSeenAt: '2026-09-16 10:02', updatedAt: '2026-09-16 10:08' },
  { incidentId: 'INC-JN-0007', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', environment: 'TEST', category: 'RUNTIME', severity: 'INFO', status: 'RESOLVED', summary: '测试环境短时无车辆交互证据，已恢复采集', ownerName: '测试负责人', firstSeenAt: '2026-09-15 16:20', updatedAt: '2026-09-15 17:05' },
];

const evidenceDetails: readonly DeliveryEvidenceDetail[] = [
  {
    ...evidence[0]!,
    chainStatus: 'PARTIAL',
    contentHash: 'sha256:evidence-jn-0001-a…7f20',
    traceId: 'TRC-DELIVERY-240916-01',
    events: [
      { eventId: 'EVE-DEL-0001', stage: 'DELIVERY', occurredAt: '2026-09-16 10:34:58', sourceSystem: '平台投递服务', status: 'CONFIRMED', correlationId: 'MSG-SPAT-0001', payloadSummary: 'SPAT消息已投递至车企云适配器', reason: '投递回执已生成' },
      { eventId: 'EVE-REC-0001', stage: 'RECEIVE', occurredAt: '2026-09-16 10:35:02', sourceSystem: '车企云回执适配器', status: 'CONFIRMED', correlationId: 'MSG-SPAT-0001', payloadSummary: '车企云确认接收', reason: '接收回执已关联实例' },
      { eventId: 'EVE-DIS-0001', stage: 'DISPLAY', occurredAt: '—', sourceSystem: '车端测试回传', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '暂无展示证据', reason: '车端展示回传通道尚未覆盖当前实例' },
      { eventId: 'EVE-INT-0001', stage: 'INTERACTION', occurredAt: '—', sourceSystem: '车端测试回传', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '暂无交互证据', reason: '不能由接收成功推断车端交互' },
    ],
  },
  {
    ...evidence[1]!,
    chainStatus: 'BROKEN',
    contentHash: 'sha256:evidence-jn-0001-b…21a0',
    traceId: 'TRC-DELIVERY-240916-02',
    events: [
      { eventId: 'EVE-DEL-0002', stage: 'DELIVERY', occurredAt: '2026-09-16 10:25:44', sourceSystem: '平台投递服务', status: 'CONFIRMED', correlationId: 'MSG-SPAT-0002', payloadSummary: '消息已进入投递队列', reason: '仅有投递记录' },
      { eventId: 'EVE-REC-0002', stage: 'RECEIVE', occurredAt: '—', sourceSystem: '车企云回执适配器', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '尚未收到接收回执', reason: '发布节点尚未执行' },
      { eventId: 'EVE-DIS-0002', stage: 'DISPLAY', occurredAt: '—', sourceSystem: '车端测试回传', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '暂无展示证据', reason: '前置接收证据缺失' },
      { eventId: 'EVE-INT-0002', stage: 'INTERACTION', occurredAt: '—', sourceSystem: '车端测试回传', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '暂无交互证据', reason: '前置接收证据缺失' },
    ],
  },
  {
    ...evidence[2]!,
    chainStatus: 'PARTIAL',
    contentHash: 'sha256:evidence-jn-0004-a…44d8',
    traceId: 'TRC-DELIVERY-240916-04',
    events: [
      { eventId: 'EVE-DEL-0004', stage: 'DELIVERY', occurredAt: '2026-09-16 10:03:41', sourceSystem: '测试发布服务', status: 'CONFIRMED', correlationId: 'MSG-VRU-0004', payloadSummary: '测试消息已投递', reason: '节点回执已生成' },
      { eventId: 'EVE-REC-0004', stage: 'RECEIVE', occurredAt: '2026-09-16 10:04:02', sourceSystem: '车端测试回传', status: 'CONFIRMED', correlationId: 'MSG-VRU-0004', payloadSummary: '车辆接收事件已回传', reason: '接收证据为F1' },
      { eventId: 'EVE-DIS-0004', stage: 'DISPLAY', occurredAt: '2026-09-16 10:04:08', sourceSystem: '车端测试回传', status: 'CONFIRMED', correlationId: 'MSG-VRU-0004', payloadSummary: '车端展示事件已回传', reason: '展示证据为F2' },
      { eventId: 'EVE-INT-0004', stage: 'INTERACTION', occurredAt: '—', sourceSystem: '车端测试回传', status: 'UNKNOWN', correlationId: '待生成', payloadSummary: '暂无交互证据', reason: '当前用例未覆盖交互闭环' },
    ],
  },
];

const incidentDetails: readonly IncidentDetail[] = [
  {
    ...incidents[0]!,
    rootCause: '发布计划 REL-JN-0001-B 尚未完成配置和联合测试，消息只有投递记录，未生成接收回执。',
    impactScope: 'SUB-JN-0001 / INS-JN-0001-B · 经十路西段18路口',
    responseSla: '首次响应 30 分钟 · 当前剩余约 18 分钟',
    recoveryEvidence: '尚无接收、展示或交互证据',
    nextAction: '补齐配置必填项，完成联合测试后再重新评估发布计划',
    relatedEvidenceIds: ['EVD-JN-0001-B'],
    timeline: [
      { time: '2026-09-16 10:26', actor: '监控规则', action: '创建事件', detail: '发现实例无接收回执', status: 'OPEN' },
      { time: '2026-09-16 10:28', actor: '运行运营负责人', action: '确认影响范围', detail: '确认仅影响INS-JN-0001-B', status: 'ACKNOWLEDGED' },
    ],
  },
  {
    ...incidents[1]!,
    rootCause: '灰度节点收到部分回执，但实例级关联字段缺失，且前置风险阈值校验未通过。',
    impactScope: 'SUB-JN-0004 / INS-JN-0004-A · 济南西站示范区',
    responseSla: '高风险事件 · 需在发布窗口前完成处置',
    recoveryEvidence: '平台节点完成证据存在；车端展示和交互证据不能由部分发布状态推断',
    nextAction: '核对配置阈值与车型能力版本，补齐回执关联字段，再决定回退或重排',
    relatedEvidenceIds: ['EVD-JN-0004-A'],
    timeline: [
      { time: '2026-09-16 10:02', actor: '测试发布服务', action: '节点执行失败', detail: '车企云接入节点回执关联字段缺失', status: 'OPEN' },
      { time: '2026-09-16 10:08', actor: '发布负责人', action: '开始调查', detail: '等待重新核对测试结果和风险阈值', status: 'IN_PROGRESS' },
    ],
  },
  {
    ...incidents[2]!,
    rootCause: '测试环境短时未收到车端交互事件，后续回传已恢复。',
    impactScope: 'SUB-JN-0004 / INS-JN-0004-A · 测试环境',
    responseSla: '提示级事件 · 按测试窗口跟踪',
    recoveryEvidence: '车端测试回传已恢复；仍需确认完整用例覆盖',
    nextAction: '回到证据链核对交互证据是否覆盖全部测试用例',
    relatedEvidenceIds: ['EVD-JN-0004-A'],
    timeline: [
      { time: '2026-09-15 16:20', actor: '监控规则', action: '创建事件', detail: '短时无车辆交互证据', status: 'OPEN' },
      { time: '2026-09-15 17:05', actor: '测试负责人', action: '确认恢复', detail: '交互回传恢复采集', status: 'RESOLVED' },
    ],
  },
];

const auditEvents: readonly AuditEventSummary[] = [
  {
    eventId: 'AUD-JN-0001',
    occurredAt: '2026-09-16 10:42:18+08:00',
    actorId: 'U-PLATFORM-001',
    actorName: '平台产品验证员',
    actorRoles: ['SUBSCRIPTION_OPERATOR'],
    permission: 'FR2.APPROVAL.DECIDE',
    actionLabel: '作出审批决定',
    decision: 'DENIED',
    reasonCode: 'SOD_CONFLICT',
    reason: '当前账号参与了申请办理，未通过职责分离校验。',
    resourceType: 'ApprovalCase',
    resourceId: 'APR-240916-001',
    tenantId: 'CITY-JINAN',
    environment: 'SANDBOX',
    sourceSystem: '授权策略服务',
    traceId: 'TRC-240916-8F21',
  },
  {
    eventId: 'AUD-JN-0002',
    occurredAt: '2026-09-16 10:38:05+08:00',
    actorId: 'U-PLATFORM-001',
    actorName: '平台产品验证员',
    actorRoles: ['SUBSCRIPTION_OPERATOR'],
    permission: 'FR2.SUBSCRIPTION.READ',
    actionLabel: '查看订阅实例',
    decision: 'ALLOWED',
    reasonCode: 'ALLOWED',
    reason: '角色授权、租户和城市范围均匹配。',
    resourceType: 'Subscription',
    resourceId: 'SUB-JN-0001',
    tenantId: 'CITY-JINAN',
    environment: 'SANDBOX',
    sourceSystem: '订阅运营服务',
    traceId: 'TRC-240916-6A10',
  },
  {
    eventId: 'AUD-JN-0003',
    occurredAt: '2026-09-16 10:35:44+08:00',
    actorId: 'U-OEM-QILU-021',
    actorName: '齐鲁智行接入工程师',
    actorRoles: ['OEM_INTEGRATION'],
    permission: 'FR2.SUBSCRIPTION.READ',
    actionLabel: '查看订阅实例',
    decision: 'DENIED',
    reasonCode: 'TENANT_MISMATCH',
    reason: '资源所属租户与账号租户不一致，已拒绝跨企业访问。',
    resourceType: 'Subscription',
    resourceId: 'SUB-JN-0009',
    tenantId: 'CITY-QINGDAO',
    environment: 'SANDBOX',
    sourceSystem: '统一访问网关',
    traceId: 'TRC-240916-1C77',
  },
  {
    eventId: 'AUD-JN-0004',
    occurredAt: '2026-09-16 10:31:20+08:00',
    actorId: 'U-TEST-007',
    actorName: '联合测试员',
    actorRoles: ['TEST_OPERATOR'],
    permission: 'FR4.QUALIFICATION.EXECUTE',
    actionLabel: '执行联合测试',
    decision: 'ALLOWED',
    reasonCode: 'ALLOWED',
    reason: '测试发布员角色具备测试环境执行权限。',
    resourceType: 'Qualification',
    resourceId: 'QAL-JN-0001-A',
    tenantId: 'CITY-JINAN',
    environment: 'TEST',
    sourceSystem: '测试与发布服务',
    traceId: 'TRC-240916-4B92',
  },
  {
    eventId: 'AUD-JN-0005',
    occurredAt: '2026-09-16 10:24:02+08:00',
    actorId: 'U-APPROVER-003',
    actorName: '审批人·李敏',
    actorRoles: ['APPROVER'],
    permission: 'FR2.APPROVAL.DECIDE',
    actionLabel: '作出审批决定',
    decision: 'ALLOWED',
    reasonCode: 'AUDIT_REASON_RECORDED',
    reason: '审批决定已记录业务理由和审批意见。',
    resourceType: 'ApprovalCase',
    resourceId: 'APR-240916-003',
    tenantId: 'CITY-JINAN',
    environment: 'SANDBOX',
    sourceSystem: '审批服务',
    traceId: 'TRC-240916-2D54',
  },
  {
    eventId: 'AUD-JN-0006',
    occurredAt: '2026-09-16 10:18:41+08:00',
    actorId: 'SVC-PRECHECK-001',
    actorName: '准入检查服务',
    actorRoles: [],
    permission: 'FR2.PRECHECK.EXECUTE',
    actionLabel: '执行准入检查',
    decision: 'ALLOWED',
    reasonCode: 'SERVICE_IDENTITY_ALLOWED',
    reason: '服务身份通过工作负载身份校验，完成规则集执行。',
    resourceType: 'PrecheckRun',
    resourceId: 'PCR-240916-001',
    tenantId: 'CITY-JINAN',
    environment: 'SANDBOX',
    sourceSystem: '准入检查服务',
    traceId: 'TRC-240916-A901',
  },
];

const roleChangeReasons: Readonly<Record<RoleAssignmentChangeInput['changeType'], readonly string[]>> = {
  GRANT: ['ROLE_ASSIGNMENT_REQUIRED', 'TEMPORARY_ACCESS'],
  ADJUST: ['SCOPE_CHANGE', 'TEMPORARY_ACCESS'],
  REVOKE: ['OFFBOARDING', 'SCOPE_CHANGE'],
};

const rolePermissionConfigReasons: readonly RolePermissionConfigChangeInput['reasonCode'][] = ['FUNCTION_CHANGE', 'LEAST_PRIVILEGE', 'COMPLIANCE_REVIEW', 'EMERGENCY_RESTRICTION'];

const configurationChangeReasons: Readonly<Record<ConfigurationChangeInput['changeType'], readonly string[]>> = {
  CREATE: ['NEW_INSTANCE', 'SERVICE_ONBOARDING'],
  UPDATE: ['PARAMETER_CORRECTION', 'SERVICE_POLICY_UPDATE', 'OEM_CAPABILITY_CHANGE'],
  ROLLBACK: ['ROLLBACK_AFTER_FAILURE', 'EMERGENCY_DEGRADATION'],
};

const roleAssignments: readonly RoleAssignmentSummary[] = [
  {
    assignmentId: 'RA-JN-0001',
    subjectId: 'U-PLATFORM-001',
    subjectName: '平台产品验证员',
    subjectType: 'USER',
    tenantId: 'CITY-JINAN',
    organizationName: '济南车路云运营中心',
    roleCode: 'SUBSCRIPTION_OPERATOR',
    scopeSummary: '济南市 · 经十路示范走廊',
    environments: ['SANDBOX'],
    status: 'ACTIVE',
    effectiveFrom: '2026-09-01 00:00',
    expiresAt: '2026-12-31 23:59',
    grantedBy: '平台管理员·王强',
    updatedAt: '2026-09-01 09:00',
  },
  {
    assignmentId: 'RA-JN-0002',
    subjectId: 'U-APPROVER-003',
    subjectName: '李敏',
    subjectType: 'USER',
    tenantId: 'CITY-JINAN',
    organizationName: '济南车路云运营中心',
    roleCode: 'APPROVER',
    scopeSummary: '济南市 · 订阅审批范围',
    environments: ['SANDBOX', 'TEST'],
    status: 'ACTIVE',
    effectiveFrom: '2026-08-15 00:00',
    expiresAt: '2027-08-14 23:59',
    grantedBy: '平台管理员·王强',
    updatedAt: '2026-08-15 10:20',
  },
  {
    assignmentId: 'RA-JN-0003',
    subjectId: 'SVC-PRECHECK-001',
    subjectName: '准入检查服务',
    subjectType: 'SERVICE_ACCOUNT',
    tenantId: 'CITY-JINAN',
    organizationName: '平台工作负载',
    roleCode: 'TEST_OPERATOR',
    scopeSummary: '济南市 · 自动化测试资源',
    environments: ['SANDBOX', 'TEST'],
    status: 'EXPIRING',
    effectiveFrom: '2026-06-01 00:00',
    expiresAt: '2026-09-30 23:59',
    grantedBy: '平台管理员·王强',
    updatedAt: '2026-09-15 16:10',
  },
  {
    assignmentId: 'RA-JN-0004',
    subjectId: 'ORG-QILU-AUTO',
    subjectName: '齐鲁智行汽车',
    subjectType: 'ORGANIZATION',
    tenantId: 'CITY-JINAN',
    organizationName: '车企接入组织',
    roleCode: 'OEM_INTEGRATION',
    scopeSummary: '仅限齐鲁智行租户资源',
    environments: ['SANDBOX'],
    status: 'PENDING_APPROVAL',
    effectiveFrom: '待审批通过',
    expiresAt: '2026-12-31 23:59',
    grantedBy: '待审批',
    updatedAt: '2026-09-16 10:40',
    requestId: 'RREQ-JN-0004',
  },
  {
    assignmentId: 'RA-JN-0005',
    subjectId: 'U-OLD-009',
    subjectName: '周宁',
    subjectType: 'USER',
    tenantId: 'CITY-JINAN',
    organizationName: '济南车路云运营中心',
    roleCode: 'TEST_OPERATOR',
    scopeSummary: '济南市 · 测试环境',
    environments: ['TEST'],
    status: 'REVOKED',
    effectiveFrom: '2026-03-01 00:00',
    expiresAt: '2026-09-10 18:00',
    grantedBy: '平台管理员·王强',
    updatedAt: '2026-09-10 18:00',
  },
];

const accessReviews: readonly AccessReviewSummary[] = [
  { reviewId: 'AR-JN-0001', subjectId: 'U-PLATFORM-001', subjectName: '平台产品验证员', subjectType: 'USER', tenantId: 'CITY-JINAN', roleCodes: ['SUBSCRIPTION_OPERATOR'], environment: 'SANDBOX', resourceSummary: '订阅申请、订阅实例、配置只读', actionSummary: '查看、创建申请、提交补正', dataClassification: '业务运营数据', status: 'OPEN', reviewResult: 'PENDING', expiresAt: '2026-12-31', lastUsedAt: '2026-09-17 09:41', reviewerName: '安全审计负责人', updatedAt: '2026-09-17 09:41' },
  { reviewId: 'AR-JN-0002', subjectId: 'U-APPROVER-001', subjectName: '订阅审批人', subjectType: 'USER', tenantId: 'CITY-JINAN', roleCodes: ['APPROVER'], environment: 'SANDBOX', resourceSummary: '订阅审批队列与审批详情', actionSummary: '查看、批准、退回、拒绝', dataClassification: '业务运营数据', status: 'IN_REVIEW', reviewResult: 'RETAIN', expiresAt: '2026-10-15', lastUsedAt: '2026-09-16 10:24', reviewerName: '安全审计负责人', updatedAt: '2026-09-16 16:20' },
  { reviewId: 'AR-JN-0003', subjectId: 'U-OEM-QILU-021', subjectName: '车企接入负责人', subjectType: 'USER', tenantId: 'OEM-QILU', roleCodes: ['OEM_INTEGRATION'], environment: 'TEST', resourceSummary: '本企业应用、配置与测试资料', actionSummary: '查看、创建申请、提交资料', dataClassification: '车企接入数据', status: 'OVERDUE', reviewResult: 'PENDING', expiresAt: '2026-09-10', lastUsedAt: '2026-09-08 18:05', reviewerName: '待分配', updatedAt: '2026-09-17 08:00' },
  { reviewId: 'AR-JN-0004', subjectId: 'SVC-PRECHECK-001', subjectName: '准入检查服务', subjectType: 'SERVICE_ACCOUNT', tenantId: 'CITY-JINAN', roleCodes: ['TEST_OPERATOR'], environment: 'TEST', resourceSummary: '自动化准入检查任务', actionSummary: '读取配置、执行测试、回传结果', dataClassification: '系统运行数据', status: 'OPEN', reviewResult: 'NARROW', expiresAt: '2026-09-30', lastUsedAt: '2026-09-16 10:18', reviewerName: '安全审计负责人', updatedAt: '2026-09-15 16:10' },
];

const integrations: readonly SystemIntegrationSummary[] = [
  { integrationId: 'INT-JN-0001', systemName: '统一访问网关', systemType: '平台基础设施', ownerName: '平台基础设施负责人', environments: ['SANDBOX', 'TEST', 'PRODUCTION'], dataDomains: ['权限决策', '租户与环境范围', '链路追踪'], status: 'CONNECTED', lastObservedAt: '2026-09-16 10:45', sourceSystem: '统一访问网关', dependencySummary: '服务身份、租户上下文和策略服务均已接入', nextAction: '保持心跳与证书轮换', updatedAt: '2026-09-16 10:45' },
  { integrationId: 'INT-JN-0002', systemName: '订阅运营服务', systemType: '平台业务服务', ownerName: '订阅平台负责人', environments: ['SANDBOX', 'TEST'], dataDomains: ['申请', '审批', '订阅实例', '版本'], status: 'CONNECTED', lastObservedAt: '2026-09-16 10:42', sourceSystem: '订阅运营服务', dependencySummary: '订阅查询、审批回执和版本查询接口已登记', nextAction: '接入生产只读数据源', updatedAt: '2026-09-16 10:42' },
  { integrationId: 'INT-JN-0003', systemName: '配置与参数中心', systemType: '平台业务服务', ownerName: '配置平台负责人', environments: ['SANDBOX', 'TEST'], dataDomains: ['配置版本', '参数校验', '生效快照'], status: 'PARTIAL', lastObservedAt: '2026-09-16 10:31', sourceSystem: '配置中心适配器', dependencySummary: '配置查询已接入；参数保存、校验和发布回执尚未接入', nextAction: '冻结配置OpenAPI和校验回执契约', updatedAt: '2026-09-16 10:31' },
  { integrationId: 'INT-JN-0004', systemName: '测试与发布服务', systemType: '平台业务服务', ownerName: '测试发布负责人', environments: ['SANDBOX', 'TEST'], dataDomains: ['联合测试', '发布计划', '节点回执'], status: 'PARTIAL', lastObservedAt: '2026-09-16 10:02', sourceSystem: '测试发布适配器', dependencySummary: '测试任务和发布计划可查询；执行指令、节点回执和回滚接口尚未接入', nextAction: '补齐执行回执和回滚状态模型', updatedAt: '2026-09-16 10:02' },
  { integrationId: 'INT-JN-0005', systemName: '车企云回执适配器', systemType: 'OEM接入系统', ownerName: '车企云接入负责人', environments: ['SANDBOX', 'TEST'], dataDomains: ['接收回执', '接口健康', '证书状态'], status: 'DEGRADED', lastObservedAt: '2026-09-16 10:35', sourceSystem: '车企云回执适配器', dependencySummary: '部分实例可收到回执；尚未覆盖车端展示和交互证据', nextAction: '补充实例级回执关联和重试告警', updatedAt: '2026-09-16 10:36' },
  { integrationId: 'INT-JN-0006', systemName: '车端展示与交互回传', systemType: '车端 / OEM系统', ownerName: '车端接入负责人', environments: ['TEST'], dataDomains: ['展示证据', '交互证据', '车端日志'], status: 'PENDING', lastObservedAt: '—', sourceSystem: '车端测试回传', dependencySummary: '尚未形成生产可用的展示、交互回传通道和数据授权', nextAction: '确认车端日志字段、脱敏规则和回传周期', updatedAt: '2026-09-16 09:50' },
  { integrationId: 'INT-JN-0007', systemName: '统一审计中心', systemType: '安全与审计', ownerName: '安全审计负责人', environments: ['SANDBOX', 'TEST', 'PRODUCTION'], dataDomains: ['权限决策', '业务操作', '链路追踪'], status: 'CONNECTED', lastObservedAt: '2026-09-16 10:45', sourceSystem: '审计服务', dependencySummary: '审计事件可查询；审计归档和跨系统关联由服务端负责', nextAction: '接入生产归档策略与留存校验', updatedAt: '2026-09-16 10:45' },
];

const partners: readonly PartnerSummary[] = [
  {
    partnerId: 'PTN-JN-0001', tenantId: 'CITY-JINAN', partnerName: '济南市交通运输局', partnerType: 'CITY_OPERATOR', legalName: '济南市交通运输局',
    protocolVersion: 'JN-V2X-PROFILE-1.0', protocolExpiresAt: '2027-09-30', ownerName: '平台接入负责人', contactName: '王强', contactEmail: 'ops@jinan.example.invalid', dataProcessingRole: '城市交通服务提供方', onCallContact: '济南车路云值班台 · 0531-00000000',
    environments: ['SANDBOX', 'TEST', 'PRODUCTION'], scopeSummary: '济南市 · 城市交通服务域', status: 'ACTIVE', applicationCount: 1, endpointCount: 2, updatedAt: '2026-09-16 10:45',
  },
  {
    partnerId: 'PTN-OEM-QILU-0001', tenantId: 'OEM-QILU', partnerName: '齐鲁智行汽车', partnerType: 'OEM_TSP', legalName: '齐鲁智行汽车科技有限公司',
    protocolVersion: 'OEM-UUA-PROFILE-2.3', protocolExpiresAt: '2026-12-31', ownerName: '车企接入负责人', contactName: '赵明', contactEmail: 'v2x@qilu.example.invalid', dataProcessingRole: '车企云数据接收方', onCallContact: '齐鲁智行 V2X 值班组 · 400-000-0000',
    environments: ['SANDBOX', 'TEST'], scopeSummary: '齐鲁智行租户资源 · 经十路示范走廊 / 济南西站示范区', status: 'ACTIVE', applicationCount: 2, endpointCount: 3, updatedAt: '2026-09-16 10:40',
  },
  {
    partnerId: 'PTN-DATA-0001', tenantId: 'DATA-ROAD-001', partnerName: '道路感知数据服务商', partnerType: 'DATA_PROVIDER', legalName: '山东路网感知科技有限公司',
    protocolVersion: 'DATA-EVENT-PROFILE-1.0', protocolExpiresAt: '2026-10-15', ownerName: '数据接入负责人', contactName: '刘洋', contactEmail: 'data@road.example.invalid', dataProcessingRole: '交通事件数据处理方', onCallContact: '道路感知值班组 · 0531-00000001',
    environments: ['SANDBOX', 'TEST'], scopeSummary: '济南市 · 交通事件数据域', status: 'FROZEN', applicationCount: 0, endpointCount: 0, updatedAt: '2026-09-12 17:20',
  },
];

const applicationClients: readonly ApplicationClientSummary[] = [
  {
    applicationClientId: 'APP-JN-OPERATOR-01', partnerId: 'PTN-JN-0001', tenantId: 'CITY-JINAN', applicationName: '城市交通服务运营台',
    purpose: '消费信号灯状态、剩余时间与通行建议服务', scopeSummary: '济南市 · 城市交通服务域', environments: ['SANDBOX', 'TEST', 'PRODUCTION'], endpointRefs: ['EP-JN-UUA-SBX', 'EP-JN-UUA-TST'],
    credentialRefs: ['CR-JN-UUA-SBX', 'CR-JN-UUA-TST'], networkAllowlist: ['10.20.0.0/16', 'mTLS 证书组 CITY-JN'], authMethod: 'mTLS + OAuth2 Client Credentials', endpointStatus: 'CONNECTED', credentialStatus: 'VALID', quota: '200 TPS / 应用', ownerName: '平台接入负责人', status: 'ACTIVE', updatedAt: '2026-09-16 10:45',
  },
  {
    applicationClientId: 'APP-QILU-TRAFFIC-01', partnerId: 'PTN-OEM-QILU-0001', tenantId: 'OEM-QILU', applicationName: '智行交通助手',
    purpose: '消费信号灯状态、剩余时间与通行建议', scopeSummary: '经十路示范走廊 · 38路口', environments: ['SANDBOX', 'TEST'], endpointRefs: ['EP-QILU-UUA-SBX', 'EP-QILU-UUA-TST'],
    credentialRefs: ['CR-QILU-UUA-SBX', 'CR-QILU-UUA-TST'], networkAllowlist: ['172.18.40.0/24', 'mTLS 证书组 OEM-QILU'], authMethod: 'mTLS + OAuth2 Client Credentials', endpointStatus: 'CONNECTED', credentialStatus: 'VALID', quota: '80 TPS / 应用', ownerName: '车企接入负责人', status: 'ACTIVE', updatedAt: '2026-09-16 10:40',
  },
  {
    applicationClientId: 'APP-QILU-VRU-01', partnerId: 'PTN-OEM-QILU-0001', tenantId: 'OEM-QILU', applicationName: '弱势交通参与者预警',
    purpose: '消费超视距弱势交通参与者风险事件', scopeSummary: '济南西站示范区', environments: ['TEST'], endpointRefs: ['EP-QILU-VRU-TST'], credentialRefs: ['CR-QILU-VRU-TST'], networkAllowlist: ['172.18.40.0/24'], authMethod: 'mTLS + OAuth2 Client Credentials',
    endpointStatus: 'DEGRADED', credentialStatus: 'EXPIRING', quota: '40 TPS / 应用', ownerName: '车企接入负责人', status: 'ACTIVE', updatedAt: '2026-09-16 09:40',
  },
];

const endpointCredentials: readonly EndpointCredentialSummary[] = [
  { endpointId: 'EP-JN-UUA-SBX', applicationClientId: 'APP-JN-OPERATOR-01', tenantId: 'CITY-JINAN', environment: 'SANDBOX', endpointAddressMasked: 'https://sandbox-gw.jn.example.invalid/uua/spat', networkZone: '城市运营专线 / 10.20.0.0/16', authMethod: 'mTLS + OAuth2 Client Credentials', credentialRef: 'CR-JN-UUA-SBX', credentialIssuer: '济南车路云 CA', credentialExpiresAt: '2027-06-30', credentialStatus: 'VALID', endpointStatus: 'CONNECTED', trustDecision: 'TRUSTED', lastVerifiedAt: '2026-09-17 09:30', ownerName: '平台接入负责人', updatedAt: '2026-09-17 09:30' },
  { endpointId: 'EP-JN-UUA-TST', applicationClientId: 'APP-JN-OPERATOR-01', tenantId: 'CITY-JINAN', environment: 'TEST', endpointAddressMasked: 'https://test-gw.jn.example.invalid/uua/spat', networkZone: '测试专线 / 10.21.0.0/16', authMethod: 'mTLS + OAuth2 Client Credentials', credentialRef: 'CR-JN-UUA-TST', credentialIssuer: '济南车路云 CA', credentialExpiresAt: '2027-06-30', credentialStatus: 'VALID', endpointStatus: 'CONNECTED', trustDecision: 'TRUSTED', lastVerifiedAt: '2026-09-17 09:20', ownerName: '平台接入负责人', updatedAt: '2026-09-17 09:20' },
  { endpointId: 'EP-QILU-UUA-SBX', applicationClientId: 'APP-QILU-TRAFFIC-01', tenantId: 'OEM-QILU', environment: 'SANDBOX', endpointAddressMasked: 'https://sandbox.qilu.example.invalid/uua/spat', networkZone: '车企云专线 / 172.18.40.0/24', authMethod: 'mTLS + OAuth2 Client Credentials', credentialRef: 'CR-QILU-UUA-SBX', credentialIssuer: '齐鲁智行 CA', credentialExpiresAt: '2026-12-31', credentialStatus: 'VALID', endpointStatus: 'CONNECTED', trustDecision: 'TRUSTED', lastVerifiedAt: '2026-09-16 10:40', ownerName: '车企接入负责人', updatedAt: '2026-09-16 10:40' },
  { endpointId: 'EP-QILU-UUA-TST', applicationClientId: 'APP-QILU-TRAFFIC-01', tenantId: 'OEM-QILU', environment: 'TEST', endpointAddressMasked: 'https://test.qilu.example.invalid/uua/spat', networkZone: '车企云专线 / 172.18.40.0/24', authMethod: 'mTLS + OAuth2 Client Credentials', credentialRef: 'CR-QILU-UUA-TST', credentialIssuer: '齐鲁智行 CA', credentialExpiresAt: '2026-12-31', credentialStatus: 'VALID', endpointStatus: 'CONNECTED', trustDecision: 'PARTIAL', lastVerifiedAt: '2026-09-16 10:38', ownerName: '车企接入负责人', updatedAt: '2026-09-16 10:40' },
  { endpointId: 'EP-QILU-VRU-TST', applicationClientId: 'APP-QILU-VRU-01', tenantId: 'OEM-QILU', environment: 'TEST', endpointAddressMasked: 'https://test.qilu.example.invalid/uua/vru', networkZone: '车企云专线 / 172.18.40.0/24', authMethod: 'mTLS + OAuth2 Client Credentials', credentialRef: 'CR-QILU-VRU-TST', credentialIssuer: '齐鲁智行 CA', credentialExpiresAt: '2026-10-01', credentialStatus: 'EXPIRING', endpointStatus: 'DEGRADED', trustDecision: 'PARTIAL', lastVerifiedAt: '2026-09-16 09:38', ownerName: '车企接入负责人', updatedAt: '2026-09-16 09:40' },
];

const endpointVerificationChecks: readonly EndpointVerificationCheckSummary[] = endpointCredentials.flatMap((endpoint) => {
  const definitions: readonly [EndpointVerificationCheckSummary['checkType'], string][] = [
    ['DNS_NETWORK', 'DNS / 网络白名单'],
    ['TLS_MTLS', 'TLS / 双向认证'],
    ['CERTIFICATE_CHAIN', '证书链与有效期'],
    ['APPLICATION_IDENTITY', '应用身份映射'],
    ['SCOPE', 'Scope / 数据范围'],
    ['PROTOCOL_HANDSHAKE', '协议握手与回执'],
  ];
  return definitions.map(([checkType, label], index): EndpointVerificationCheckSummary => {
    const status: EndpointVerificationCheckStatus = endpoint.trustDecision === 'TRUSTED'
      ? 'PASS'
      : endpoint.trustDecision === 'BLOCKED'
        ? 'FAIL'
        : index < 3 ? 'PASS' : 'PARTIAL';
    const message = status === 'PASS' ? '核验通过，结果由接入网关回传。' : status === 'PARTIAL' ? '部分通过，仍需补充或复核对应接入证据。' : '核验失败，当前端点不得进入下一步准入。';
    return {
      checkId: `${endpoint.endpointId}-${checkType}`,
      endpointId: endpoint.endpointId,
      applicationClientId: endpoint.applicationClientId,
      tenantId: endpoint.tenantId,
      environment: endpoint.environment,
      checkType,
      label,
      status,
      observedAt: endpoint.lastVerifiedAt,
      sourceSystem: '统一接入网关',
      traceId: `TRC-ENDPOINT-${endpoint.endpointId}-${String(index + 1).padStart(2, '0')}`,
      message,
      remediation: status === 'PASS' ? '无需处理' : status === 'PARTIAL' ? '补充证书、Scope 或协议回执证据后重新核验。' : '检查网络、证书和应用身份映射，完成修复后重新测试。',
    };
  });
});

const subscriptions: readonly SubscriptionSummary[] = [
  { subscriptionId: 'SUB-JN-0001', oemName: '齐鲁智行汽车', applicationName: '智行交通助手', serviceName: '信号灯提醒服务', serviceVersion: '2.3', environment: 'SANDBOX', lifecycle: 'PENDING_ACTIVATION', activationReadiness: 'EVALUATING', controlStatus: 'ENABLED', currentRevision: 3, instanceCount: 2, updatedAt: '2026-09-16 10:25' },
  { subscriptionId: 'SUB-JN-0004', oemName: '齐鲁智行汽车', applicationName: '弱势交通参与者预警', serviceName: '超视距弱势交通参与者碰撞预警', serviceVersion: '1.5', environment: 'TEST', lifecycle: 'PENDING_ACTIVATION', activationReadiness: 'NOT_EVALUATED', controlStatus: 'ENABLED', currentRevision: 1, instanceCount: 1, updatedAt: '2026-09-16 09:50' },
];

const subscriptionRevisions: readonly SubscriptionRevisionSummary[] = [
  { revisionId: 'SUBREV-JN-0001-R2', subscriptionId: 'SUB-JN-0001', revision: 2, status: 'SUPERSEDED', environment: 'SANDBOX', serviceName: '信号灯提醒服务', scopeSummary: '经十路示范走廊 · 38路口', channelType: 'UU_A', validPeriod: '2026-09-01 00:00 至 2026-12-31 00:00', capabilitySummary: 'CAP-OEM-CONFIRMED-01 · 3个车型系列', changeSummary: '初始审批版本', ownerName: '订阅运营负责人', createdAt: '2026-09-12 14:20' },
  { revisionId: 'SUBREV-JN-0001-R3', subscriptionId: 'SUB-JN-0001', revision: 3, status: 'APPROVED', environment: 'SANDBOX', serviceName: '信号灯提醒服务', scopeSummary: '经十路示范走廊 · 38路口', channelType: 'UU_A', validPeriod: '2026-09-20 00:00 至 2026-11-30 00:00', capabilitySummary: 'CAP-OEM-CONFIRMED-01 · 3个车型系列', changeSummary: '收窄服务期限并更新服务质量要求', ownerName: '赵明', createdAt: '2026-09-16 10:24' },
  { revisionId: 'SUBREV-JN-0004-R1', subscriptionId: 'SUB-JN-0004', revision: 1, status: 'APPROVED', environment: 'TEST', serviceName: '超视距弱势交通参与者碰撞预警', scopeSummary: '济南西站示范区', channelType: 'UU_A', validPeriod: '2026-09-10 00:00 至 2026-10-15 00:00', capabilitySummary: 'CAP-VRU-CONFIRMED-02 · 2个车型系列', changeSummary: '首次审批版本', ownerName: '订阅运营负责人', createdAt: '2026-09-10 09:35' },
];

const revisionDiffs: readonly SubscriptionRevisionDiff[] = [
  { diffId: 'DIFF-JN-0001-R2-R3-001', subscriptionId: 'SUB-JN-0001', fromRevision: 2, toRevision: 3, category: 'NARROWED', field: 'validPeriod', beforeValue: '2026-09-01 00:00 至 2026-12-31 00:00', afterValue: '2026-09-20 00:00 至 2026-11-30 00:00', impact: 'HIGH', requiresRequalification: true },
  { diffId: 'DIFF-JN-0001-R2-R3-002', subscriptionId: 'SUB-JN-0001', fromRevision: 2, toRevision: 3, category: 'MODIFIED', field: 'qualityProfile', beforeValue: 'P95≤5秒 · 可用率≥99%', afterValue: 'P95≤3秒 · 可用率≥99.5%', impact: 'MEDIUM', requiresRequalification: true },
];

const instances: readonly SubscriptionInstanceSummary[] = [
  { instanceId: 'INS-JN-0001-A', subscriptionId: 'SUB-JN-0001', approvedRevisionId: 'SUBREV-JN-0001-R3', effectiveRevisionId: null, environment: 'SANDBOX', coverageSummary: '经十路东段 · 20路口', channelType: 'UU_A', lifecycle: 'PENDING_ACTIVATION', controlStatus: 'ENABLED', activationReadiness: 'EVALUATING', releaseStatus: 'UNKNOWN', runtimeHealth: 'UNKNOWN', evidenceGrade: 'UNKNOWN', updatedAt: '2026-09-16 10:25' },
  { instanceId: 'INS-JN-0001-B', subscriptionId: 'SUB-JN-0001', approvedRevisionId: 'SUBREV-JN-0001-R3', effectiveRevisionId: null, environment: 'SANDBOX', coverageSummary: '经十路西段 · 18路口', channelType: 'UU_A', lifecycle: 'PENDING_ACTIVATION', controlStatus: 'ENABLED', activationReadiness: 'EVALUATING', releaseStatus: 'UNKNOWN', runtimeHealth: 'UNKNOWN', evidenceGrade: 'UNKNOWN', updatedAt: '2026-09-16 10:25' },
  { instanceId: 'INS-JN-0004-A', subscriptionId: 'SUB-JN-0004', approvedRevisionId: 'SUBREV-JN-0004-R1', effectiveRevisionId: null, environment: 'TEST', coverageSummary: '济南西站示范区', channelType: 'UU_A', lifecycle: 'PENDING_ACTIVATION', controlStatus: 'ENABLED', activationReadiness: 'NOT_EVALUATED', releaseStatus: 'UNKNOWN', runtimeHealth: 'UNKNOWN', evidenceGrade: 'UNKNOWN', updatedAt: '2026-09-16 09:50' },
];

const configurations: readonly ConfigurationSummary[] = [
  { configurationId: 'CFG-JN-0001-R3', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-A', serviceName: '信号灯提醒服务', applicationName: '智行交通助手', environment: 'SANDBOX', revision: 3, status: 'READY_FOR_TEST', parameterCount: 12, pendingRequiredFields: 2, coverageSummary: '经十路东段 · 20路口', ownerName: '王琳', updatedAt: '2026-09-16 10:28' },
  { configurationId: 'CFG-JN-0001-R3-B', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-B', serviceName: '信号灯提醒服务', applicationName: '智行交通助手', environment: 'SANDBOX', revision: 3, status: 'DRAFT', parameterCount: 12, pendingRequiredFields: 4, coverageSummary: '经十路西段 · 18路口', ownerName: '王琳', updatedAt: '2026-09-16 10:26' },
  { configurationId: 'CFG-JN-0004-R1', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', applicationName: '弱势交通参与者预警', environment: 'TEST', revision: 1, status: 'BLOCKED', parameterCount: 9, pendingRequiredFields: 1, coverageSummary: '济南西站示范区', ownerName: '周宁', updatedAt: '2026-09-16 09:55' },
];

const configurationDetails: readonly ConfigurationDetail[] = [
  {
    ...configurations[0]!,
    schemaVersion: 'SPAT-UU-A-CONFIG v1.2',
    baseRevision: 'SUBREV-JN-0001-R3',
    scopeHash: 'sha256:cfg-jn-0001-a…72d1',
    changeSummary: '继承已批准订阅范围，补充沙盒环境端点和质量参数。',
    parameters: [
      { parameterId: 'channel.primaryEndpoint', groupName: '接入通道', label: '主接入端点', value: 'https://sandbox-uua.example.invalid/spat', required: true, status: 'SET', source: '订阅申请', validationMessage: '端点格式已登记' },
      { parameterId: 'channel.certificate', groupName: '接入通道', label: '证书引用', value: '证书已登记（不展示私钥）', required: true, status: 'SET', source: 'OEM接入目录', validationMessage: '证书有效期至2026-12-31' },
      { parameterId: 'channel.topicProfile', groupName: '接入通道', label: '消息主题配置', value: 'SPAT-UU-A-BASE', required: true, status: 'SET', source: '服务目录', validationMessage: '与服务版本2.3匹配' },
      { parameterId: 'quality.p95Latency', groupName: '服务质量', label: 'P95端到端延迟', value: '≤ 3 秒', required: true, status: 'SET', source: '审批条件', validationMessage: '需在联合测试中验证' },
      { parameterId: 'quality.availability', groupName: '服务质量', label: '可用率目标', value: '≥ 99.5%', required: true, status: 'SET', source: '审批条件', validationMessage: '需在联合测试中验证' },
      { parameterId: 'display.warningText', groupName: '车端展示', label: '提示文案', value: '前方信号灯状态提醒', required: true, status: 'SET', source: '车企配置', validationMessage: '仅完成配置登记，未证明已展示' },
      { parameterId: 'display.language', groupName: '车端展示', label: '展示语言', value: 'zh-CN', required: true, status: 'SET', source: '车企配置', validationMessage: '格式有效' },
      { parameterId: 'feedback.receiptWindow', groupName: '回执与证据', label: '接收回执窗口', value: '10 秒', required: true, status: 'SET', source: '平台默认值', validationMessage: '等待OEM回执适配器确认' },
      { parameterId: 'feedback.displayEvidence', groupName: '回执与证据', label: '展示证据回传', value: '待确认', required: true, status: 'MISSING', source: '车端回传', validationMessage: '车端日志字段和回传周期尚未确认' },
      { parameterId: 'feedback.interactionEvidence', groupName: '回执与证据', label: '交互证据回传', value: '待确认', required: true, status: 'MISSING', source: '车端回传', validationMessage: '车端交互事件尚未形成生产可用回传' },
    ],
  },
  {
    ...configurations[1]!,
    schemaVersion: 'SPAT-UU-A-CONFIG v1.2',
    baseRevision: 'SUBREV-JN-0001-R3',
    scopeHash: 'sha256:cfg-jn-0001-b…91af',
    changeSummary: '西段实例新建草稿，尚未完成端点、证书和车端证据参数。',
    parameters: [
      { parameterId: 'channel.primaryEndpoint', groupName: '接入通道', label: '主接入端点', value: '待填写', required: true, status: 'MISSING', source: 'OEM接入目录', validationMessage: '请补充当前实例端点' },
      { parameterId: 'channel.certificate', groupName: '接入通道', label: '证书引用', value: '待登记', required: true, status: 'MISSING', source: 'OEM接入目录', validationMessage: '请登记证书引用，不得提交私钥' },
      { parameterId: 'channel.topicProfile', groupName: '接入通道', label: '消息主题配置', value: 'SPAT-UU-A-BASE', required: true, status: 'SET', source: '服务目录', validationMessage: '格式有效' },
      { parameterId: 'display.warningText', groupName: '车端展示', label: '提示文案', value: '待确认', required: true, status: 'MISSING', source: '车企配置', validationMessage: '请确认车端提示文案' },
      { parameterId: 'feedback.displayEvidence', groupName: '回执与证据', label: '展示证据回传', value: '待确认', required: true, status: 'MISSING', source: '车端回传', validationMessage: '请确认车端日志字段和回传周期' },
    ],
  },
  {
    ...configurations[2]!,
    schemaVersion: 'VRU-COLLISION-UU-A-CONFIG v2.0',
    baseRevision: 'SUBREV-JN-0004-R1',
    scopeHash: 'sha256:cfg-jn-0004-a…38cc',
    changeSummary: '弱势交通参与者预警配置缺少风险阈值确认，暂不能进入联合测试。',
    parameters: [
      { parameterId: 'channel.primaryEndpoint', groupName: '接入通道', label: '主接入端点', value: 'https://test-uua.example.invalid/vru', required: true, status: 'SET', source: 'OEM接入目录', validationMessage: '端点格式已登记' },
      { parameterId: 'risk.warningThreshold', groupName: '风险策略', label: '预警阈值', value: '待确认', required: true, status: 'INVALID', source: '车型能力目录', validationMessage: '当前值与车型能力版本不一致' },
      { parameterId: 'risk.minimumConfidence', groupName: '风险策略', label: '最低置信度', value: '0.75', required: true, status: 'SET', source: '服务默认值', validationMessage: '需经联合测试确认' },
      { parameterId: 'display.warningText', groupName: '车端展示', label: '提示文案', value: '前方弱势交通参与者风险', required: true, status: 'SET', source: '车企配置', validationMessage: '仅完成配置登记，未证明已展示' },
      { parameterId: 'feedback.displayEvidence', groupName: '回执与证据', label: '展示证据回传', value: '已登记', required: true, status: 'SET', source: '车端测试回传', validationMessage: '测试回传尚未覆盖全部用例' },
    ],
  },
];

const qualifications: readonly QualificationSummary[] = [
  { qualificationId: 'QAL-JN-0001-A', configurationId: 'CFG-JN-0001-R3', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-A', serviceName: '信号灯提醒服务', environment: 'SANDBOX', testProfile: 'SPAT-UU-A-基础链路 v1.2', status: 'READY', caseCount: 8, passedCount: 0, failedCount: 0, ownerName: '测试负责人', updatedAt: '2026-09-16 10:31' },
  { qualificationId: 'QAL-JN-0001-B', configurationId: 'CFG-JN-0001-R3-B', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-B', serviceName: '信号灯提醒服务', environment: 'SANDBOX', testProfile: 'SPAT-UU-A-基础链路 v1.2', status: 'NOT_STARTED', caseCount: 8, passedCount: 0, failedCount: 0, ownerName: '测试负责人', updatedAt: '2026-09-16 10:26' },
  { qualificationId: 'QAL-JN-0004-A', configurationId: 'CFG-JN-0004-R1', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', environment: 'TEST', testProfile: 'VRU-COLLISION-UU-A v2.0', status: 'BLOCKED', caseCount: 10, passedCount: 0, failedCount: 2, ownerName: '测试负责人', updatedAt: '2026-09-16 09:58' },
];

const qualificationDetails: readonly QualificationDetail[] = [
  {
    ...qualifications[0]!,
    profileVersion: 'SPAT-UU-A-基础链路 v1.2',
    entryGate: '配置状态为 READY_FOR_TEST，端点、证书和消息主题配置已登记',
    inputSnapshot: 'CFG-JN-0001-R3 · sha256:qual-jn-0001-a…3e71',
    executor: '联合测试服务 / 测试负责人',
    testCases: [
      { caseId: 'TC-SPAT-001', caseName: '信号灯状态消息接收', category: '消息接收', requirement: '应在约定窗口内收到SPAT消息', status: 'NOT_STARTED', evidenceGrade: 'UNKNOWN', resultSummary: '等待测试执行', blockerReason: '—', lastObservedAt: '—' },
      { caseId: 'TC-SPAT-002', caseName: '剩余时间字段解析', category: '协议解析', requirement: '剩余时间字段应符合Schema和单位约定', status: 'NOT_STARTED', evidenceGrade: 'UNKNOWN', resultSummary: '等待测试执行', blockerReason: '—', lastObservedAt: '—' },
      { caseId: 'TC-SPAT-003', caseName: '车端展示触发', category: '车端展示', requirement: '消息应形成可关联的展示证据', status: 'NOT_STARTED', evidenceGrade: 'UNKNOWN', resultSummary: '等待车端回传', blockerReason: '展示证据通道尚未接入', lastObservedAt: '—' },
      { caseId: 'TC-SPAT-004', caseName: '异常消息处理', category: '异常处理', requirement: '消息超时或字段异常时应按规则降级', status: 'NOT_STARTED', evidenceGrade: 'UNKNOWN', resultSummary: '等待测试执行', blockerReason: '—', lastObservedAt: '—' },
    ],
  },
  {
    ...qualifications[1]!,
    profileVersion: 'SPAT-UU-A-基础链路 v1.2',
    entryGate: '配置仍为 DRAFT，必要端点和车端证据参数未齐全',
    inputSnapshot: 'CFG-JN-0001-R3-B · sha256:qual-jn-0001-b…6a91',
    executor: '联合测试服务 / 测试负责人',
    testCases: [
      { caseId: 'TC-SPAT-B01', caseName: '测试端点连通性', category: '接入通道', requirement: '测试端点和证书应可建立连接', status: 'BLOCKED', evidenceGrade: 'UNKNOWN', resultSummary: '尚未执行', blockerReason: '配置缺少主接入端点和证书引用', lastObservedAt: '—' },
      { caseId: 'TC-SPAT-B02', caseName: '消息接收与解析', category: '消息接收', requirement: '应能接收并解析SPAT消息', status: 'BLOCKED', evidenceGrade: 'UNKNOWN', resultSummary: '尚未执行', blockerReason: '前置连通性测试未满足', lastObservedAt: '—' },
    ],
  },
  {
    ...qualifications[2]!,
    profileVersion: 'VRU-COLLISION-UU-A v2.0',
    entryGate: '配置存在风险阈值校验不通过，禁止开始联合测试',
    inputSnapshot: 'CFG-JN-0004-R1 · sha256:qual-jn-0004-a…8b40',
    executor: '联合测试服务 / 测试负责人',
    testCases: [
      { caseId: 'TC-VRU-001', caseName: '弱势交通参与者事件接收', category: '消息接收', requirement: '应接收风险事件并保留事件编号', status: 'FAILED', evidenceGrade: 'F1', resultSummary: '接收链路可用，但事件关联字段缺失', blockerReason: '实例级关联字段未补齐', lastObservedAt: '2026-09-16 10:04' },
      { caseId: 'TC-VRU-002', caseName: '风险等级映射', category: '风险策略', requirement: '风险等级应与车型能力和配置阈值一致', status: 'FAILED', evidenceGrade: 'UNKNOWN', resultSummary: '阈值校验不通过', blockerReason: '配置参数 risk.warningThreshold 与能力版本不一致', lastObservedAt: '2026-09-16 10:02' },
      { caseId: 'TC-VRU-003', caseName: '车端碰撞预警展示', category: '车端展示', requirement: '应形成展示证据并关联事件编号', status: 'BLOCKED', evidenceGrade: 'UNKNOWN', resultSummary: '未执行', blockerReason: '前置风险策略校验失败', lastObservedAt: '—' },
      { caseId: 'TC-VRU-004', caseName: '事件关闭与回执', category: '回执闭环', requirement: '应保留测试回执和关闭依据', status: 'BLOCKED', evidenceGrade: 'UNKNOWN', resultSummary: '未执行', blockerReason: '前置测试未通过', lastObservedAt: '—' },
    ],
  },
];

const releasePlans: readonly ReleasePlanSummary[] = [
  { releasePlanId: 'REL-JN-0001-A', qualificationId: 'QAL-JN-0001-A', configurationId: 'CFG-JN-0001-R3', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-A', serviceName: '信号灯提醒服务', environment: 'SANDBOX', strategy: 'CANARY', targetTime: '待测试通过后排期', nodeCount: 3, completedNodeCount: 0, status: 'READY', ownerName: '发布负责人', updatedAt: '2026-09-16 10:32' },
  { releasePlanId: 'REL-JN-0001-B', qualificationId: 'QAL-JN-0001-B', configurationId: 'CFG-JN-0001-R3-B', subscriptionId: 'SUB-JN-0001', instanceId: 'INS-JN-0001-B', serviceName: '信号灯提醒服务', environment: 'SANDBOX', strategy: 'FULL', targetTime: '未排期', nodeCount: 3, completedNodeCount: 0, status: 'BLOCKED', ownerName: '发布负责人', updatedAt: '2026-09-16 10:26' },
  { releasePlanId: 'REL-JN-0004-A', qualificationId: 'QAL-JN-0004-A', configurationId: 'CFG-JN-0004-R1', subscriptionId: 'SUB-JN-0004', instanceId: 'INS-JN-0004-A', serviceName: '超视距弱势交通参与者碰撞预警', environment: 'TEST', strategy: 'CANARY', targetTime: '2026-09-17 09:00', nodeCount: 5, completedNodeCount: 2, status: 'FAILED', ownerName: '发布负责人', updatedAt: '2026-09-16 10:02' },
];

const releasePlanDetails: readonly ReleasePlanDetail[] = [
  {
    ...releasePlans[0]!,
    releaseVersion: 'SVC-SPAT-2.3 / CFG-JN-0001-R3',
    entryGate: '当前测试任务已就绪；执行前仍需完成联合测试并生成有效结果',
    changeWindow: '待联合测试通过后排期',
    rollbackPlan: '按实例回退至上一已批准版本；回退回执需由发布服务生成',
    prerequisiteSummary: '配置摘要可用；车端展示与交互证据仍需通过测试和回传确认',
    nodes: [
      { nodeId: 'NODE-JN-0001-A1', nodeName: '平台服务节点', targetScope: '平台路由 / 沙箱', status: 'PENDING', observedAt: '—', receiptSummary: '等待执行', blockerReason: '需先完成联合测试' },
      { nodeId: 'NODE-JN-0001-A2', nodeName: '车企云接入节点', targetScope: '齐鲁智行 · 沙箱', status: 'PENDING', observedAt: '—', receiptSummary: '等待执行', blockerReason: '需先完成联合测试' },
      { nodeId: 'NODE-JN-0001-A3', nodeName: '示范走廊实例', targetScope: '经十路东段 · 20路口', status: 'PENDING', observedAt: '—', receiptSummary: '等待执行', blockerReason: '需先完成联合测试' },
    ],
  },
  {
    ...releasePlans[1]!,
    releaseVersion: 'SVC-SPAT-2.3 / CFG-JN-0001-R3-B',
    entryGate: '配置为 DRAFT，联合测试任务未开始，禁止排期和执行',
    changeWindow: '未排期',
    rollbackPlan: '未生成回退计划；需先完成配置和测试准入',
    prerequisiteSummary: '主接入端点、证书引用和车端展示参数缺失',
    nodes: [
      { nodeId: 'NODE-JN-0001-B1', nodeName: '平台服务节点', targetScope: '平台路由 / 沙箱', status: 'BLOCKED', observedAt: '—', receiptSummary: '未执行', blockerReason: '配置必填参数未补齐' },
      { nodeId: 'NODE-JN-0001-B2', nodeName: '车企云接入节点', targetScope: '齐鲁智行 · 沙箱', status: 'BLOCKED', observedAt: '—', receiptSummary: '未执行', blockerReason: '联合测试未开始' },
      { nodeId: 'NODE-JN-0001-B3', nodeName: '示范走廊实例', targetScope: '经十路西段 · 18路口', status: 'BLOCKED', observedAt: '—', receiptSummary: '未执行', blockerReason: '联合测试未开始' },
    ],
  },
  {
    ...releasePlans[2]!,
    releaseVersion: 'SVC-VRU-1.5 / CFG-JN-0004-R1',
    entryGate: '联合测试存在失败项，风险阈值与车型能力版本不一致',
    changeWindow: '2026-09-17 09:00（已暂停）',
    rollbackPlan: '停止后保留已完成节点回执；禁止将部分完成标记为成功',
    prerequisiteSummary: '接收节点已有回执，但风险等级映射和车端展示尚未通过',
    nodes: [
      { nodeId: 'NODE-JN-0004-A1', nodeName: '平台服务节点', targetScope: '平台路由 / 测试', status: 'SUCCEEDED', observedAt: '2026-09-16 10:02', receiptSummary: '节点回执已确认', blockerReason: '—' },
      { nodeId: 'NODE-JN-0004-A2', nodeName: '车企云接入节点', targetScope: '齐鲁智行 · 测试', status: 'FAILED', observedAt: '2026-09-16 10:04', receiptSummary: '回执关联字段缺失', blockerReason: '实例级回执关联未补齐' },
      { nodeId: 'NODE-JN-0004-A3', nodeName: '车端展示实例', targetScope: '济南西站示范区', status: 'BLOCKED', observedAt: '—', receiptSummary: '未执行', blockerReason: '前置测试失败，禁止继续发布' },
      { nodeId: 'NODE-JN-0004-A4', nodeName: '回退校验节点', targetScope: '测试环境回退链路', status: 'ROLLBACK_REQUIRED', observedAt: '—', receiptSummary: '等待回退计划', blockerReason: '发布部分完成，需要服务端生成回退指令' },
      { nodeId: 'NODE-JN-0004-A5', nodeName: '交付证据节点', targetScope: '接收 / 展示 / 交互证据', status: 'BLOCKED', observedAt: '—', receiptSummary: '未执行', blockerReason: '不以发布状态推断车辆端证据' },
    ],
  },
];

const endpointEvidence: EvidenceSummary = {
  evidenceRef: 'EVD-ENDPOINT-240916-003',
  objectType: 'EndpointRevision',
  objectId: 'EP-QILU-UUA-01',
  revision: '7',
  contentHash: 'sha256:93b33e1d…2a10',
  source: 'FR-3 接入资源目录',
  verificationStatus: 'VERIFIED',
  accessLevel: 'CONTROLLED',
  validUntil: '2026-12-31 23:59:59+08:00',
};

const capabilityEvidence: EvidenceSummary = {
  evidenceRef: 'EVD-CAP-240916-011',
  objectType: 'CapabilityGroupRevision',
  objectId: 'CAP-OEM-CONFIRMED-01',
  revision: '4',
  contentHash: 'sha256:62b582d4…d931',
  source: 'FR-1 车型能力目录',
  verificationStatus: 'VERIFIED',
  accessLevel: 'NORMAL',
  validUntil: '2026-11-30 23:59:59+08:00',
};

const precheckFindings: readonly PrecheckFinding[] = [
  { findingId: 'FND-240916-001', ruleId: 'AUTH-ENTITLEMENT-001', ruleName: '权益范围与申请主体一致', layer: 'AUTHORIZATION', severity: 'CRITICAL', expected: '申请企业、应用、服务、环境及服务范围均位于有效权益版本范围内', actual: 'ENT-JN-SANDBOX-001覆盖齐鲁智行汽车、APP-QILU-TRAFFIC-01、沙盒环境及经十路示范走廊', outcome: 'PASS', validity: 'CURRENT', reasonCode: 'AUTH_SCOPE_MATCHED', ownerName: '权益服务负责人', nextAction: '无', dueAt: '—', evidence: [capabilityEvidence] },
  { findingId: 'FND-240916-002', ruleId: 'CONTRACT-SCOPE-004', ruleName: '订阅范围规范化交集', layer: 'CONTRACT', severity: 'HIGH', expected: '服务范围、车型能力、时段和有效期均不超过上游交集', actual: '范围校验码匹配；有效期收窄至2026-11-30', outcome: 'CONDITION', validity: 'CURRENT', reasonCode: 'VALIDITY_NARROWED', ownerName: '申请人赵明', nextAction: '提交时确认收窄后的有效期', dueAt: '2026-09-18 18:00', evidence: [capabilityEvidence], remediationCaseId: 'REM-240916-001' },
  { findingId: 'FND-240916-003', ruleId: 'QUALITY-SERVICE-003', ruleName: '服务质量要求可满足', layer: 'QUALIFICATION', severity: 'HIGH', expected: '端到端P95延迟≤3秒、可用率≥99.5%', actual: '沙箱近7日P95 2.1秒、可用率99.72%', outcome: 'PASS', validity: 'CURRENT', reasonCode: 'QUALITY_PROFILE_MATCHED', ownerName: '服务质量负责人', nextAction: '联合测试阶段继续验证', dueAt: '—', evidence: [endpointEvidence] },
  { findingId: 'FND-240916-004', ruleId: 'ACCESS-CREDENTIAL-002', ruleName: '端点与凭证有效', layer: 'ACCESS', severity: 'CRITICAL', expected: 'Uu-A主端点、证书、消息主题配置均有效且属于当前应用', actual: '端点版本7已登记；证书有效期至2026-12-31；私钥未进入业务数据', outcome: 'PASS', validity: 'CURRENT', reasonCode: 'ENDPOINT_CREDENTIAL_VALID', ownerName: '车企云接入负责人', nextAction: '无', dueAt: '—', evidence: [endpointEvidence] },
  { findingId: 'FND-240916-005', ruleId: 'CONNECT-CAPACITY-006', ruleName: '沙盒环境连接容量满足', layer: 'CONNECTIVITY', severity: 'WARNING', expected: '目标峰值80 TPS且保留20%容量余量', actual: '可用容量120 TPS，预计峰值80 TPS', outcome: 'PASS', validity: 'CURRENT', reasonCode: 'CAPACITY_AVAILABLE', ownerName: '通道运营负责人', nextAction: '生产环境需重新评估', dueAt: '—', evidence: [endpointEvidence] },
];

const submissionFindings: readonly PrecheckFinding[] = precheckFindings.map((finding, index) => {
  const { remediationCaseId: _discard, ...rest } = finding;
  void _discard;
  return { ...rest, findingId: `FND-240916-10${index + 1}` };
});

const precheckRun: PrecheckRunDetail = {
  runId: 'PCR-240916-001',
  requestId: 'REQ-240916-001',
  requestRevision: 3,
  inputSnapshotId: 'PCIS-240916-001',
  inputHash: 'sha256:56ccf99a…c204',
  ruleSetVersion: 'FR2-PRECHECK-1.0.0',
  runStatus: 'COMPLETED',
  outcome: 'PASS_WITH_CONDITIONS',
  validity: 'CURRENT',
  startedAt: '2026-09-16 10:18:22+08:00',
  completedAt: '2026-09-16 10:18:41+08:00',
  progress: 100,
  riskLevel: 'HIGH',
  layers: [
    { layer: 'AUTHORIZATION', label: '授权/权益', passed: 8, conditions: 0, blocked: 0, unknown: 0, expired: 0, evaluatedAt: '10:18:28' },
    { layer: 'CONTRACT', label: '订阅契约', passed: 11, conditions: 1, blocked: 0, unknown: 0, expired: 0, evaluatedAt: '10:18:31' },
    { layer: 'QUALIFICATION', label: '质量/资格', passed: 7, conditions: 0, blocked: 0, unknown: 0, expired: 0, evaluatedAt: '10:18:34' },
    { layer: 'ACCESS', label: '访问/凭证', passed: 6, conditions: 0, blocked: 0, unknown: 0, expired: 0, evaluatedAt: '10:18:37' },
    { layer: 'CONNECTIVITY', label: '连接/容量', passed: 5, conditions: 0, blocked: 0, unknown: 0, expired: 0, evaluatedAt: '10:18:41' },
  ],
  findings: precheckFindings,
  referencedByApprovalCaseId: 'APR-240916-001',
};

const submissionPrecheckRun: PrecheckRunDetail = {
  runId: 'PCR-240916-003',
  requestId: 'REQ-240916-003',
  requestRevision: 1,
  inputSnapshotId: 'PCIS-240916-003',
  inputHash: 'sha256:56ccf99a…c205',
  ruleSetVersion: precheckRun.ruleSetVersion,
  runStatus: 'COMPLETED',
  outcome: 'PASS_WITH_CONDITIONS',
  validity: 'CURRENT',
  startedAt: '2026-09-16 10:18:22+08:00',
  completedAt: '2026-09-16 10:18:41+08:00',
  progress: 100,
  riskLevel: 'HIGH',
  layers: precheckRun.layers,
  findings: submissionFindings,
};

const submissionContext: SubmissionContext = {
  requestId: 'REQ-240916-003',
  draftRevision: 1,
  oemName: '齐鲁智行汽车',
  applicationName: '智行交通助手',
  entitlementRevision: 'ENT-JN-SANDBOX-001@5',
  applicationClientId: 'APP-QILU-TRAFFIC-01',
  environment: 'SANDBOX',
  contentHash: 'sha256:01c999d0…8f4a',
  generatedAt: '2026-09-16 10:20:02+08:00',
  summaryValidity: 'CURRENT',
  serviceName: '信号灯提醒服务 v2.3',
  purpose: '面向已确认车型提供路口信号灯状态与通行提醒',
  capabilityGroup: 'CAP-OEM-CONFIRMED-01 · 3个车型系列',
  coverage: '经十路示范走廊 · 38路口 · 双向',
  schedule: '每日 06:00—23:00 · Asia/Shanghai',
  channelProfile: '平台向车企云提供数据；主接入端点已核验',
  qualityProfile: 'P95≤3秒 · 可用率≥99.5% · TTL 8秒',
  feedbackProfile: '接收、展示、交互三级反馈；车辆真实使用证据不在当前范围',
  validPeriod: '2026-09-20 00:00 至 2026-11-30 00:00（截止时刻，不含11月30日）',
  responsibility: '城市负责权威服务与平台投递；OEM负责云端接收、车内适配和自身合规',
  exitObligation: '到期或撤权后停止新增投递、关闭会话并完成退出证据核验',
  scopeHash: 'sha256:95b7f11e…e3c2',
  reasonCodeVersion: 'FR2-REASON-1.0.0',
  precheck: submissionPrecheckRun,
  changes: [],
};

const remediationCase: RemediationCaseDetail = {
  caseId: 'REM-240916-001',
  status: 'PENDING_VERIFY',
  sourceType: 'PRECHECK_FINDING',
  sourceId: 'FND-240916-002',
  requestId: 'REQ-240916-001',
  requestRevision: 3,
  precheckRunId: 'PCR-240916-001',
  ruleId: 'CONTRACT-SCOPE-004',
  issueSummary: '申请有效期超过车型能力版本的最早到期时间',
  affectedScope: '齐鲁智行汽车 / 智行交通助手 / 经十路示范走廊',
  remediationType: 'SCOPE_NARROWING_CONFIRMATION',
  ownerName: '赵明',
  collaborators: ['车型能力负责人', '订阅运营王琳'],
  dueAt: '2026-09-18 18:00',
  requiredEvidence: '申请人确认收窄后的有效期，并引用有效车型能力版本',
  nextAction: '独立验证人核验版本3摘要与预检输入一致',
  priority: 'HIGH',
  verifierName: '陈雨（独立验证）',
  evidence: [capabilityEvidence],
  history: [
    { time: '2026-09-16 10:19', actor: '规则引擎', action: '创建补正建议', detail: 'Finding FND-240916-002产生有效期收窄候选' },
    { time: '2026-09-16 10:23', actor: '王琳', action: '指派负责人', detail: '指派赵明，期限2026-09-18 18:00' },
    { time: '2026-09-16 10:40', actor: '赵明', action: '提交处理', detail: '确认有效期至2026-11-30并引用能力版本4' },
  ],
};

const approvalCase: ApprovalCaseDetail = {
  approvalCaseId: 'APR-240916-001',
  requestId: 'REQ-240916-001',
  requestRevision: 3,
  requestContentHash: submissionContext.contentHash,
  precheckRunId: precheckRun.runId,
  approvalMatrixVersion: 'APPROVAL-MATRIX-HIGH-1.2',
  status: 'IN_REVIEW',
  riskLevel: 'HIGH',
  applicantName: '赵明',
  applicantId: 'OEM-QILU-APPLICANT-01',
  serviceName: '信号灯提醒服务 v2.3',
  oemName: '齐鲁智行汽车',
  applicationName: '智行交通助手',
  environment: 'SANDBOX',
  scopeSummary: '经十路示范走廊 · 38路口 · 3个车型系列 · 车企云接入',
  entitlementLimit: '仅沙盒环境；服务截止不晚于2026-11-30 00:00；不含车辆直连及测试专用通道',
  precheckOutcome: 'PASS_WITH_CONDITIONS',
  precheckValidity: 'CURRENT',
  hardBlockerCount: 0,
  currentAssigneeId: 'U-APPROVER-001',
  currentAssigneeName: '订阅审批人',
  dueAt: '2026-09-17 18:00',
  sodPassed: true,
  nodes: [
    { nodeId: 'NODE-BIZ', nodeName: '业务范围复核', assigneeName: '订阅审批人', status: 'IN_REVIEW', dueAt: '2026-09-17 18:00' },
    { nodeId: 'NODE-SEC', nodeName: '安全与合规会签', assigneeName: '安全审核组', status: 'PENDING', dueAt: '2026-09-18 12:00', parallelGroup: 'G2' },
    { nodeId: 'NODE-TEST', nodeName: '联合验证要求', assigneeName: '测试负责人', status: 'PENDING', dueAt: '2026-09-18 12:00', parallelGroup: 'G2' },
  ],
  conditionCandidates: [
    { candidateId: 'PCC-240916-001', sourceFindingId: 'FND-240916-002', candidateType: 'SCOPE_RESTRICTION', description: '订阅有效期不得晚于2026-11-30', hardGate: true },
  ],
};

const submittedApprovalCase: ApprovalCaseDetail = {
  ...approvalCase,
  approvalCaseId: 'APR-240916-003',
  requestId: submissionContext.requestId,
  requestRevision: submissionContext.draftRevision,
  requestContentHash: submissionContext.contentHash,
  precheckRunId: submissionPrecheckRun.runId,
  conditionCandidates: [{ candidateId: 'PCC-240916-003', sourceFindingId: 'FND-240916-102', candidateType: 'SCOPE_RESTRICTION', description: '订阅有效期不得晚于2026-11-30', hardGate: true }],
};

const approvalCaseSummaries: readonly ApprovalCaseSummary[] = [
  { approvalCaseId: 'APR-240916-001', requestId: 'REQ-240916-001', requestRevision: 3, status: 'IN_REVIEW', riskLevel: 'HIGH', serviceName: '信号灯提醒服务 v2.3', oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', currentAssigneeId: 'U-APPROVER-001', currentAssigneeName: '订阅审批人', dueAt: '2026-09-17 18:00', precheckOutcome: 'PASS_WITH_CONDITIONS', hardBlockerCount: 0, updatedAt: '2026-09-16 10:24' },
  { approvalCaseId: 'APR-240916-003', requestId: 'REQ-240916-003', requestRevision: 1, status: 'PENDING', riskLevel: 'HIGH', serviceName: '信号灯提醒服务 v2.3', oemName: '齐鲁智行汽车', applicationName: '智行交通助手', environment: 'SANDBOX', currentAssigneeId: 'U-APPROVER-001', currentAssigneeName: '订阅审批人', dueAt: '2026-09-18 18:00', precheckOutcome: 'PASS_WITH_CONDITIONS', hardBlockerCount: 0, updatedAt: '2026-09-16 10:20' },
];

function restoreMockMap<T>(key: string): Map<string, T> {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? new Map(entries as [string, T][]) : new Map();
  } catch {
    return new Map();
  }
}

function saveMockMap<T>(key: string, map: Map<string, T>): void {
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify([...map.entries()]));
  } catch {
    // 沙箱存储不可用时退回内存态；不影响真实系统数据。
  }
}

const submissionReceipts = restoreMockMap<SubmissionReceipt>('vrc-sandbox-submission-receipts');
const decisionReceipts = restoreMockMap<{ fingerprint: string; receipt: ApprovalDecisionReceipt }>('vrc-sandbox-decision-receipts');
const roleAssignmentChangeReceipts = restoreMockMap<{ fingerprint: string; receipt: RoleAssignmentChangeReceipt }>('vrc-sandbox-role-assignment-change-receipts');
const partnerOnboardingReceipts = restoreMockMap<{ fingerprint: string; receipt: PartnerOnboardingReceipt }>('vrc-sandbox-partner-onboarding-receipts');
const partnerLifecycleChangeReceipts = restoreMockMap<{ fingerprint: string; receipt: PartnerLifecycleChangeReceipt }>('vrc-sandbox-partner-lifecycle-change-receipts');
const applicationAccessActionReceipts = restoreMockMap<{ fingerprint: string; receipt: ApplicationAccessActionReceipt }>('vrc-sandbox-application-access-action-receipts');
const accessReviewReceipts = restoreMockMap<{ fingerprint: string; receipt: AccessReviewRequestReceipt }>('vrc-sandbox-access-review-receipts');
const rolePermissionConfigChangeReceipts = restoreMockMap<{ fingerprint: string; receipt: RolePermissionConfigChangeReceipt }>('vrc-sandbox-role-permission-config-change-receipts');
const configurationChangeReceipts = restoreMockMap<{ fingerprint: string; receipt: ConfigurationChangeReceipt }>('vrc-sandbox-configuration-change-receipts');
const qualificationExecutionReceipts = restoreMockMap<{ fingerprint: string; receipt: QualificationExecutionReceipt }>('vrc-sandbox-qualification-execution-receipts');
const releaseExecutionReceipts = restoreMockMap<{ fingerprint: string; receipt: ReleaseExecutionReceipt }>('vrc-sandbox-release-execution-receipts');
const remediationActionReceipts = restoreMockMap<{ fingerprint: string; receipt: RemediationActionReceipt }>('vrc-sandbox-remediation-action-receipts');
const incidentActionReceipts = restoreMockMap<{ fingerprint: string; receipt: IncidentActionReceipt }>('vrc-sandbox-incident-action-receipts');
const subscriptionChangeReceipts = restoreMockMap<{ fingerprint: string; receipt: SubscriptionChangeReceipt }>('vrc-sandbox-subscription-change-receipts');
const controlPlanReceipts = restoreMockMap<{ fingerprint: string; receipt: ControlPlanReceipt }>('vrc-sandbox-control-plan-receipts');
interface DraftSessionRecord {
  fingerprint: string;
  input: SubscriptionDraftInput;
  receipt: SubscriptionDraftReceipt;
  context: SubmissionContext;
  precheck: PrecheckRunDetail;
  approvalCase: ApprovalCaseDetail;
  submissionReceipt?: SubmissionReceipt;
}
const draftSessionRecords = restoreMockMap<DraftSessionRecord>('vrc-sandbox-subscription-drafts');

const coverageLabels: Readonly<Record<string, string>> = {
  'COV-JINGSHI-038': '经十路示范走廊 · 38路口',
  'COV-JINAN-WEST-001': '济南西站示范区',
};

/**
 * 统一模拟服务端的对象级数据范围门禁。
 * 页面守卫只能控制导航，所有详情和写操作仍必须在数据层按环境、租户和范围复核。
 */
function assertScoped<T>(record: T, errorCode: string): void {
  if (getDataScopeContext() && !filterScoped([record]).length) throw new Error(errorCode);
}

/** 本地服务层也复核操作权限，避免仅依赖页面按钮守卫；生产实现应由 API 网关/IAM 执行同等策略。 */
function assertPermission(permission: PermissionCode): void {
  const actor = getDataScopeContext();
  if (actor && !effectivePermissions(actor).has(permission)) throw new Error('PERMISSION_DENIED');
}

function requestScopeRecord(requestId: string): { requestId: string; environment: SubscriptionRequestSummary['environment']; oemName: string } | null {
  const draft = [...draftSessionRecords.values()].find((record) => record.receipt.requestId === requestId);
  if (draft) return draft.context;
  if (requestId === submissionContext.requestId) return submissionContext;
  const request = requests.find((item) => item.requestId === requestId);
  return request ? { requestId: request.requestId, environment: request.environment, oemName: request.oemName } : null;
}

function assertRequestScoped(requestId: string, errorCode: string): void {
  const scopeRecord = requestScopeRecord(requestId);
  if (scopeRecord) assertScoped(scopeRecord, errorCode);
}

function precheckRunScoped(run: PrecheckRunDetail): boolean {
  const scopeRecord = requestScopeRecord(run.requestId);
  return !scopeRecord || !getDataScopeContext() || filterScoped([scopeRecord]).length > 0;
}

function draftSummary(record: DraftSessionRecord): SubscriptionRequestSummary {
  const entitlement = entitlements.find((item) => item.entitlementId === record.input.entitlementId);
  const service = catalog.find((item) => item.serviceId === record.input.serviceId);
  const submitted = record.submissionReceipt;
  return {
    requestId: record.receipt.requestId,
    requestRevision: record.receipt.requestRevision,
    oemName: entitlement?.oemName ?? '当前租户',
    applicationName: entitlement?.applicationName ?? record.input.applicationClientId,
    environment: entitlement?.environment ?? 'SANDBOX',
    serviceName: service ? `${service.serviceName} v${service.serviceVersion}` : record.input.serviceId,
    channelType: record.input.channelType,
    coverageSummary: coverageLabels[record.input.coverageId] ?? record.input.coverageId,
    requestStatus: submitted ? 'SUBMITTED' : 'DRAFT',
    precheckOutcome: record.context.precheck.outcome,
    precheckValidity: record.context.precheck.validity,
    blockerCount: record.context.precheck.layers.reduce((total, layer) => total + layer.blocked + layer.unknown + layer.expired, 0),
    ownerName: '当前申请人',
    updatedAt: submitted?.submittedAt ?? record.receipt.createdAt,
    etag: `W/"${record.receipt.requestId.toLowerCase()}-r${record.receipt.requestRevision}"`,
  };
}

export const subscriptionRepository = {
  async listCatalog(search = ''): Promise<PageResult<ServiceCatalogSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? catalog.filter((item) => [item.serviceId, item.serviceName, item.description, item.coverageSummary, ...item.scenarioTags].some((value) => value.toLowerCase().includes(keyword)))
      : catalog;
    const items = matched.filter((item) => anyEnvironmentVisible(item.supportedEnvironments));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listEntitlements(search = ''): Promise<PageResult<EntitlementSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? entitlements.filter((item) => [item.entitlementId, item.serviceId, item.serviceName, item.oemName, item.applicationName, item.coverageSummary].some((value) => value.toLowerCase().includes(keyword)))
      : entitlements;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listEvidence(search = ''): Promise<PageResult<DeliveryEvidenceSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? evidence.filter((item) => [item.evidenceId, item.releasePlanId, item.subscriptionId, item.instanceId, item.serviceName, item.sourceSystem].some((value) => value.toLowerCase().includes(keyword)))
      : evidence;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async getEvidence(evidenceId: string): Promise<DeliveryEvidenceDetail> {
    const detail = evidenceDetails.find((item) => item.evidenceId === evidenceId);
    if (!detail || !filterScoped([detail]).length) throw new Error('EVIDENCE_NOT_FOUND');
    return detail;
  },
  async listIncidents(search = ''): Promise<PageResult<IncidentSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? incidents.filter((item) => [item.incidentId, item.subscriptionId, item.instanceId, item.serviceName, item.summary, item.ownerName].some((value) => value.toLowerCase().includes(keyword)))
      : incidents;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async getIncident(incidentId: string): Promise<IncidentDetail> {
    const detail = incidentDetails.find((item) => item.incidentId === incidentId);
    if (!detail || !filterScoped([detail]).length) throw new Error('INCIDENT_NOT_FOUND');
    return detail;
  },
  async recordIncidentAction(input: IncidentActionInput, idempotencyKey: string): Promise<IncidentActionReceipt> {
    assertPermission('FR5.INCIDENT.UPDATE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: IncidentActionInput = {
      ...input,
      incidentId: input.incidentId.trim(),
      note: input.note.trim(),
      ...(input.ownerName?.trim() ? { ownerName: input.ownerName.trim() } : {}),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = incidentActionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const detail = incidentDetails.find((item) => item.incidentId === normalizedInput.incidentId);
    if (!detail) throw new Error('INCIDENT_NOT_FOUND');
    assertScoped(detail, 'INCIDENT_OUT_OF_SCOPE');
    const validActions: readonly IncidentActionInput['action'][] = ['ACKNOWLEDGE', 'ASSIGN', 'RESOLVE'];
    const validReasons: Readonly<Record<IncidentActionInput['action'], IncidentActionInput['reasonCode']>> = {
      ACKNOWLEDGE: 'CONFIRM_RECEIPT',
      ASSIGN: 'OWNER_HANDOFF',
      RESOLVE: 'RECOVERY_VERIFIED',
    };
    if (!validActions.includes(normalizedInput.action) || validReasons[normalizedInput.action] !== normalizedInput.reasonCode || !normalizedInput.note) {
      throw new Error('INCIDENT_ACTION_INPUT_INVALID');
    }
    if (normalizedInput.action === 'ASSIGN' && !normalizedInput.ownerName) throw new Error('INCIDENT_ACTION_OWNER_REQUIRED');
    const hasRecoveryEvidence = Boolean(detail.recoveryEvidence) && ['已恢复', '恢复采集', '恢复验证', '已核验'].some((token) => detail.recoveryEvidence.includes(token));
    if (normalizedInput.action === 'RESOLVE' && !hasRecoveryEvidence) {
      throw new Error('INCIDENT_RESOLVE_EVIDENCE_REQUIRED');
    }
    if (normalizedInput.action === 'ACKNOWLEDGE' && ['RESOLVED', 'CLOSED'].includes(detail.status)) throw new Error('INCIDENT_ACTION_STATE_INVALID');
    if (normalizedInput.action === 'RESOLVE' && ['RESOLVED', 'CLOSED'].includes(detail.status)) throw new Error('INCIDENT_ACTION_STATE_INVALID');
    const receipt: IncidentActionReceipt = {
      actionId: `INC-ACT-JN-${String(incidentActionReceipts.size + 1).padStart(4, '0')}`,
      status: 'RECORDED',
      incidentId: normalizedInput.incidentId,
      action: normalizedInput.action,
      ...(normalizedInput.ownerName ? { ownerName: normalizedInput.ownerName } : {}),
      note: normalizedInput.note,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-16 12:10:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '处置意图已记录；事件状态和责任归属仍以监控、工单及证据回传系统的后续事实为准。',
    };
    incidentActionReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-incident-action-receipts', incidentActionReceipts);
    return receipt;
  },
  async listIncidentActionReceipts(): Promise<PageResult<IncidentActionReceipt>> {
    const items = [...incidentActionReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const incident = incidents.find((item) => item.incidentId === receipt.incidentId);
        return !incident || !getDataScopeContext() || filterScoped([incident]).length > 0;
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 12:10:00+08:00' };
  },
  async listAuditEvents(search = ''): Promise<PageResult<AuditEventSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? auditEvents.filter((item) => [item.eventId, item.actorId, item.actorName, item.permission, item.actionLabel, item.reasonCode, item.reason, item.resourceType, item.resourceId, item.traceId].some((value) => value.toLowerCase().includes(keyword)))
      : auditEvents;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async listRoleAssignments(search = ''): Promise<PageResult<RoleAssignmentSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? roleAssignments.filter((item) => [item.assignmentId, item.subjectId, item.subjectName, item.subjectType === 'SERVICE_ACCOUNT' ? '服务账号' : item.subjectType === 'ORGANIZATION' ? '组织' : '用户', item.organizationName, item.roleCode, item.scopeSummary, item.status, item.requestId ?? ''].some((value) => value.toLowerCase().includes(keyword)))
      : roleAssignments;
    const items = filterScoped(matched).filter((item) => anyEnvironmentVisible(item.environments));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async listAccessReviews(search = ''): Promise<PageResult<AccessReviewSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? accessReviews.filter((item) => [item.reviewId, item.subjectId, item.subjectName, item.subjectType, item.tenantId, ...item.roleCodes, item.resourceSummary, item.actionSummary, item.dataClassification, item.status, item.reviewResult, item.reviewerName].some((value) => value.toLowerCase().includes(keyword)))
      : accessReviews;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 09:41:00+08:00' };
  },
  async requestAccessReview(input: AccessReviewRequestInput, idempotencyKey: string): Promise<AccessReviewRequestReceipt> {
    assertPermission('GOVERNANCE.ACCESS_REVIEW.REQUEST');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: AccessReviewRequestInput = { ...input, reviewId: input.reviewId.trim(), reasonCode: input.reasonCode.trim(), comment: input.comment.trim() };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = accessReviewReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const review = accessReviews.find((item) => item.reviewId === normalizedInput.reviewId);
    if (!review) throw new Error('ACCESS_REVIEW_NOT_FOUND');
    assertScoped(review, 'ACCESS_REVIEW_OUT_OF_SCOPE');
    const actor = getDataScopeContext();
    if (actor && review.subjectId === actor.actorId) throw new Error('ACCESS_REVIEW_SELF_ACTION');
    if (!['RETAIN', 'NARROW', 'REVOKE'].includes(normalizedInput.result) || !normalizedInput.reasonCode || normalizedInput.comment.length < 10) throw new Error('ACCESS_REVIEW_INPUT_INVALID');
    const receipt: AccessReviewRequestReceipt = {
      requestId: `AR-REQ-JN-${String(accessReviewReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL', reviewId: normalizedInput.reviewId, result: normalizedInput.result,
      submittedAt: '2026-09-17 10:10:00+08:00', idempotencyKey: normalizedKey,
      nextStep: normalizedInput.result === 'RETAIN' ? '等待安全管理员复核并确认继续保留当前访问范围；审批通过前不延长有效期。' : normalizedInput.result === 'NARROW' ? '等待安全管理员确认收窄后的资源、动作和数据分类范围，再生成授权变更。' : '等待安全管理员审批撤销；审批通过后由授权服务执行并记录逐项回执。',
    };
    accessReviewReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-access-review-receipts', accessReviewReceipts);
    return receipt;
  },
  async listAccessReviewRequests(): Promise<PageResult<AccessReviewRequestReceipt>> {
    const items = [...accessReviewReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const review = accessReviews.find((item) => item.reviewId === receipt.reviewId);
        return Boolean(review) && (!getDataScopeContext() || filterScoped([review]).length > 0);
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 10:10:00+08:00' };
  },
  async requestRoleAssignmentChange(input: RoleAssignmentChangeInput, idempotencyKey: string): Promise<RoleAssignmentChangeReceipt> {
    assertPermission('GOVERNANCE.ROLE.REQUEST');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: RoleAssignmentChangeInput = {
      ...input,
      subjectId: input.subjectId.trim(),
      subjectName: input.subjectName.trim(),
      tenantId: input.tenantId.trim(),
      organizationName: input.organizationName.trim(),
      scopeSummary: input.scopeSummary.trim(),
      environments: [...new Set(input.environments)].sort(),
      effectiveFrom: input.effectiveFrom.trim(),
      expiresAt: input.expiresAt.trim(),
      reasonCode: input.reasonCode.trim(),
      justification: input.justification.trim(),
    };
    const validEnvironments = normalizedInput.environments.every((environment) => ['SANDBOX', 'TEST', 'PRODUCTION'].includes(environment));
    const validChangeType = Object.prototype.hasOwnProperty.call(roleChangeReasons, normalizedInput.changeType);
    const validSubjectType = ['USER', 'SERVICE_ACCOUNT', 'ORGANIZATION'].includes(normalizedInput.subjectType);
    const validRole = roleCatalog.some((role) => role.code === normalizedInput.roleCode);
    const validReason = validChangeType && roleChangeReasons[normalizedInput.changeType]?.includes(normalizedInput.reasonCode) === true;
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = roleAssignmentChangeReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    if (!normalizedInput.subjectId || !normalizedInput.subjectName || !normalizedInput.tenantId || !normalizedInput.organizationName || !normalizedInput.scopeSummary || !normalizedInput.justification || !normalizedInput.reasonCode || !normalizedInput.environments.length || !validEnvironments || !validChangeType || !validSubjectType || !validRole) {
      throw new Error('ROLE_ASSIGNMENT_CHANGE_INPUT_INVALID');
    }
    const existingAssignment = roleAssignments.find((assignment) => (
      assignment.subjectId === normalizedInput.subjectId
      && assignment.roleCode === normalizedInput.roleCode
      && assignment.tenantId === normalizedInput.tenantId
      && assignment.status !== 'REVOKED'
    ));
    if (['ADJUST', 'REVOKE'].includes(normalizedInput.changeType) && !existingAssignment) {
      throw new Error('ROLE_ASSIGNMENT_NOT_FOUND');
    }
    if (normalizedInput.changeType === 'GRANT' && existingAssignment) {
      throw new Error('ROLE_ASSIGNMENT_DUPLICATE');
    }
    const actor = getDataScopeContext();
    if (actor && (!filterScoped([{ tenantId: normalizedInput.tenantId }]).length || normalizedInput.environments.some((environment) => !hasEnvironmentScope(actor, environment)))) {
      throw new Error('ROLE_ASSIGNMENT_CHANGE_SCOPE_INVALID');
    }
    if (!validReason) throw new Error('ROLE_ASSIGNMENT_CHANGE_REASON_INVALID');
    if (!validDate(normalizedInput.effectiveFrom) || !validDate(normalizedInput.expiresAt) || normalizedInput.expiresAt < normalizedInput.effectiveFrom) {
      throw new Error('ROLE_ASSIGNMENT_CHANGE_DATES_INVALID');
    }
    const receipt: RoleAssignmentChangeReceipt = {
      requestId: `RREQ-JN-${String(roleAssignmentChangeReceipts.size + 5).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL',
      changeType: normalizedInput.changeType,
      subjectType: normalizedInput.subjectType,
      subjectId: normalizedInput.subjectId,
      subjectName: normalizedInput.subjectName,
      tenantId: normalizedInput.tenantId,
      organizationName: normalizedInput.organizationName,
      roleCode: normalizedInput.roleCode,
      scopeSummary: normalizedInput.scopeSummary,
      environments: normalizedInput.environments,
      effectiveFrom: normalizedInput.effectiveFrom,
      expiresAt: normalizedInput.expiresAt,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-16 11:05:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待平台管理员完成授权审批；审批通过前不改变当前有效权限。',
    };
    roleAssignmentChangeReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-role-assignment-change-receipts', roleAssignmentChangeReceipts);
    return receipt;
  },
  async listRoleAssignmentChangeRequests(): Promise<PageResult<RoleAssignmentChangeReceipt>> {
    const items = [...roleAssignmentChangeReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const actor = getDataScopeContext();
        if (!actor) return true;
        // 变更申请本身没有单值 environment 字段，必须同时按目标租户和当前会话环境收敛；
        // 仅有某个环境的授权，不代表可以读取其他环境的历史申请。
        return isTenantVisible(actor, receipt.tenantId)
          && receipt.environments.includes(actor.environment)
          && hasEnvironmentScope(actor, actor.environment);
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 11:05:00+08:00' };
  },
  async requestRolePermissionConfigChange(input: RolePermissionConfigChangeInput, idempotencyKey: string): Promise<RolePermissionConfigChangeReceipt> {
    assertPermission('GOVERNANCE.ROLE.CONFIGURE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizeCodes = (codes: readonly string[]) => [...new Set(codes.map((code) => code.trim()).filter(Boolean))].sort();
    const normalizedInput: RolePermissionConfigChangeInput = {
      roleCode: input.roleCode,
      basePermissionCodes: normalizeCodes(input.basePermissionCodes) as RolePermissionConfigChangeInput['basePermissionCodes'],
      permissionCodes: normalizeCodes(input.permissionCodes) as RolePermissionConfigChangeInput['permissionCodes'],
      reasonCode: input.reasonCode,
      justification: input.justification.trim(),
    };
    const knownRole = roleCatalog.some((role) => role.code === normalizedInput.roleCode);
    const knownPermissions = [...normalizedInput.basePermissionCodes, ...normalizedInput.permissionCodes].every((code) => permissionCatalog.some((permission) => permission.code === code));
    const validReason = rolePermissionConfigReasons.includes(normalizedInput.reasonCode);
    const hasEffectiveChange = normalizedInput.basePermissionCodes.join('|') !== normalizedInput.permissionCodes.join('|');
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = rolePermissionConfigChangeReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    if (!normalizedInput.roleCode || !knownRole || !knownPermissions || !normalizedInput.justification || !validReason || !hasEffectiveChange) {
      throw new Error('ROLE_PERMISSION_CONFIG_CHANGE_INPUT_INVALID');
    }
    const base = new Set(normalizedInput.basePermissionCodes);
    const requested = new Set(normalizedInput.permissionCodes);
    const addedPermissionCodes = normalizedInput.permissionCodes.filter((code) => !base.has(code));
    const removedPermissionCodes = normalizedInput.basePermissionCodes.filter((code) => !requested.has(code));
    const receipt: RolePermissionConfigChangeReceipt = {
      configRequestId: `RCFG-JN-${String(rolePermissionConfigChangeReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL',
      roleCode: normalizedInput.roleCode,
      basePermissionCodes: normalizedInput.basePermissionCodes,
      requestedPermissionCodes: normalizedInput.permissionCodes,
      addedPermissionCodes,
      removedPermissionCodes,
      reasonCode: normalizedInput.reasonCode,
      justification: normalizedInput.justification,
      submittedAt: '2026-09-16 11:15:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待平台管理员审批并发布角色模板版本；审批通过前不改变当前角色权限和有效权限。',
    };
    rolePermissionConfigChangeReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-role-permission-config-change-receipts', rolePermissionConfigChangeReceipts);
    return receipt;
  },
  async listRolePermissionConfigChangeRequests(): Promise<PageResult<RolePermissionConfigChangeReceipt>> {
    const items = [...rolePermissionConfigChangeReceipts.values()]
      .map((entry) => entry.receipt)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 11:15:00+08:00' };
  },
  async listIntegrations(search = ''): Promise<PageResult<SystemIntegrationSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? integrations.filter((item) => [item.integrationId, item.systemName, item.systemType, item.ownerName, ...item.dataDomains, item.dependencySummary, item.nextAction].some((value) => value.toLowerCase().includes(keyword)))
      : integrations;
    const items = matched.filter((item) => anyEnvironmentVisible(item.environments));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async listPartners(search = ''): Promise<PageResult<PartnerSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? partners.filter((item) => [item.partnerId, item.tenantId, item.partnerName, item.legalName, item.protocolVersion, item.ownerName, item.contactName, item.contactEmail, item.scopeSummary, item.status].some((value) => value.toLowerCase().includes(keyword)))
      : partners;
    const items = filterScoped(matched).filter((item) => anyEnvironmentVisible(item.environments));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async getPartner(partnerId: string): Promise<PartnerSummary> {
    const partner = partners.find((item) => item.partnerId === partnerId);
    if (!partner) throw new Error('PARTNER_NOT_FOUND');
    assertScoped(partner, 'PARTNER_OUT_OF_SCOPE');
    if (!anyEnvironmentVisible(partner.environments)) throw new Error('PARTNER_OUT_OF_SCOPE');
    return partner;
  },
  async listApplicationClients(search = ''): Promise<PageResult<ApplicationClientSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? applicationClients.filter((item) => [item.applicationClientId, item.partnerId, item.tenantId, item.applicationName, item.purpose, item.scopeSummary, item.quota, item.ownerName, item.authMethod, ...item.networkAllowlist, ...item.endpointRefs, ...item.credentialRefs, item.endpointStatus, item.credentialStatus, item.status].some((value) => value.toLowerCase().includes(keyword)))
      : applicationClients;
    const items = filterScoped(matched).filter((item) => anyEnvironmentVisible(item.environments));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async getApplicationClient(applicationClientId: string): Promise<ApplicationClientSummary> {
    const application = applicationClients.find((item) => item.applicationClientId === applicationClientId);
    if (!application) throw new Error('APPLICATION_CLIENT_NOT_FOUND');
    assertScoped(application, 'APPLICATION_CLIENT_OUT_OF_SCOPE');
    if (!anyEnvironmentVisible(application.environments)) throw new Error('APPLICATION_CLIENT_OUT_OF_SCOPE');
    return application;
  },
  async listEndpointCredentials(search = ''): Promise<PageResult<EndpointCredentialSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? endpointCredentials.filter((item) => [item.endpointId, item.applicationClientId, item.tenantId, item.environment, item.endpointAddressMasked, item.networkZone, item.authMethod, item.credentialRef, item.credentialIssuer, item.credentialExpiresAt, item.credentialStatus, item.endpointStatus, item.trustDecision, item.ownerName].some((value) => value.toLowerCase().includes(keyword)))
      : endpointCredentials;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 09:30:00+08:00' };
  },
  async getEndpointCredential(endpointId: string): Promise<EndpointCredentialSummary> {
    const endpoint = endpointCredentials.find((item) => item.endpointId === endpointId);
    if (!endpoint) throw new Error('ENDPOINT_CREDENTIAL_NOT_FOUND');
    assertScoped(endpoint, 'ENDPOINT_CREDENTIAL_OUT_OF_SCOPE');
    return endpoint;
  },
  async listEndpointVerificationChecks(endpointId?: string): Promise<PageResult<EndpointVerificationCheckSummary>> {
    const matched = endpointId ? endpointVerificationChecks.filter((item) => item.endpointId === endpointId) : endpointVerificationChecks;
    if (endpointId && !endpointCredentials.some((item) => item.endpointId === endpointId)) throw new Error('ENDPOINT_CREDENTIAL_NOT_FOUND');
    const items = filterScoped(matched);
    if (endpointId && !items.length) throw new Error('ENDPOINT_CREDENTIAL_OUT_OF_SCOPE');
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 09:30:00+08:00' };
  },
  async requestPartnerOnboarding(input: PartnerOnboardingInput, idempotencyKey: string): Promise<PartnerOnboardingReceipt> {
    assertPermission('FR6.PARTNER.REQUEST');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const environments = [...new Set(input.environments)].sort() as PartnerOnboardingInput['environments'];
    const normalizedInput: PartnerOnboardingInput = {
      ...input,
      tenantId: input.tenantId.trim(),
      partnerName: input.partnerName.trim(),
      legalName: input.legalName.trim(),
      protocolVersion: input.protocolVersion.trim(),
      protocolExpiresAt: input.protocolExpiresAt.trim(),
      applicationClientId: input.applicationClientId.trim(),
      applicationName: input.applicationName.trim(),
      purpose: input.purpose.trim(),
      environments,
      scopeSummary: input.scopeSummary.trim(),
      networkAllowlist: [...new Set(input.networkAllowlist.map((value) => value.trim()).filter(Boolean))],
      authMethod: input.authMethod.trim(),
      ownerName: input.ownerName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      justification: input.justification.trim(),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = partnerOnboardingReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const validPartnerTypes = ['CITY_OPERATOR', 'OEM_TSP', 'DATA_PROVIDER', 'SUPPLIER'];
    const validReasons: readonly PartnerOnboardingReasonCode[] = ['NEW_PARTNER', 'NEW_APPLICATION', 'ENVIRONMENT_EXPANSION', 'PARTNER_RECOVERY'];
    const validEnvironments = normalizedInput.environments.length > 0 && normalizedInput.environments.every((environment) => ['SANDBOX', 'TEST', 'PRODUCTION'].includes(environment));
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(normalizedInput.protocolExpiresAt) && !Number.isNaN(Date.parse(`${normalizedInput.protocolExpiresAt}T00:00:00Z`));
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput.contactEmail);
    if (!normalizedInput.tenantId || !normalizedInput.partnerName || !normalizedInput.legalName || !normalizedInput.protocolVersion || !normalizedInput.applicationClientId || !normalizedInput.applicationName || !normalizedInput.purpose || !normalizedInput.scopeSummary || !normalizedInput.networkAllowlist.length || !normalizedInput.authMethod || !normalizedInput.ownerName || !normalizedInput.contactName || !normalizedInput.justification || !validPartnerTypes.includes(normalizedInput.partnerType) || !validReasons.includes(normalizedInput.reasonCode) || !validEnvironments || !validDate || !validEmail) {
      throw new Error('PARTNER_ONBOARDING_INPUT_INVALID');
    }
    const actor = getDataScopeContext();
    if (actor && (!isTenantVisible(actor, normalizedInput.tenantId) || normalizedInput.environments.some((environment) => !hasEnvironmentScope(actor, environment)))) {
      throw new Error('PARTNER_ONBOARDING_SCOPE_INVALID');
    }
    if (normalizedInput.reasonCode === 'NEW_PARTNER' && partners.some((partner) => partner.tenantId === normalizedInput.tenantId || partner.partnerName === normalizedInput.partnerName)) throw new Error('PARTNER_ALREADY_EXISTS');
    if (applicationClients.some((application) => application.applicationClientId === normalizedInput.applicationClientId)) throw new Error('APPLICATION_CLIENT_ALREADY_EXISTS');
    const receipt: PartnerOnboardingReceipt = {
      requestId: `PTN-REQ-JN-${String(partnerOnboardingReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_REVIEW',
      partnerType: normalizedInput.partnerType,
      tenantId: normalizedInput.tenantId,
      partnerName: normalizedInput.partnerName,
      applicationClientId: normalizedInput.applicationClientId,
      applicationName: normalizedInput.applicationName,
      environments: normalizedInput.environments,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-17 10:00:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待平台治理审核合作协议、端点、凭证引用和环境准入；审核通过前不创建生产身份。',
    };
    partnerOnboardingReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-partner-onboarding-receipts', partnerOnboardingReceipts);
    return receipt;
  },
  async listPartnerOnboardingRequests(): Promise<PageResult<PartnerOnboardingReceipt>> {
    const items = [...partnerOnboardingReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const actor = getDataScopeContext();
        if (!actor) return true;
        return isTenantVisible(actor, receipt.tenantId) && receipt.environments.includes(actor.environment) && hasEnvironmentScope(actor, actor.environment);
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 10:00:00+08:00' };
  },
  async requestPartnerLifecycleChange(input: PartnerLifecycleChangeInput, idempotencyKey: string): Promise<PartnerLifecycleChangeReceipt> {
    assertPermission('FR6.PARTNER.MANAGE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: PartnerLifecycleChangeInput = { ...input, partnerId: input.partnerId.trim(), reasonCode: input.reasonCode.trim(), justification: input.justification.trim() };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = partnerLifecycleChangeReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const partner = partners.find((item) => item.partnerId === normalizedInput.partnerId);
    if (!partner) throw new Error('PARTNER_NOT_FOUND');
    assertScoped(partner, 'PARTNER_OUT_OF_SCOPE');
    if (!anyEnvironmentVisible(partner.environments)) throw new Error('PARTNER_OUT_OF_SCOPE');
    const validAction = ['FREEZE', 'RESTORE', 'START_EXIT'].includes(normalizedInput.action);
    const validTransition = (normalizedInput.action === 'FREEZE' && ['ACTIVE', 'PENDING'].includes(partner.status))
      || (normalizedInput.action === 'RESTORE' && partner.status === 'FROZEN')
      || (normalizedInput.action === 'START_EXIT' && ['ACTIVE', 'FROZEN', 'EXPIRED'].includes(partner.status));
    if (!validAction || !validTransition || !normalizedInput.reasonCode || normalizedInput.justification.length < 10) throw new Error('PARTNER_LIFECYCLE_CHANGE_INVALID');
    const receipt: PartnerLifecycleChangeReceipt = {
      requestId: `PTN-LIFE-JN-${String(partnerLifecycleChangeReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_REVIEW', partnerId: normalizedInput.partnerId, action: normalizedInput.action,
      submittedAt: '2026-09-17 10:05:00+08:00', idempotencyKey: normalizedKey,
      nextStep: normalizedInput.action === 'FREEZE' ? '等待审核冻结影响范围；通过后停止新增权益、订阅和生产通道。' : normalizedInput.action === 'RESTORE' ? '等待审核恢复条件；通过后重新执行协议、凭证和环境准入复核。' : '等待审核退出清单；完成存量订阅、端点、凭证和审计收口后关闭主体。',
    };
    partnerLifecycleChangeReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-partner-lifecycle-change-receipts', partnerLifecycleChangeReceipts);
    return receipt;
  },
  async requestApplicationAccessAction(input: ApplicationAccessActionInput, idempotencyKey: string): Promise<ApplicationAccessActionReceipt> {
    assertPermission('FR6.PARTNER.MANAGE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedEndpointId = input.endpointId?.trim();
    const normalizedInput: ApplicationAccessActionInput = { ...input, applicationClientId: input.applicationClientId.trim(), ...(normalizedEndpointId ? { endpointId: normalizedEndpointId } : {}), reasonCode: input.reasonCode.trim(), justification: input.justification.trim() };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = applicationAccessActionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const application = applicationClients.find((item) => item.applicationClientId === normalizedInput.applicationClientId);
    if (!application) throw new Error('APPLICATION_CLIENT_NOT_FOUND');
    assertScoped(application, 'APPLICATION_CLIENT_OUT_OF_SCOPE');
    if (!anyEnvironmentVisible(application.environments)) throw new Error('APPLICATION_CLIENT_OUT_OF_SCOPE');
    const endpoint = normalizedInput.endpointId ? endpointCredentials.find((item) => item.endpointId === normalizedInput.endpointId) : undefined;
    if (normalizedInput.endpointId && !endpoint) throw new Error('ENDPOINT_CREDENTIAL_NOT_FOUND');
    if (endpoint) {
      assertScoped(endpoint, 'ENDPOINT_CREDENTIAL_OUT_OF_SCOPE');
      if (endpoint.applicationClientId !== application.applicationClientId || (normalizedInput.environment && endpoint.environment !== normalizedInput.environment)) throw new Error('APPLICATION_ACCESS_ACTION_INVALID');
    }
    const validAction = ['CONNECT_TEST', 'ROTATE_CREDENTIAL', 'REVOKE_CREDENTIAL'].includes(normalizedInput.action);
    const hasRequiredReference = normalizedInput.action === 'CONNECT_TEST' ? application.endpointRefs.length > 0 : application.credentialRefs.length > 0;
    if (!validAction || !hasRequiredReference || !normalizedInput.reasonCode || normalizedInput.justification.length < 10) throw new Error('APPLICATION_ACCESS_ACTION_INVALID');
    const receipt: ApplicationAccessActionReceipt = {
      requestId: `APP-ACT-JN-${String(applicationAccessActionReceipts.size + 1).padStart(4, '0')}`,
      status: normalizedInput.action === 'CONNECT_TEST' ? 'PENDING_EXECUTION' : 'PENDING_REVIEW', applicationClientId: normalizedInput.applicationClientId, ...(normalizedInput.endpointId ? { endpointId: normalizedInput.endpointId } : {}), ...(normalizedInput.environment ? { environment: normalizedInput.environment } : endpoint ? { environment: endpoint.environment } : {}), action: normalizedInput.action,
      submittedAt: '2026-09-17 10:06:00+08:00', idempotencyKey: normalizedKey,
      nextStep: normalizedInput.action === 'CONNECT_TEST' ? '等待接入网关执行 DNS/网络、TLS、应用身份、Scope 和协议握手验证，结果按检查项回传。' : normalizedInput.action === 'ROTATE_CREDENTIAL' ? '等待证书中心/KMS 完成新旧凭证切换验证；未完成前保留旧引用。' : '等待安全审核确认影响对象；审核通过后按应用和环境精确吊销，不影响其他租户。',
    };
    applicationAccessActionReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-application-access-action-receipts', applicationAccessActionReceipts);
    return receipt;
  },
  async listPartnerLifecycleChangeRequests(): Promise<PageResult<PartnerLifecycleChangeReceipt>> {
    const items = [...partnerLifecycleChangeReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const partner = partners.find((item) => item.partnerId === receipt.partnerId);
        return Boolean(partner) && (!getDataScopeContext() || filterScoped([partner]).length > 0) && (!partner || anyEnvironmentVisible(partner.environments));
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 10:06:00+08:00' };
  },
  async listApplicationAccessActionRequests(): Promise<PageResult<ApplicationAccessActionReceipt>> {
    const items = [...applicationAccessActionReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const actor = getDataScopeContext();
        const application = applicationClients.find((item) => item.applicationClientId === receipt.applicationClientId);
        if (!application || (actor && receipt.environment && (receipt.environment !== actor.environment || !hasEnvironmentScope(actor, receipt.environment)))) return false;
        return !actor || (filterScoped([application]).length > 0 && anyEnvironmentVisible(application.environments));
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-17 10:06:00+08:00' };
  },
  async listApprovalCases(search = ''): Promise<PageResult<ApprovalCaseSummary>> {
    const submitted = [...submissionReceipts.values()].some((receipt) => receipt.approvalCaseId === submittedApprovalCase.approvalCaseId);
    const keyword = search.trim().toLowerCase();
    const dynamic = [...draftSessionRecords.values()]
      .filter((record) => Boolean(record.submissionReceipt))
      .map((record): ApprovalCaseSummary => {
        const decision = [...decisionReceipts.values()].find((entry) => entry.receipt.approvalCaseId === record.approvalCase.approvalCaseId)?.receipt;
        return {
          approvalCaseId: record.approvalCase.approvalCaseId,
          requestId: record.approvalCase.requestId,
          requestRevision: record.approvalCase.requestRevision,
          status: decision?.decision ?? record.approvalCase.status,
          riskLevel: record.approvalCase.riskLevel,
          serviceName: record.approvalCase.serviceName,
          oemName: record.approvalCase.oemName,
          applicationName: record.approvalCase.applicationName,
          environment: record.approvalCase.environment,
          currentAssigneeId: record.approvalCase.currentAssigneeId,
          currentAssigneeName: record.approvalCase.currentAssigneeName,
          dueAt: record.approvalCase.dueAt,
          precheckOutcome: record.approvalCase.precheckOutcome,
          hardBlockerCount: record.approvalCase.hardBlockerCount,
          updatedAt: decision?.decidedAt ?? record.submissionReceipt?.submittedAt ?? record.receipt.createdAt,
        };
      });
    const source = [...approvalCaseSummaries
      .filter((item) => item.approvalCaseId === approvalCase.approvalCaseId || submitted)
      .map((item) => {
        const receipt = [...decisionReceipts.values()].find((entry) => entry.receipt.approvalCaseId === item.approvalCaseId)?.receipt;
        return receipt ? { ...item, status: receipt.decision, updatedAt: receipt.decidedAt } : item;
      }), ...dynamic];
    const items = filterScoped(keyword
      ? source.filter((item) => [item.approvalCaseId, item.requestId, item.serviceName, item.oemName, item.applicationName, item.currentAssigneeName].some((value) => value.toLowerCase().includes(keyword)))
      : source);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:45:00+08:00' };
  },
  async createSubscriptionDraft(input: SubscriptionDraftInput, idempotencyKey: string): Promise<SubscriptionDraftReceipt> {
    assertPermission('FR2.REQUEST.CREATE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: SubscriptionDraftInput = {
      serviceId: input.serviceId.trim(),
      entitlementId: input.entitlementId.trim(),
      applicationClientId: input.applicationClientId.trim(),
      capabilityGroupId: input.capabilityGroupId.trim(),
      coverageId: input.coverageId.trim(),
      channelType: input.channelType,
      validTo: input.validTo.trim(),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = draftSessionRecords.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const service = catalog.find((item) => item.serviceId === normalizedInput.serviceId);
    if (!service) throw new Error('DRAFT_SERVICE_NOT_FOUND');
    if (service.availability === 'SUSPENDED') throw new Error('DRAFT_SERVICE_UNAVAILABLE');
    const entitlement = entitlements.find((item) => item.entitlementId === normalizedInput.entitlementId);
    if (!entitlement || entitlement.serviceId !== service.serviceId) throw new Error('DRAFT_ENTITLEMENT_MISMATCH');
    if (getDataScopeContext() && !filterScoped([entitlement]).length) throw new Error('DRAFT_OUT_OF_SCOPE');
    if (!['ACTIVE', 'EXPIRING'].includes(entitlement.status)) throw new Error('DRAFT_ENTITLEMENT_NOT_ACTIVE');
    if (!service.supportedEnvironments.includes(entitlement.environment)) throw new Error('DRAFT_ENVIRONMENT_UNSUPPORTED');
    if (!service.channelTypes.includes(normalizedInput.channelType)) throw new Error('DRAFT_CHANNEL_UNSUPPORTED');
    if (!normalizedInput.applicationClientId || !normalizedInput.capabilityGroupId || !normalizedInput.coverageId) throw new Error('DRAFT_REQUIRED_INPUT_MISSING');
    const capabilityId = entitlement.capabilitySummary.split(' · ')[0];
    if (normalizedInput.capabilityGroupId !== capabilityId) throw new Error('DRAFT_CAPABILITY_MISMATCH');
    if (!coverageLabels[normalizedInput.coverageId]) throw new Error('DRAFT_COVERAGE_NOT_FOUND');
    const validTo = Date.parse(`${normalizedInput.validTo}T00:00:00+08:00`);
    const entitlementValidFrom = Date.parse(entitlement.validFrom.replace(' ', 'T') + '+08:00');
    const entitlementValidTo = Date.parse(entitlement.validTo.replace(' ', 'T') + '+08:00');
    if (!Number.isFinite(validTo) || validTo <= entitlementValidFrom || validTo > entitlementValidTo) throw new Error('DRAFT_VALIDITY_OUT_OF_ENTITLEMENT');

    const sequence = 100 + draftSessionRecords.size + 1;
    const requestId = `REQ-240916-${String(sequence).padStart(3, '0')}`;
    const precheck: PrecheckRunDetail = {
      ...submissionPrecheckRun,
      runId: `PCR-${requestId.replace('REQ-', '')}`,
      requestId,
      findings: submissionPrecheckRun.findings.map((finding, index) => ({ ...finding, findingId: `${requestId}-F${String(index + 1).padStart(2, '0')}` })),
    };
    const serviceName = `${service.serviceName} v${service.serviceVersion}`;
    const coverage = coverageLabels[normalizedInput.coverageId]!;
    const context: SubmissionContext = {
      ...submissionContext,
      requestId,
      draftRevision: 1,
      applicationName: entitlement.applicationName,
      entitlementRevision: `${entitlement.entitlementId}@${entitlement.revision}`,
      applicationClientId: normalizedInput.applicationClientId,
      environment: entitlement.environment,
      contentHash: `sha256:${requestId.toLowerCase()}…d4a1`,
      generatedAt: '2026-09-16 16:00:02+08:00',
      serviceName,
      purpose: `面向${entitlement.capabilitySummary}车型提供${service.serviceName}能力`,
      capabilityGroup: entitlement.capabilitySummary,
      coverage: `${coverage} · 双向`,
      channelProfile: normalizedInput.channelType === 'UU_A' ? '平台向车企云提供数据；主接入端点待联合核验' : `接入方式：${normalizedInput.channelType}`,
      validPeriod: `2026-09-20 00:00 至 ${normalizedInput.validTo} 00:00（截止时刻，不含${normalizedInput.validTo}）`,
      scopeHash: `sha256:scope-${requestId.toLowerCase()}…e3c2`,
      precheck,
    };
    const conditionFinding = precheck.findings.find((finding) => finding.outcome === 'CONDITION');
    const approvalCase: ApprovalCaseDetail = {
      ...submittedApprovalCase,
      approvalCaseId: `APR-${requestId.replace('REQ-', '')}`,
      requestId,
      requestRevision: 1,
      requestContentHash: context.contentHash,
      precheckRunId: precheck.runId,
      status: 'IN_REVIEW',
      serviceName,
      oemName: entitlement.oemName,
      applicationName: entitlement.applicationName,
      environment: entitlement.environment,
      scopeSummary: `${coverage} · ${entitlement.capabilitySummary} · ${normalizedInput.channelType}`,
      entitlementLimit: `仅${entitlement.environment === 'SANDBOX' ? '沙盒' : '测试'}环境；服务截止不晚于${entitlement.validTo}`,
      conditionCandidates: submittedApprovalCase.conditionCandidates.map((candidate) => ({
        ...candidate,
        candidateId: `PCC-${requestId.replace('REQ-', '')}-001`,
        ...(conditionFinding ? { sourceFindingId: conditionFinding.findingId } : {}),
      })),
    };
    const receipt: SubscriptionDraftReceipt = {
      requestId,
      requestRevision: 1,
      requestStatus: 'DRAFT',
      serviceId: normalizedInput.serviceId,
      entitlementId: normalizedInput.entitlementId,
      applicationClientId: normalizedInput.applicationClientId,
      capabilityGroupId: normalizedInput.capabilityGroupId,
      coverageId: normalizedInput.coverageId,
      channelType: normalizedInput.channelType,
      validTo: normalizedInput.validTo,
      createdAt: '2026-09-16 16:00:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '进入提交前检查；确认申请材料和授权后，才能提交审批。',
    };
    draftSessionRecords.set(normalizedKey, { fingerprint, input: normalizedInput, receipt, context, precheck, approvalCase });
    saveMockMap('vrc-sandbox-subscription-drafts', draftSessionRecords);
    return receipt;
  },
  async getSubscriptionDraft(requestId: string): Promise<SubscriptionDraftReceipt | null> {
    const draftRecord = [...draftSessionRecords.values()].find((record) => record.receipt.requestId === requestId);
    if (draftRecord) {
      // 草稿包含企业、环境和服务范围上下文，切换身份后必须重新走对象级数据范围校验。
      if (getDataScopeContext() && !filterScoped([draftRecord.context]).length) return null;
      return draftRecord.receipt;
    }
    return requestId === submissionContext.requestId && filterScoped([submissionContext]).length
      ? {
        requestId: submissionContext.requestId,
        requestRevision: submissionContext.draftRevision,
        requestStatus: 'DRAFT',
        serviceId: 'SVC-SPAT-2.3',
        entitlementId: 'ENT-JN-SANDBOX-001',
        applicationClientId: submissionContext.applicationClientId,
        capabilityGroupId: 'CAP-OEM-CONFIRMED-01',
        coverageId: 'COV-JINGSHI-038',
        channelType: 'UU_A',
        validTo: '2026-11-30',
        createdAt: submissionContext.generatedAt,
        idempotencyKey: 'SERVER-REQ-240916-003',
        nextStep: '进入提交前检查；确认申请材料和授权后，才能提交审批。',
      }
      : null;
  },
  async listRequests(search = ''): Promise<PageResult<SubscriptionRequestSummary>> {
    const keyword = search.trim().toLowerCase();
    const source = [...requests, ...[...draftSessionRecords.values()].map(draftSummary)].map((item) => item.requestId === submissionContext.requestId && [...submissionReceipts.values()].some((receipt) => receipt.requestId === item.requestId)
      ? { ...item, requestStatus: 'SUBMITTED' as const }
      : item);
    const items = filterScoped(keyword
      ? source.filter((item) => [item.requestId, item.oemName, item.applicationName, item.serviceName].some((value) => value.toLowerCase().includes(keyword)))
      : source);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listSubscriptions(): Promise<PageResult<SubscriptionSummary>> {
    const items = filterScoped(subscriptions);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listSubscriptionRevisions(subscriptionId = ''): Promise<PageResult<SubscriptionRevisionSummary>> {
    const matched = subscriptionId ? subscriptionRevisions.filter((item) => item.subscriptionId === subscriptionId) : subscriptionRevisions;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listRevisionDiffs(subscriptionId: string, fromRevision: number, toRevision: number): Promise<PageResult<SubscriptionRevisionDiff>> {
    const items = filterScoped(revisionDiffs.filter((item) => item.subscriptionId === subscriptionId && item.fromRevision === fromRevision && item.toRevision === toRevision));
    return { items, page: 1, pageSize: 50, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listInstances(): Promise<PageResult<SubscriptionInstanceSummary>> {
    const items = filterScoped(instances);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async listConfigurations(search = ''): Promise<PageResult<ConfigurationSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? configurations.filter((item) => [item.configurationId, item.subscriptionId, item.instanceId, item.serviceName, item.applicationName, item.coverageSummary].some((value) => value.toLowerCase().includes(keyword)))
      : configurations;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async getConfiguration(configurationId: string): Promise<ConfigurationDetail> {
    const detail = configurationDetails.find((item) => item.configurationId === configurationId);
    if (!detail || !filterScoped([detail]).length) throw new Error('CONFIGURATION_NOT_FOUND');
    return detail;
  },
  async requestConfigurationChange(input: ConfigurationChangeInput, idempotencyKey: string): Promise<ConfigurationChangeReceipt> {
    assertPermission('FR3.CONFIGURATION.REQUEST');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: ConfigurationChangeInput = {
      ...input,
      configurationId: input.configurationId.trim(),
      subscriptionId: input.subscriptionId.trim(),
      instanceId: input.instanceId.trim(),
      changeSummary: input.changeSummary.trim(),
      reasonCode: input.reasonCode.trim(),
      justification: input.justification.trim(),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = configurationChangeReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const configuration = configurationDetails.find((item) => item.configurationId === normalizedInput.configurationId);
    const validChangeType = Object.prototype.hasOwnProperty.call(configurationChangeReasons, normalizedInput.changeType);
    const validReason = validChangeType && configurationChangeReasons[normalizedInput.changeType]?.includes(normalizedInput.reasonCode) === true;
    const validEnvironment = ['SANDBOX', 'TEST', 'PRODUCTION'].includes(normalizedInput.targetEnvironment);
    const validBaseRevision = Number.isInteger(normalizedInput.baseRevision) && normalizedInput.baseRevision > 0;
    if (!configuration || normalizedInput.subscriptionId !== configuration.subscriptionId || normalizedInput.instanceId !== configuration.instanceId || normalizedInput.baseRevision !== configuration.revision || !normalizedInput.changeSummary || !normalizedInput.justification || !validChangeType || !validEnvironment || !validBaseRevision) {
      throw new Error('CONFIGURATION_CHANGE_INPUT_INVALID');
    }
    assertScoped(configuration, 'CONFIGURATION_OUT_OF_SCOPE');
    if (normalizedInput.targetEnvironment !== configuration.environment) throw new Error('CONFIGURATION_CHANGE_ENVIRONMENT_MISMATCH');
    if (!validReason) throw new Error('CONFIGURATION_CHANGE_REASON_INVALID');
    const receipt: ConfigurationChangeReceipt = {
      requestId: `CFG-REQ-JN-${String(configurationChangeReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL',
      changeType: normalizedInput.changeType,
      configurationId: normalizedInput.configurationId,
      subscriptionId: normalizedInput.subscriptionId,
      instanceId: normalizedInput.instanceId,
      baseRevision: normalizedInput.baseRevision,
      targetEnvironment: normalizedInput.targetEnvironment,
      changeSummary: normalizedInput.changeSummary,
      reasonCode: normalizedInput.reasonCode,
      justification: normalizedInput.justification,
      requiresRequalification: normalizedInput.requiresRequalification,
      submittedAt: '2026-09-16 11:20:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待配置负责人审批；审批通过后生成新配置版本，并重新执行配置校验和联合测试。',
    };
    configurationChangeReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-configuration-change-receipts', configurationChangeReceipts);
    return receipt;
  },
  async listConfigurationChangeRequests(): Promise<PageResult<ConfigurationChangeReceipt>> {
    const items = [...configurationChangeReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const configuration = configurations.find((item) => item.configurationId === receipt.configurationId);
        return !configuration || !getDataScopeContext() || filterScoped([configuration]).length > 0;
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 11:20:00+08:00' };
  },
  async listQualifications(search = ''): Promise<PageResult<QualificationSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? qualifications.filter((item) => [item.qualificationId, item.configurationId, item.subscriptionId, item.instanceId, item.serviceName, item.testProfile].some((value) => value.toLowerCase().includes(keyword)))
      : qualifications;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async getQualification(qualificationId: string): Promise<QualificationDetail> {
    const detail = qualificationDetails.find((item) => item.qualificationId === qualificationId);
    if (!detail || !filterScoped([detail]).length) throw new Error('QUALIFICATION_NOT_FOUND');
    return detail;
  },
  async requestQualificationExecution(input: QualificationExecutionInput, idempotencyKey: string): Promise<QualificationExecutionReceipt> {
    assertPermission('FR4.QUALIFICATION.EXECUTE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: QualificationExecutionInput = { qualificationId: input.qualificationId.trim(), reasonCode: input.reasonCode };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = qualificationExecutionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const detail = qualificationDetails.find((item) => item.qualificationId === normalizedInput.qualificationId);
    if (!detail) throw new Error('QUALIFICATION_NOT_FOUND');
    assertScoped(detail, 'QUALIFICATION_OUT_OF_SCOPE');
    if (!['INITIAL_RUN', 'RERUN_AFTER_CORRECTION', 'RERUN_AFTER_DEPENDENCY_RECOVERY'].includes(normalizedInput.reasonCode)) throw new Error('QUALIFICATION_EXECUTION_INPUT_INVALID');
    if (detail.status !== 'READY') throw new Error('QUALIFICATION_ENTRY_GATE_BLOCKED');
    const receipt: QualificationExecutionReceipt = {
      executionId: `QEX-JN-${String(qualificationExecutionReceipts.size + 1).padStart(4, '0')}`,
      status: 'QUEUED',
      qualificationId: detail.qualificationId,
      configurationId: detail.configurationId,
      profileVersion: detail.profileVersion,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-16 11:35:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '测试服务已接收执行意图，等待测试资源调度；排队回执不代表测试已通过或发布已完成。',
    };
    qualificationExecutionReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-qualification-execution-receipts', qualificationExecutionReceipts);
    return receipt;
  },
  async listReleasePlans(search = ''): Promise<PageResult<ReleasePlanSummary>> {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? releasePlans.filter((item) => [item.releasePlanId, item.qualificationId, item.configurationId, item.subscriptionId, item.instanceId, item.serviceName].some((value) => value.toLowerCase().includes(keyword)))
      : releasePlans;
    const items = filterScoped(matched);
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 10:30:00+08:00' };
  },
  async getReleasePlan(releasePlanId: string): Promise<ReleasePlanDetail> {
    const detail = releasePlanDetails.find((item) => item.releasePlanId === releasePlanId);
    if (!detail || !filterScoped([detail]).length) throw new Error('RELEASE_PLAN_NOT_FOUND');
    return detail;
  },
  async requestReleaseExecution(input: ReleaseExecutionInput, idempotencyKey: string): Promise<ReleaseExecutionReceipt> {
    assertPermission('FR4.RELEASE.EXECUTE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: ReleaseExecutionInput = { releasePlanId: input.releasePlanId.trim(), reasonCode: input.reasonCode };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = releaseExecutionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const detail = releasePlanDetails.find((item) => item.releasePlanId === normalizedInput.releasePlanId);
    if (!detail) throw new Error('RELEASE_PLAN_NOT_FOUND');
    assertScoped(detail, 'RELEASE_PLAN_OUT_OF_SCOPE');
    if (!['INITIAL_RELEASE', 'RETRY_AFTER_FIX', 'ROLLBACK_AFTER_FAILURE'].includes(normalizedInput.reasonCode)) throw new Error('RELEASE_EXECUTION_INPUT_INVALID');
    const qualification = qualificationDetails.find((item) => item.qualificationId === detail.qualificationId);
    if (!qualification || qualification.status !== 'PASSED') throw new Error('RELEASE_ENTRY_GATE_BLOCKED');
    if (!['READY', 'SCHEDULED', 'FAILED'].includes(detail.status)) throw new Error('RELEASE_OBJECT_STATE_INVALID');
    const receipt: ReleaseExecutionReceipt = {
      executionId: `REX-JN-${String(releaseExecutionReceipts.size + 1).padStart(4, '0')}`,
      status: 'QUEUED',
      releasePlanId: detail.releasePlanId,
      releaseVersion: detail.releaseVersion,
      strategy: detail.strategy,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-16 11:50:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '发布服务已接收执行意图，等待变更窗口和节点调度；排队回执不代表发布成功或车辆端已生效。',
    };
    releaseExecutionReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-release-execution-receipts', releaseExecutionReceipts);
    return receipt;
  },
  async requestSubscriptionChange(input: SubscriptionChangeInput, idempotencyKey: string): Promise<SubscriptionChangeReceipt> {
    assertPermission('FR2.SUBSCRIPTION.CHANGE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: SubscriptionChangeInput = {
      ...input,
      subscriptionId: input.subscriptionId.trim(),
      changeSummary: input.changeSummary.trim(),
      justification: input.justification.trim(),
      ...(input.targetValidTo?.trim() ? { targetValidTo: input.targetValidTo.trim() } : {}),
      ...(input.targetScope?.trim() ? { targetScope: input.targetScope.trim() } : {}),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = subscriptionChangeReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const summary = subscriptions.find((item) => item.subscriptionId === normalizedInput.subscriptionId);
    if (summary) assertScoped(summary, 'SUBSCRIPTION_OUT_OF_SCOPE');
    const currentRevision = summary ? subscriptionRevisions.find((item) => item.subscriptionId === summary.subscriptionId && item.revision === normalizedInput.baseRevision && item.status === 'APPROVED') : undefined;
    const validReasons: Readonly<Record<SubscriptionChangeInput['changeType'], SubscriptionChangeInput['reasonCode']>> = {
      RENEWAL: 'VALIDITY_EXTENSION',
      SCOPE_NARROWING: 'SCOPE_REDUCTION',
      SERVICE_ADJUSTMENT: 'SERVICE_REQUIREMENT_UPDATE',
    };
    const validDate = (value?: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
    const currentValidTo = currentRevision?.validPeriod.split('至').at(-1)?.trim().slice(0, 10) ?? '';
    const entitlement = summary ? entitlements.find((item) => item.serviceName === summary.serviceName && item.environment === summary.environment) : undefined;
    if (!summary || !currentRevision || summary.currentRevision !== normalizedInput.baseRevision || !normalizedInput.changeSummary || normalizedInput.justification.length < 10 || validReasons[normalizedInput.changeType] !== normalizedInput.reasonCode) {
      throw new Error('SUBSCRIPTION_CHANGE_INPUT_INVALID');
    }
    if (normalizedInput.changeType === 'RENEWAL' && (!validDate(normalizedInput.targetValidTo) || !normalizedInput.targetValidTo || normalizedInput.targetValidTo <= currentValidTo)) throw new Error('SUBSCRIPTION_CHANGE_VALIDITY_INVALID');
    if (normalizedInput.changeType === 'RENEWAL' && entitlement?.validTo && normalizedInput.targetValidTo && normalizedInput.targetValidTo > entitlement.validTo.slice(0, 10)) throw new Error('SUBSCRIPTION_CHANGE_ENTITLEMENT_BLOCKED');
    if (normalizedInput.changeType === 'SCOPE_NARROWING' && (!normalizedInput.targetScope || normalizedInput.targetScope === currentRevision.scopeSummary)) throw new Error('SUBSCRIPTION_CHANGE_SCOPE_INVALID');
    if (normalizedInput.changeType === 'SERVICE_ADJUSTMENT' && !normalizedInput.changeSummary) throw new Error('SUBSCRIPTION_CHANGE_INPUT_INVALID');
    const receipt: SubscriptionChangeReceipt = {
      requestId: `SCHG-REQ-JN-${String(subscriptionChangeReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL',
      subscriptionId: normalizedInput.subscriptionId,
      baseRevision: normalizedInput.baseRevision,
      changeType: normalizedInput.changeType,
      ...(normalizedInput.targetValidTo ? { targetValidTo: normalizedInput.targetValidTo } : {}),
      ...(normalizedInput.targetScope ? { targetScope: normalizedInput.targetScope } : {}),
      changeSummary: normalizedInput.changeSummary,
      reasonCode: normalizedInput.reasonCode,
      justification: normalizedInput.justification,
      submittedAt: '2026-09-16 12:25:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待订阅审批；审批通过后生成新版本，并重新执行配置、联合测试、发布和交付证据核验。',
    };
    subscriptionChangeReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-subscription-change-receipts', subscriptionChangeReceipts);
    return receipt;
  },
  async listSubscriptionChangeRequests(): Promise<PageResult<SubscriptionChangeReceipt>> {
    const items = [...subscriptionChangeReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const summary = subscriptions.find((item) => item.subscriptionId === receipt.subscriptionId);
        return !summary || !getDataScopeContext() || filterScoped([summary]).length > 0;
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 12:25:00+08:00' };
  },
  async requestControlPlan(input: ControlPlanInput, idempotencyKey: string): Promise<ControlPlanReceipt> {
    assertPermission('FR2.CONTROL.PLAN');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: ControlPlanInput = {
      ...input,
      subscriptionId: input.subscriptionId.trim(),
      instanceIds: [...new Set(input.instanceIds.map((item) => item.trim()).filter(Boolean))].sort(),
      justification: input.justification.trim(),
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = controlPlanReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const summary = subscriptions.find((item) => item.subscriptionId === normalizedInput.subscriptionId);
    if (summary) assertScoped(summary, 'SUBSCRIPTION_OUT_OF_SCOPE');
    const selectedInstances = instances.filter((item) => normalizedInput.instanceIds.includes(item.instanceId));
    const validReasons: Readonly<Record<ControlPlanInput['action'], readonly ControlPlanInput['reasonCode'][]>> = {
      PAUSE: ['RUNTIME_RISK', 'OEM_REQUEST'],
      RESUME: ['OEM_REQUEST'],
      TERMINATE: ['SERVICE_RETIREMENT', 'OEM_REQUEST'],
    };
    if (!summary || summary.currentRevision !== normalizedInput.baseRevision || !normalizedInput.instanceIds.length || selectedInstances.length !== normalizedInput.instanceIds.length || !normalizedInput.justification || normalizedInput.justification.length < 10 || !validReasons[normalizedInput.action]?.includes(normalizedInput.reasonCode)) throw new Error('CONTROL_PLAN_INPUT_INVALID');
    if (normalizedInput.action === 'PAUSE' && selectedInstances.some((item) => item.controlStatus !== 'ENABLED')) throw new Error('CONTROL_PLAN_STATE_INVALID');
    if (normalizedInput.action === 'RESUME' && selectedInstances.some((item) => item.controlStatus !== 'PAUSED')) throw new Error('CONTROL_PLAN_STATE_INVALID');
    if (normalizedInput.action === 'TERMINATE' && selectedInstances.some((item) => ['EXPIRED', 'REVOKED', 'TERMINATED'].includes(item.lifecycle))) throw new Error('CONTROL_PLAN_STATE_INVALID');
    const receipt: ControlPlanReceipt = {
      planId: `CTRL-PLAN-JN-${String(controlPlanReceipts.size + 1).padStart(4, '0')}`,
      status: 'PENDING_APPROVAL',
      subscriptionId: normalizedInput.subscriptionId,
      baseRevision: normalizedInput.baseRevision,
      action: normalizedInput.action,
      instanceIds: normalizedInput.instanceIds,
      reasonCode: normalizedInput.reasonCode,
      justification: normalizedInput.justification,
      submittedAt: '2026-09-16 12:35:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: '等待独立核验和控制审批；审批通过后由控制服务执行并回传实例级状态和退出证据，本请求不会直接切换状态。',
    };
    controlPlanReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-control-plan-receipts', controlPlanReceipts);
    return receipt;
  },
  async listControlPlanRequests(): Promise<PageResult<ControlPlanReceipt>> {
    const items = [...controlPlanReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => {
        const summary = subscriptions.find((item) => item.subscriptionId === receipt.subscriptionId);
        return !summary || !getDataScopeContext() || filterScoped([summary]).length > 0;
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 12:35:00+08:00' };
  },
  async getSubscription(subscriptionId: string): Promise<SubscriptionDetail> {
    const summary = subscriptions.find((item) => item.subscriptionId === subscriptionId);
    if (!summary || !filterScoped([summary]).length) throw new Error('SUBSCRIPTION_NOT_FOUND');
    return {
      summary,
      approvedRevisionId: instances.find((item) => item.subscriptionId === subscriptionId)?.approvedRevisionId ?? '',
      targetRevisionId: null,
      instances: instances.filter((item) => item.subscriptionId === subscriptionId),
      dataTime: '2026-09-16 10:30:00+08:00',
    };
  },
  async dashboardMetrics(): Promise<readonly DashboardMetric[]> {
    const scopedRequests = filterScoped(requests);
    const scopedApprovals = filterScoped(approvalCaseSummaries);
    const scopedPrechecks = [precheckRun, submissionPrecheckRun].filter(precheckRunScoped);
    const draftSubmitted = [...submissionReceipts.values()].some((receipt) => receipt.requestId === submissionContext.requestId);
    const originalApprovalDecided = [...decisionReceipts.values()].some((item) => item.receipt.approvalCaseId === approvalCase.approvalCaseId);
    const newApprovalDecided = [...decisionReceipts.values()].some((item) => item.receipt.approvalCaseId === submittedApprovalCase.approvalCaseId);
    return [
      { key: 'draft', label: '待提交申请', value: Math.max(0, scopedRequests.filter((item) => item.requestStatus === 'DRAFT').length + (draftSubmitted ? -1 : 0)), unit: '项', tone: 'default', description: '申请已完成准入检查' },
      { key: 'approval', label: '待处理审批', value: Math.max(0, scopedApprovals.filter((item) => ['PENDING', 'IN_REVIEW'].includes(item.status)).length - (originalApprovalDecided ? 1 : 0) - (newApprovalDecided ? 1 : 0)), unit: '项', tone: 'warning', description: '需核对申请范围与附加条件' },
      { key: 'remediation', label: '待复核补正', value: filterScoped([remediationCase]).length, unit: '项', tone: 'warning', description: '处理人已提交材料' },
      { key: 'precheck', label: '准入检查记录', value: scopedPrechecks.length, unit: '次', tone: 'success', description: '均为当前环境检查记录' },
    ];
  },
  async getSubmissionContext(requestId: string): Promise<SubmissionContext> {
    const draft = [...draftSessionRecords.values()].find((record) => record.receipt.requestId === requestId);
    if (draft && filterScoped([draft.context]).length) return draft.context;
    if (requestId !== submissionContext.requestId || !filterScoped([submissionContext]).length) throw new Error('SUBMISSION_CONTEXT_NOT_FOUND');
    return submissionContext;
  },
  async getSubmissionReceipt(requestId: string): Promise<SubmissionReceipt | null> {
    const receipt = [...submissionReceipts.values()].find((item) => item.requestId === requestId)
      ?? [...draftSessionRecords.values()].find((record) => record.receipt.requestId === requestId)?.submissionReceipt
      ?? null;
    if (receipt) assertRequestScoped(receipt.requestId, 'SUBMISSION_OUT_OF_SCOPE');
    return receipt;
  },
  async submitRequest(requestId: string, idempotencyKey: string): Promise<SubmissionReceipt> {
    assertPermission('FR2.REQUEST.SUBMIT');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    assertRequestScoped(requestId, 'SUBMISSION_OUT_OF_SCOPE');
    const existing = submissionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.requestId !== requestId) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing;
    }
    const draftEntry = [...draftSessionRecords.entries()].find(([, record]) => record.receipt.requestId === requestId);
    if (draftEntry) {
      const [draftKey, draft] = draftEntry;
      if (draft.submissionReceipt) {
        if (draft.submissionReceipt.idempotencyKey === normalizedKey) return draft.submissionReceipt;
        throw new Error('REQUEST_ALREADY_SUBMITTED');
      }
      if (draft.context.summaryValidity !== 'CURRENT' || draft.precheck.validity !== 'CURRENT' || draft.precheck.runStatus !== 'COMPLETED') throw new Error('SUBMISSION_INPUT_STALE');
      if (!['PASS', 'PASS_WITH_CONDITIONS'].includes(draft.precheck.outcome) || draft.precheck.layers.some((layer) => layer.blocked > 0 || layer.unknown > 0 || layer.expired > 0)) throw new Error('PRECHECK_NOT_SUBMITTABLE');
      const receipt: SubmissionReceipt = {
        requestId,
        requestRevision: draft.receipt.requestRevision,
        contentHash: draft.context.contentHash,
        approvalCaseId: draft.approvalCase.approvalCaseId,
        submittedAt: '2026-09-16 16:05:00+08:00',
        idempotencyKey: normalizedKey,
        requestStatus: 'SUBMITTED',
      };
      draftSessionRecords.set(draftKey, { ...draft, submissionReceipt: receipt });
      saveMockMap('vrc-sandbox-subscription-drafts', draftSessionRecords);
      return receipt;
    }
    if (requestId !== submissionContext.requestId) throw new Error('REQUEST_NOT_FOUND');
    if ([...submissionReceipts.values()].some((receipt) => receipt.requestId === requestId)) throw new Error('REQUEST_ALREADY_SUBMITTED');
    if (submissionContext.summaryValidity !== 'CURRENT' || submissionContext.precheck.validity !== 'CURRENT' || submissionContext.precheck.runStatus !== 'COMPLETED') throw new Error('SUBMISSION_INPUT_STALE');
    if (!['PASS', 'PASS_WITH_CONDITIONS'].includes(submissionContext.precheck.outcome) || submissionContext.precheck.layers.some((layer) => layer.blocked > 0 || layer.unknown > 0 || layer.expired > 0)) throw new Error('PRECHECK_NOT_SUBMITTABLE');
    const receipt: SubmissionReceipt = {
      requestId,
      requestRevision: submissionContext.draftRevision,
      contentHash: submissionContext.contentHash,
      approvalCaseId: submittedApprovalCase.approvalCaseId,
      submittedAt: '2026-09-16 15:10:00+08:00',
      idempotencyKey: normalizedKey,
      requestStatus: 'SUBMITTED',
    };
    submissionReceipts.set(normalizedKey, receipt);
    saveMockMap('vrc-sandbox-submission-receipts', submissionReceipts);
    return receipt;
  },
  async getPrecheckRun(runId: string): Promise<PrecheckRunDetail> {
    if (runId === precheckRun.runId) {
      if (!precheckRunScoped(precheckRun)) throw new Error('PRECHECK_RUN_OUT_OF_SCOPE');
      return precheckRun;
    }
    if (runId === submissionPrecheckRun.runId) {
      if (!precheckRunScoped(submissionPrecheckRun)) throw new Error('PRECHECK_RUN_OUT_OF_SCOPE');
      return submissionPrecheckRun;
    }
    const draft = [...draftSessionRecords.values()].find((record) => record.precheck.runId === runId);
    if (draft) {
      assertScoped(draft.context, 'PRECHECK_RUN_OUT_OF_SCOPE');
      return draft.precheck;
    }
    throw new Error('PRECHECK_RUN_NOT_FOUND');
  },
  async getFinding(findingId: string): Promise<PrecheckFinding> {
    const draft = [...draftSessionRecords.values()].find((record) => record.precheck.findings.some((item) => item.findingId === findingId));
    if (draft) assertScoped(draft.context, 'FINDING_OUT_OF_SCOPE');
    const finding = draft?.precheck.findings.find((item) => item.findingId === findingId)
      ?? [...precheckFindings, ...submissionFindings].find((item) => item.findingId === findingId);
    if (!finding) throw new Error('FINDING_NOT_FOUND');
    if (!draft) {
      const run = [precheckRun, submissionPrecheckRun].find((item) => item.findings.some((findingItem) => findingItem.findingId === findingId));
      if (run && !precheckRunScoped(run)) throw new Error('FINDING_OUT_OF_SCOPE');
    }
    return finding;
  },
  async getRemediationCase(caseId: string): Promise<RemediationCaseDetail> {
    if (caseId !== remediationCase.caseId) throw new Error('REMEDIATION_CASE_NOT_FOUND');
    assertRequestScoped(remediationCase.requestId, 'REMEDIATION_OUT_OF_SCOPE');
    return remediationCase;
  },
  async recordRemediationAction(input: RemediationActionInput, idempotencyKey: string): Promise<RemediationActionReceipt> {
    assertPermission('FR2.PRECHECK.REMEDIATE');
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const normalizedInput: RemediationActionInput = {
      caseId: input.caseId.trim(),
      action: input.action,
      evidenceRefs: [...new Set(input.evidenceRefs.map((ref) => ref.trim()).filter(Boolean))].sort(),
      note: input.note.trim(),
      reasonCode: input.reasonCode,
    };
    const fingerprint = JSON.stringify(normalizedInput);
    const existing = remediationActionReceipts.get(normalizedKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    if (normalizedInput.caseId !== remediationCase.caseId) throw new Error('REMEDIATION_CASE_NOT_FOUND');
    assertRequestScoped(remediationCase.requestId, 'REMEDIATION_OUT_OF_SCOPE');
    if (!['SUBMIT_MATERIALS', 'REQUEST_RECHECK'].includes(normalizedInput.action) || !['MATERIALS_SUPPLEMENTED', 'RECHECK_REQUESTED'].includes(normalizedInput.reasonCode)) throw new Error('REMEDIATION_ACTION_INPUT_INVALID');
    const expectedReason = normalizedInput.action === 'SUBMIT_MATERIALS' ? 'MATERIALS_SUPPLEMENTED' : 'RECHECK_REQUESTED';
    if (normalizedInput.reasonCode !== expectedReason || normalizedInput.note.length < 10) throw new Error('REMEDIATION_ACTION_INPUT_INVALID');
    if (!normalizedInput.evidenceRefs.length) throw new Error('REMEDIATION_EVIDENCE_REQUIRED');
    const knownEvidence = new Set(remediationCase.evidence.map((item) => item.evidenceRef));
    if (normalizedInput.evidenceRefs.some((ref) => !knownEvidence.has(ref))) throw new Error('REMEDIATION_EVIDENCE_NOT_FOUND');
    if (normalizedInput.action === 'REQUEST_RECHECK' && remediationCase.status !== 'PENDING_VERIFY') throw new Error('REMEDIATION_STATE_INVALID');
    if (normalizedInput.action === 'SUBMIT_MATERIALS' && remediationCase.status === 'COMPLETED') throw new Error('REMEDIATION_STATE_INVALID');
    const receipt: RemediationActionReceipt = {
      actionId: `REMACT-JN-${String(remediationActionReceipts.size + 1).padStart(4, '0')}`,
      status: 'RECORDED',
      caseId: normalizedInput.caseId,
      action: normalizedInput.action,
      evidenceRefs: normalizedInput.evidenceRefs,
      note: normalizedInput.note,
      reasonCode: normalizedInput.reasonCode,
      submittedAt: '2026-09-16 16:20:00+08:00',
      idempotencyKey: normalizedKey,
      nextStep: normalizedInput.action === 'SUBMIT_MATERIALS'
        ? '等待独立复核人核验材料；复核通过后由检查服务重新计算准入结果，本回执不会关闭补正任务。'
        : '等待检查服务重新执行准入检查并回传新的Run/Outcome/Validity，本回执不会改写当前检查结果。',
    };
    remediationActionReceipts.set(normalizedKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-remediation-action-receipts', remediationActionReceipts);
    return receipt;
  },
  async listRemediationActionReceipts(): Promise<PageResult<RemediationActionReceipt>> {
    const items = [...remediationActionReceipts.values()]
      .map((entry) => entry.receipt)
      .filter((receipt) => !getDataScopeContext() || filterScoped([remediationCase]).length > 0)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    return { items, page: 1, pageSize: 20, total: items.length, dataTime: '2026-09-16 16:20:00+08:00' };
  },
  async getApprovalCase(caseId: string): Promise<ApprovalCaseDetail> {
    const draft = [...draftSessionRecords.values()].find((record) => record.approvalCase.approvalCaseId === caseId && record.submissionReceipt);
    const base = draft?.approvalCase ?? (caseId === approvalCase.approvalCaseId ? approvalCase
      : caseId === submittedApprovalCase.approvalCaseId && [...submissionReceipts.values()].some((receipt) => receipt.approvalCaseId === caseId) ? submittedApprovalCase
        : undefined);
    if (!base || !filterScoped([base]).length) throw new Error('APPROVAL_CASE_NOT_FOUND');
    const completed = [...decisionReceipts.values()].find((item) => item.receipt.approvalCaseId === caseId)?.receipt;
    return completed ? { ...base, status: completed.decision } : base;
  },
  async decideApproval(caseId: string, idempotencyKey: string, input: ApprovalDecisionInput): Promise<ApprovalDecisionReceipt> {
    assertPermission('FR2.APPROVAL.DECIDE');
    const fingerprint = JSON.stringify({ caseId, input });
    const existing = decisionReceipts.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_KEY_CONFLICT');
      return existing.receipt;
    }
    const dynamicTarget = [...draftSessionRecords.values()].find((record) => record.approvalCase.approvalCaseId === caseId && record.submissionReceipt)?.approvalCase;
    const target = dynamicTarget ?? (caseId === approvalCase.approvalCaseId ? approvalCase
      : caseId === submittedApprovalCase.approvalCaseId && [...submissionReceipts.values()].some((receipt) => receipt.approvalCaseId === caseId) ? submittedApprovalCase
        : undefined);
    if (!target) throw new Error('APPROVAL_CASE_NOT_FOUND');
    assertScoped(target, 'APPROVAL_OUT_OF_SCOPE');
    const actor = getDataScopeContext();
    if (actor && target.applicantId === actor.actorId) throw new Error('APPROVAL_SELF_ACTION');
    if (actor && target.currentAssigneeId !== actor.actorId) throw new Error('APPROVAL_ASSIGNEE_MISMATCH');
    if ([...decisionReceipts.values()].some((item) => item.receipt.approvalCaseId === caseId)) throw new Error('APPROVAL_ALREADY_DECIDED');
    if (target.status !== 'IN_REVIEW' || !target.sodPassed || target.precheckValidity !== 'CURRENT' || target.hardBlockerCount > 0 || !['PASS', 'PASS_WITH_CONDITIONS'].includes(target.precheckOutcome)) throw new Error('APPROVAL_GUARD_REJECTED');
    if (!input.reasonCode.trim() || !input.comment.trim()) throw new Error('DECISION_REASON_REQUIRED');
    const allowedReasons: Record<ApprovalDecisionInput['decision'], readonly string[]> = {
      APPROVED: ['ALL_REQUIREMENTS_MET'],
      CONDITIONALLY_APPROVED: ['APPROVED_WITH_SCOPE_RESTRICTION'],
      RETURNED: ['MATERIALS_INCOMPLETE', 'INPUT_RECHECK_REQUIRED'],
      REJECTED: ['HARD_GATE_REJECTED', 'OUT_OF_ENTITLEMENT'],
    };
    if (!allowedReasons[input.decision].includes(input.reasonCode)) throw new Error('DECISION_REASON_MISMATCH');
    if (input.decision === 'APPROVED' && target.conditionCandidates.some((candidate) => candidate.hardGate)) throw new Error('HARD_CONDITION_REQUIRES_DISPOSITION');
    if (input.decision === 'CONDITIONALLY_APPROVED') {
      const condition = input.condition;
      if (!condition || !condition.sourceFindingId || !condition.sourceCandidateId || !condition.scope || !condition.description || !condition.ownerName || !condition.dueAt || !condition.evidenceRule || !condition.breachAction) throw new Error('CONDITION_INCOMPLETE');
      if (!target.conditionCandidates.some((candidate) => candidate.candidateId === condition.sourceCandidateId && candidate.sourceFindingId === condition.sourceFindingId)) throw new Error('CONDITION_SOURCE_MISMATCH');
      const scopeParts = target.scopeSummary.split(' · ');
      const coverageParts = scopeParts[1]?.startsWith('CAP-') ? scopeParts.slice(0, 1) : scopeParts.slice(0, Math.min(2, scopeParts.length));
      const expectedScope = `${target.environment} / ${coverageParts.join(' / ')}`;
      if (condition.scope !== expectedScope || !condition.blocksActivation || condition.candidateDisposition === 'REJECTED') throw new Error('CONDITION_EXCEEDS_ENTITLEMENT');
    }
    if (input.decision === 'RETURNED' && (!input.returnRequirements?.trim() || !input.returnOwnerName?.trim() || !input.returnDueAt || !input.resubmitScope?.trim())) throw new Error('RETURN_REQUIREMENTS_INCOMPLETE');
    if (input.decision === 'REJECTED' && (!input.rejectionBasis?.trim() || input.allowReapply === undefined || !input.reapplyGuidance?.trim())) throw new Error('REJECTION_BASIS_INCOMPLETE');
    const receipt: ApprovalDecisionReceipt = {
      decisionId: dynamicTarget ? `DEC-${caseId.replace('APR-', '')}` : caseId === submittedApprovalCase.approvalCaseId ? 'DEC-240916-003' : 'DEC-240916-001',
      approvalCaseId: caseId,
      requestId: target.requestId,
      requestRevision: target.requestRevision,
      decision: input.decision,
      reasonCode: input.reasonCode,
      comment: input.comment,
      decidedAt: '2026-09-16 15:12:00+08:00',
      idempotencyKey,
      ...(input.decision === 'CONDITIONALLY_APPROVED' && input.condition ? { condition: input.condition } : {}),
      ...(input.decision === 'RETURNED' && input.returnRequirements ? { returnRequirements: input.returnRequirements } : {}),
      ...(input.decision === 'REJECTED' && input.rejectionBasis ? { rejectionBasis: input.rejectionBasis } : {}),
      ...(input.decision === 'APPROVED' || input.decision === 'CONDITIONALLY_APPROVED' ? { subscriptionRevisionId: dynamicTarget ? `SUBREV-${target.requestId}-R1` : caseId === submittedApprovalCase.approvalCaseId ? 'SUBREV-JN-0003-R1' : 'SUBREV-JN-0001-R1' } : {}),
      ...(input.decision === 'RETURNED' ? { successorDraftPath: `/fr2/requests/new?base=${target.requestId}` } : {}),
    };
    decisionReceipts.set(idempotencyKey, { fingerprint, receipt });
    saveMockMap('vrc-sandbox-decision-receipts', decisionReceipts);
    return receipt;
  },
};
