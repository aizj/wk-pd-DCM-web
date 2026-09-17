export type PermissionCode =
  | 'FR1.CATALOG.READ'
  | 'FR1.ENTITLEMENT.READ'
  | 'FR2.REQUEST.READ'
  | 'FR2.REQUEST.CREATE'
  | 'FR2.REQUEST.EDIT'
  | 'FR2.REQUEST.SUBMIT'
  | 'FR2.PRECHECK.READ'
  | 'FR2.PRECHECK.EXECUTE'
  | 'FR2.PRECHECK.REMEDIATE'
  | 'FR2.APPROVAL.READ'
  | 'FR2.APPROVAL.DECIDE'
  | 'FR2.SUBSCRIPTION.READ'
  | 'FR2.SUBSCRIPTION.CHANGE'
  | 'FR2.CONTROL.PLAN'
  | 'FR2.CONTROL.PAUSE'
  | 'FR2.CONTROL.RESUME'
  | 'FR2.CONTROL.TERMINATE'
  | 'FR2.DIAGNOSIS.READ'
  | 'FR2.AUDIT.READ'
  | 'FR2.WORKBENCH.READ'
  | 'FR3.CONFIGURATION.READ'
  | 'FR3.CONFIGURATION.REQUEST'
  | 'FR3.CONFIGURATION.EDIT'
  | 'FR3.CONFIGURATION.VALIDATE'
  | 'FR3.CONFIGURATION.PUBLISH'
  | 'FR4.QUALIFICATION.READ'
  | 'FR4.QUALIFICATION.EXECUTE'
  | 'FR4.RELEASE.READ'
  | 'FR4.RELEASE.EXECUTE'
  | 'FR5.EVIDENCE.READ'
  | 'FR5.EVIDENCE.EXPORT'
  | 'FR5.INCIDENT.READ'
  | 'FR5.INCIDENT.UPDATE'
  | 'GOVERNANCE.PERMISSION.READ'
  | 'GOVERNANCE.PERMISSION.SIMULATE'
  | 'GOVERNANCE.ROLE.READ'
  | 'GOVERNANCE.ROLE.REQUEST'
  | 'GOVERNANCE.ROLE.MANAGE'
  | 'GOVERNANCE.ROLE.CONFIGURE'
  | 'GOVERNANCE.INTEGRATION.READ'
  | 'FR6.PARTNER.READ'
  | 'FR6.PARTNER.REQUEST'
  | 'FR6.PARTNER.MANAGE'
  | 'GOVERNANCE.ACCESS_REVIEW.READ'
  | 'GOVERNANCE.ACCESS_REVIEW.REQUEST';

export type RoleCode =
  | 'PLATFORM_ADMIN'
  | 'SUBSCRIPTION_OPERATOR'
  | 'APPROVER'
  | 'OEM_INTEGRATION'
  | 'TEST_OPERATOR'
  | 'AUDITOR';

export type PermissionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PermissionDefinition {
  code: PermissionCode;
  label: string;
  module: string;
  action: string;
  risk: PermissionRisk;
  description: string;
}

export interface RoleDefinition {
  code: RoleCode;
  label: string;
  description: string;
  permissionCodes: readonly PermissionCode[];
  defaultScopes: readonly string[];
  separationOfDutiesGroup?: 'OPERATIONS' | 'APPROVAL' | 'OEM' | 'TEST' | 'AUDIT' | 'ADMIN';
}

export type RolePermissionConfigChangeReasonCode = 'FUNCTION_CHANGE' | 'LEAST_PRIVILEGE' | 'COMPLIANCE_REVIEW' | 'EMERGENCY_RESTRICTION';

/** 角色模板权限配置申请只表达草稿变更意图，不代表角色或有效权限已更新。 */
export interface RolePermissionConfigChangeInput {
  roleCode: RoleCode;
  basePermissionCodes: readonly PermissionCode[];
  permissionCodes: readonly PermissionCode[];
  reasonCode: RolePermissionConfigChangeReasonCode;
  justification: string;
}

export interface RolePermissionConfigChangeReceipt {
  configRequestId: string;
  status: 'PENDING_APPROVAL';
  roleCode: RoleCode;
  basePermissionCodes: readonly PermissionCode[];
  requestedPermissionCodes: readonly PermissionCode[];
  addedPermissionCodes: readonly PermissionCode[];
  removedPermissionCodes: readonly PermissionCode[];
  reasonCode: RolePermissionConfigChangeReasonCode;
  justification: string;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type RoleAssignmentSubjectType = 'USER' | 'SERVICE_ACCOUNT' | 'ORGANIZATION';
export type RoleAssignmentStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'EXPIRING' | 'REVOKED';

/** 角色定义在具体主体上的授权实例；主体可以是人工账号、服务账号或组织。 */
export interface RoleAssignmentSummary {
  assignmentId: string;
  subjectId: string;
  subjectName: string;
  subjectType: RoleAssignmentSubjectType;
  tenantId: string;
  organizationName: string;
  roleCode: RoleCode;
  scopeSummary: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  status: RoleAssignmentStatus;
  effectiveFrom: string;
  expiresAt: string;
  grantedBy: string;
  updatedAt: string;
  requestId?: string;
}

export type RoleAssignmentChangeType = 'GRANT' | 'ADJUST' | 'REVOKE';

/** 权限变更申请只表达意图，不代表授权事实已经生效。 */
export interface RoleAssignmentChangeInput {
  changeType: RoleAssignmentChangeType;
  subjectType: RoleAssignmentSubjectType;
  subjectId: string;
  subjectName: string;
  tenantId: string;
  organizationName: string;
  roleCode: RoleCode;
  scopeSummary: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  effectiveFrom: string;
  expiresAt: string;
  reasonCode: string;
  justification: string;
}

export interface RoleAssignmentChangeReceipt {
  requestId: string;
  status: 'PENDING_APPROVAL';
  changeType: RoleAssignmentChangeType;
  subjectType: RoleAssignmentSubjectType;
  subjectId: string;
  subjectName: string;
  tenantId: string;
  organizationName: string;
  roleCode: RoleCode;
  scopeSummary: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  effectiveFrom: string;
  expiresAt: string;
  reasonCode: string;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type AccessReviewStatus = 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'OVERDUE';
export type AccessReviewResult = 'RETAIN' | 'NARROW' | 'REVOKE' | 'PENDING';

/** 定期访问复核对象，基于有效角色授权和最近使用事实生成。 */
export interface AccessReviewSummary {
  reviewId: string;
  subjectId: string;
  subjectName: string;
  subjectType: RoleAssignmentSubjectType;
  tenantId: string;
  roleCodes: readonly RoleCode[];
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  resourceSummary: string;
  actionSummary: string;
  dataClassification: string;
  status: AccessReviewStatus;
  reviewResult: AccessReviewResult;
  expiresAt: string;
  lastUsedAt: string;
  reviewerName: string;
  updatedAt: string;
}

export interface AccessReviewRequestInput {
  reviewId: string;
  result: Exclude<AccessReviewResult, 'PENDING'>;
  reasonCode: string;
  comment: string;
}

export interface AccessReviewRequestReceipt {
  requestId: string;
  status: 'PENDING_APPROVAL';
  reviewId: string;
  result: Exclude<AccessReviewResult, 'PENDING'>;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

/** 合作方/租户主体类型，统一承载城市运营方、车企/TSP、数据提供方及供应商。 */
export type PartnerType = 'CITY_OPERATOR' | 'OEM_TSP' | 'DATA_PROVIDER' | 'SUPPLIER';
export type PartnerLifecycleStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'EXITING' | 'CLOSED';
export type CredentialLifecycleStatus = 'VALID' | 'EXPIRING' | 'REVOKED' | 'UNKNOWN';
export type TrustDecision = 'TRUSTED' | 'PARTIAL' | 'BLOCKED' | 'UNKNOWN';

/** 租户/合作方在准入工作台的只读摘要，不代表协议或凭证事实本身。 */
export interface PartnerSummary {
  partnerId: string;
  tenantId: string;
  partnerName: string;
  partnerType: PartnerType;
  legalName: string;
  protocolVersion: string;
  protocolExpiresAt: string;
  ownerName: string;
  contactName: string;
  contactEmail: string;
  dataProcessingRole: string;
  onCallContact: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  scopeSummary: string;
  status: PartnerLifecycleStatus;
  applicationCount: number;
  endpointCount: number;
  updatedAt: string;
}

/** ApplicationClient 与端点、凭证引用的治理摘要。 */
export interface ApplicationClientSummary {
  applicationClientId: string;
  partnerId: string;
  tenantId: string;
  applicationName: string;
  purpose: string;
  scopeSummary: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  endpointRefs: readonly string[];
  credentialRefs: readonly string[];
  networkAllowlist: readonly string[];
  authMethod: string;
  endpointStatus: IntegrationStatus;
  credentialStatus: CredentialLifecycleStatus;
  quota: string;
  ownerName: string;
  status: PartnerLifecycleStatus;
  updatedAt: string;
}

/** 端点与凭证引用的逐环境治理摘要，不保存地址密钥正文。 */
export interface EndpointCredentialSummary {
  endpointId: string;
  applicationClientId: string;
  tenantId: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  endpointAddressMasked: string;
  networkZone: string;
  authMethod: string;
  credentialRef: string;
  credentialIssuer: string;
  credentialExpiresAt: string;
  credentialStatus: CredentialLifecycleStatus;
  endpointStatus: IntegrationStatus;
  trustDecision: TrustDecision;
  lastVerifiedAt: string;
  ownerName: string;
  updatedAt: string;
}

export type PartnerOnboardingReasonCode = 'NEW_PARTNER' | 'NEW_APPLICATION' | 'ENVIRONMENT_EXPANSION' | 'PARTNER_RECOVERY';

/** 合作方/租户接入申请，提交后进入准入审核，不直接创建生产身份。 */
export interface PartnerOnboardingInput {
  partnerType: PartnerType;
  tenantId: string;
  partnerName: string;
  legalName: string;
  protocolVersion: string;
  protocolExpiresAt: string;
  applicationClientId: string;
  applicationName: string;
  purpose: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  scopeSummary: string;
  networkAllowlist: readonly string[];
  authMethod: string;
  ownerName: string;
  contactName: string;
  contactEmail: string;
  reasonCode: PartnerOnboardingReasonCode;
  justification: string;
}

export interface PartnerOnboardingReceipt {
  requestId: string;
  status: 'PENDING_REVIEW';
  partnerType: PartnerType;
  tenantId: string;
  partnerName: string;
  applicationClientId: string;
  applicationName: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  reasonCode: PartnerOnboardingReasonCode;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type PartnerLifecycleAction = 'FREEZE' | 'RESTORE' | 'START_EXIT';

export interface PartnerLifecycleChangeInput {
  partnerId: string;
  action: PartnerLifecycleAction;
  reasonCode: string;
  justification: string;
}

export interface PartnerLifecycleChangeReceipt {
  requestId: string;
  status: 'PENDING_REVIEW';
  partnerId: string;
  action: PartnerLifecycleAction;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type ApplicationAccessAction = 'CONNECT_TEST' | 'ROTATE_CREDENTIAL' | 'REVOKE_CREDENTIAL';

export interface ApplicationAccessActionInput {
  applicationClientId: string;
  /** 端点级操作必须绑定具体端点；未填写时表示应用级批量意图。 */
  endpointId?: string;
  environment?: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  action: ApplicationAccessAction;
  reasonCode: string;
  justification: string;
}

export interface ApplicationAccessActionReceipt {
  requestId: string;
  status: 'PENDING_EXECUTION' | 'PENDING_REVIEW';
  applicationClientId: string;
  endpointId?: string;
  environment?: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  action: ApplicationAccessAction;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type EndpointVerificationCheckType = 'DNS_NETWORK' | 'TLS_MTLS' | 'CERTIFICATE_CHAIN' | 'APPLICATION_IDENTITY' | 'SCOPE' | 'PROTOCOL_HANDSHAKE';
export type EndpointVerificationCheckStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'PENDING' | 'UNKNOWN';

/** 接入网关对端点执行的逐项核验记录，生产环境应由网关回传而非前端推导。 */
export interface EndpointVerificationCheckSummary {
  checkId: string;
  endpointId: string;
  applicationClientId: string;
  tenantId: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  checkType: EndpointVerificationCheckType;
  label: string;
  status: EndpointVerificationCheckStatus;
  observedAt: string;
  sourceSystem: string;
  traceId: string;
  message: string;
  remediation: string;
}

export interface AuthorizationResource {
  tenantId?: string;
  environment?: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  scope?: string;
  ownerActorId?: string;
  state?: string;
}

export interface ActorContext {
  actorId: string;
  displayName: string;
  tenantId: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  roles: readonly RoleCode[];
  permissions: ReadonlySet<PermissionCode>;
  scopes: readonly string[];
}

export type AuditDecision = 'ALLOWED' | 'DENIED';

/**
 * 权限与业务操作共用的审计摘要。
 * 生产实现应由审计服务生成，前端只负责查询与展示，不在浏览器补写事实。
 */
export interface AuditEventSummary {
  eventId: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  actorRoles: readonly RoleCode[];
  permission: PermissionCode;
  actionLabel: string;
  decision: AuditDecision;
  reasonCode: string;
  reason: string;
  resourceType: string;
  resourceId: string;
  tenantId: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  sourceSystem: string;
  traceId: string;
}

export type IntegrationStatus = 'CONNECTED' | 'PARTIAL' | 'DEGRADED' | 'PENDING' | 'NOT_CONNECTED';

export interface SystemIntegrationSummary {
  integrationId: string;
  systemName: string;
  systemType: string;
  ownerName: string;
  environments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  dataDomains: readonly string[];
  status: IntegrationStatus;
  lastObservedAt: string;
  sourceSystem: string;
  dependencySummary: string;
  nextAction: string;
  updatedAt: string;
}

export interface ApiProblem {
  code: string;
  title: string;
  detail: string;
  traceId: string;
  retryable: boolean;
  fieldErrors?: Readonly<Record<string, string>>;
}

export interface PageResult<T> {
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  dataTime: string;
}

export interface CommandEnvelope<T> {
  payload: T;
  idempotencyKey: string;
  etag: string;
  reasonCode?: string;
}
