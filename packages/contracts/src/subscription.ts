export const fr2StateFamilies = {
  requestRevisionLifecycle: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'WITHDRAWN', 'ABANDONED', 'REQUEST_EXPIRED', 'SUPERSEDED'],
  precheckRunStatus: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  precheckOutcome: ['PASS', 'PASS_WITH_CONDITIONS', 'BLOCKED', 'INCONCLUSIVE'],
  precheckValidity: ['CURRENT', 'STALE', 'EXPIRED', 'INVALIDATED'],
  approvalCase: ['PENDING', 'IN_REVIEW', 'APPROVED', 'CONDITIONALLY_APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  instanceLifecycle: ['PENDING_ACTIVATION', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'REVOKED', 'TERMINATED', 'SUPERSEDED'],
  controlStatus: ['ENABLED', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'STOP_REQUESTED', 'STOPPED'],
  activationReadiness: ['NOT_EVALUATED', 'EVALUATING', 'READY', 'BLOCKED', 'STALE'],
  runtimeSession: ['CREATED', 'ACTIVE', 'EXPIRING', 'CLOSED', 'TIMED_OUT', 'REVOKED'],
  executionCondition: ['PENDING', 'SATISFIED', 'VIOLATED', 'EXPIRED', 'WAIVED'],
  subscriptionChange: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  impactStatus: ['CALCULATING', 'EXECUTABLE', 'HAS_UNKNOWN', 'CLOSED'],
  impactValidity: ['CURRENT', 'STALE', 'EXPIRED', 'INVALIDATED'],
  cutoverPlan: ['PLANNED', 'EXECUTING', 'PARTIAL', 'ROLLING_BACK', 'SUCCEEDED', 'ROLLED_BACK', 'FAILED', 'CANCELLED'],
  controlRequest: ['REQUESTED', 'EXECUTING', 'PARTIAL', 'SUCCEEDED', 'FAILED', 'UNKNOWN'],
  exitChecklist: ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFY', 'COMPLETED'],
  remediationCase: ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFY', 'COMPLETED', 'CANCELLED'],
} as const;

export type StateFamilyName = keyof typeof fr2StateFamilies;
export type RequestRevisionStatus = (typeof fr2StateFamilies.requestRevisionLifecycle)[number];
export type PrecheckOutcome = (typeof fr2StateFamilies.precheckOutcome)[number];
export type PrecheckValidity = (typeof fr2StateFamilies.precheckValidity)[number];
export type InstanceLifecycle = (typeof fr2StateFamilies.instanceLifecycle)[number];
export type ActivationReadiness = (typeof fr2StateFamilies.activationReadiness)[number];

export interface SubscriptionRequestSummary {
  requestId: string;
  requestRevision: number;
  subscriptionId?: string;
  oemName: string;
  applicationName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  serviceName: string;
  channelType: 'UU_A' | 'UU_B' | 'PC5' | 'UU_T';
  coverageSummary: string;
  requestStatus: RequestRevisionStatus;
  precheckOutcome: PrecheckOutcome;
  precheckValidity: PrecheckValidity;
  blockerCount: number;
  ownerName: string;
  updatedAt: string;
  etag: string;
}

/** 申请草稿创建只登记申请输入和版本，不代表已提交或已获得审批。 */
export interface SubscriptionDraftInput {
  serviceId: string;
  entitlementId: string;
  applicationClientId: string;
  capabilityGroupId: string;
  coverageId: string;
  channelType: 'UU_A' | 'UU_B' | 'PC5' | 'UU_T';
  validTo: string;
}

export interface SubscriptionDraftReceipt {
  requestId: string;
  requestRevision: number;
  requestStatus: 'DRAFT';
  serviceId: string;
  entitlementId: string;
  applicationClientId: string;
  capabilityGroupId: string;
  coverageId: string;
  channelType: SubscriptionDraftInput['channelType'];
  validTo: string;
  createdAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export interface SubscriptionSummary {
  subscriptionId: string;
  oemName: string;
  applicationName: string;
  serviceName: string;
  serviceVersion: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  lifecycle: InstanceLifecycle;
  activationReadiness: ActivationReadiness;
  controlStatus: (typeof fr2StateFamilies.controlStatus)[number];
  currentRevision: number;
  instanceCount: number;
  updatedAt: string;
}

export type SubscriptionRevisionStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
export type RevisionDiffCategory = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'NARROWED' | 'UNCHANGED';
export type RevisionDiffImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SubscriptionRevisionSummary {
  revisionId: string;
  subscriptionId: string;
  revision: number;
  status: SubscriptionRevisionStatus;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  serviceName: string;
  scopeSummary: string;
  channelType: 'UU_A' | 'UU_B' | 'PC5' | 'UU_T';
  validPeriod: string;
  capabilitySummary: string;
  changeSummary: string;
  ownerName: string;
  createdAt: string;
}

export interface SubscriptionRevisionDiff {
  diffId: string;
  subscriptionId: string;
  fromRevision: number;
  toRevision: number;
  category: RevisionDiffCategory;
  field: string;
  beforeValue: string;
  afterValue: string;
  impact: RevisionDiffImpact;
  requiresRequalification: boolean;
}

export type SubscriptionChangeType = 'RENEWAL' | 'SCOPE_NARROWING' | 'SERVICE_ADJUSTMENT';
export type SubscriptionChangeReasonCode = 'VALIDITY_EXTENSION' | 'SCOPE_REDUCTION' | 'SERVICE_REQUIREMENT_UPDATE';

/** 订阅变更请求只表达待审批意图；不会直接修改当前获批版本或实例。 */
export interface SubscriptionChangeInput {
  subscriptionId: string;
  baseRevision: number;
  changeType: SubscriptionChangeType;
  targetValidTo?: string;
  targetScope?: string;
  changeSummary: string;
  reasonCode: SubscriptionChangeReasonCode;
  justification: string;
}

export interface SubscriptionChangeReceipt {
  requestId: string;
  status: 'PENDING_APPROVAL';
  subscriptionId: string;
  baseRevision: number;
  changeType: SubscriptionChangeType;
  targetValidTo?: string;
  targetScope?: string;
  changeSummary: string;
  reasonCode: SubscriptionChangeReasonCode;
  justification: string;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type ControlPlanAction = 'PAUSE' | 'RESUME' | 'TERMINATE';
export type ControlPlanReasonCode = 'RUNTIME_RISK' | 'OEM_REQUEST' | 'SERVICE_RETIREMENT';

/** 控制计划请求只表达高风险控制意图；不直接切换订阅或实例状态。 */
export interface ControlPlanInput {
  subscriptionId: string;
  baseRevision: number;
  action: ControlPlanAction;
  instanceIds: readonly string[];
  reasonCode: ControlPlanReasonCode;
  justification: string;
}

export interface ControlPlanReceipt {
  planId: string;
  status: 'PENDING_APPROVAL';
  subscriptionId: string;
  baseRevision: number;
  action: ControlPlanAction;
  instanceIds: readonly string[];
  reasonCode: ControlPlanReasonCode;
  justification: string;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type ServiceAvailability = 'AVAILABLE' | 'PILOT' | 'SUSPENDED';

export interface ServiceCatalogSummary {
  serviceId: string;
  serviceName: string;
  serviceVersion: string;
  description: string;
  scenarioTags: readonly string[];
  channelTypes: readonly ('UU_A' | 'UU_B' | 'PC5' | 'UU_T')[];
  supportedEnvironments: readonly ('SANDBOX' | 'TEST' | 'PRODUCTION')[];
  coverageSummary: string;
  qualificationProfile: string;
  availability: ServiceAvailability;
  updatedAt: string;
}

export interface EntitlementSummary {
  entitlementId: string;
  serviceId: string;
  serviceName: string;
  oemName: string;
  applicationName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  coverageSummary: string;
  capabilitySummary: string;
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRING' | 'REVOKED' | 'EXPIRED';
  revision: number;
  ownerName: string;
  updatedAt: string;
}

export interface DeliveryEvidenceSummary {
  evidenceId: string;
  releasePlanId: string;
  subscriptionId: string;
  instanceId: string;
  serviceName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  receiveGrade: EvidenceGrade;
  displayGrade: EvidenceGrade;
  interactionGrade: EvidenceGrade;
  lastObservedAt: string;
  sourceSystem: string;
  ownerName: string;
  updatedAt: string;
}

export type EvidenceChainStatus = 'COMPLETE' | 'PARTIAL' | 'UNKNOWN' | 'BROKEN';
export type EvidenceEventStatus = 'CONFIRMED' | 'UNKNOWN' | 'FAILED';

export interface EvidenceEventSummary {
  eventId: string;
  stage: 'DELIVERY' | 'RECEIVE' | 'DISPLAY' | 'INTERACTION';
  occurredAt: string;
  sourceSystem: string;
  status: EvidenceEventStatus;
  correlationId: string;
  payloadSummary: string;
  reason: string;
}

export interface DeliveryEvidenceDetail extends DeliveryEvidenceSummary {
  chainStatus: EvidenceChainStatus;
  contentHash: string;
  traceId: string;
  events: readonly EvidenceEventSummary[];
}

export type IncidentCategory = 'DELIVERY' | 'RUNTIME' | 'CONFIGURATION' | 'RELEASE';
export type IncidentSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface IncidentSummary {
  incidentId: string;
  subscriptionId: string;
  instanceId: string;
  serviceName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
  ownerName: string;
  firstSeenAt: string;
  updatedAt: string;
}

export interface IncidentTimelineEntry {
  time: string;
  actor: string;
  action: string;
  detail: string;
  status: IncidentStatus;
}

export interface IncidentDetail extends IncidentSummary {
  rootCause: string;
  impactScope: string;
  responseSla: string;
  recoveryEvidence: string;
  nextAction: string;
  relatedEvidenceIds: readonly string[];
  timeline: readonly IncidentTimelineEntry[];
}

export type IncidentActionType = 'ACKNOWLEDGE' | 'ASSIGN' | 'RESOLVE';
export type IncidentActionReasonCode = 'CONFIRM_RECEIPT' | 'OWNER_HANDOFF' | 'RECOVERY_VERIFIED';

/** 事件处置请求只表达操作意图；回执记录不直接改写监控事实或事件状态。 */
export interface IncidentActionInput {
  incidentId: string;
  action: IncidentActionType;
  ownerName?: string;
  note: string;
  reasonCode: IncidentActionReasonCode;
}

export interface IncidentActionReceipt {
  actionId: string;
  status: 'RECORDED';
  incidentId: string;
  action: IncidentActionType;
  ownerName?: string;
  note: string;
  reasonCode: IncidentActionReasonCode;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type ReleaseStatus = 'NOT_REQUESTED' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
export type RuntimeHealth = 'NOT_MONITORED' | 'HEALTHY' | 'DEGRADED' | 'UNKNOWN';
export type EvidenceGrade = 'NOT_EVALUATED' | 'F0' | 'F1' | 'F2' | 'F3' | 'UNKNOWN';

export type ConfigurationStatus = 'DRAFT' | 'READY_FOR_TEST' | 'IN_TEST' | 'PUBLISHED' | 'BLOCKED';

export interface ConfigurationSummary {
  configurationId: string;
  subscriptionId: string;
  instanceId: string;
  serviceName: string;
  applicationName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  revision: number;
  status: ConfigurationStatus;
  parameterCount: number;
  pendingRequiredFields: number;
  coverageSummary: string;
  ownerName: string;
  updatedAt: string;
}

export type ConfigurationParameterStatus = 'SET' | 'MISSING' | 'INVALID' | 'UNKNOWN';

export interface ConfigurationParameterSummary {
  parameterId: string;
  groupName: string;
  label: string;
  value: string;
  required: boolean;
  status: ConfigurationParameterStatus;
  source: string;
  validationMessage: string;
}

export interface ConfigurationDetail extends ConfigurationSummary {
  schemaVersion: string;
  baseRevision: string;
  scopeHash: string;
  changeSummary: string;
  parameters: readonly ConfigurationParameterSummary[];
}

export type ConfigurationChangeType = 'CREATE' | 'UPDATE' | 'ROLLBACK';

/** 配置变更申请表达待审批意图，不代表配置版本已经保存、校验或生效。 */
export interface ConfigurationChangeInput {
  changeType: ConfigurationChangeType;
  configurationId: string;
  subscriptionId: string;
  instanceId: string;
  baseRevision: number;
  targetEnvironment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  changeSummary: string;
  reasonCode: string;
  justification: string;
  requiresRequalification: boolean;
}

export interface ConfigurationChangeReceipt {
  requestId: string;
  status: 'PENDING_APPROVAL';
  changeType: ConfigurationChangeType;
  configurationId: string;
  subscriptionId: string;
  instanceId: string;
  baseRevision: number;
  targetEnvironment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  changeSummary: string;
  reasonCode: string;
  justification: string;
  requiresRequalification: boolean;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type QualificationStatus = 'NOT_STARTED' | 'READY' | 'RUNNING' | 'PASSED' | 'FAILED' | 'BLOCKED';

export interface QualificationSummary {
  qualificationId: string;
  configurationId: string;
  subscriptionId: string;
  instanceId: string;
  serviceName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  testProfile: string;
  status: QualificationStatus;
  caseCount: number;
  passedCount: number;
  failedCount: number;
  ownerName: string;
  updatedAt: string;
}

export type QualificationCaseStatus = 'NOT_STARTED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'BLOCKED';

export interface QualificationCaseSummary {
  caseId: string;
  caseName: string;
  category: string;
  requirement: string;
  status: QualificationCaseStatus;
  evidenceGrade: EvidenceGrade;
  resultSummary: string;
  blockerReason: string;
  lastObservedAt: string;
}

export interface QualificationDetail extends QualificationSummary {
  profileVersion: string;
  entryGate: string;
  inputSnapshot: string;
  executor: string;
  testCases: readonly QualificationCaseSummary[];
}

/** 联合测试执行请求只表达执行意图；排队回执不代表测试结果已通过。 */
export interface QualificationExecutionInput {
  qualificationId: string;
  reasonCode: 'INITIAL_RUN' | 'RERUN_AFTER_CORRECTION' | 'RERUN_AFTER_DEPENDENCY_RECOVERY';
}

export interface QualificationExecutionReceipt {
  executionId: string;
  status: 'QUEUED';
  qualificationId: string;
  configurationId: string;
  profileVersion: string;
  reasonCode: QualificationExecutionInput['reasonCode'];
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export type ReleasePlanStatus = 'DRAFT' | 'READY' | 'SCHEDULED' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED';

export interface ReleasePlanSummary {
  releasePlanId: string;
  qualificationId: string;
  configurationId: string;
  subscriptionId: string;
  instanceId: string;
  serviceName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  strategy: 'CANARY' | 'FULL';
  targetTime: string;
  nodeCount: number;
  completedNodeCount: number;
  status: ReleasePlanStatus;
  ownerName: string;
  updatedAt: string;
}

export type ReleaseNodeStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED' | 'ROLLBACK_REQUIRED';

export interface ReleaseNodeSummary {
  nodeId: string;
  nodeName: string;
  targetScope: string;
  status: ReleaseNodeStatus;
  observedAt: string;
  receiptSummary: string;
  blockerReason: string;
}

export interface ReleasePlanDetail extends ReleasePlanSummary {
  releaseVersion: string;
  entryGate: string;
  changeWindow: string;
  rollbackPlan: string;
  prerequisiteSummary: string;
  nodes: readonly ReleaseNodeSummary[];
}

/** 发布执行请求只表达排期后的执行意图；排队回执不代表节点已完成。 */
export interface ReleaseExecutionInput {
  releasePlanId: string;
  reasonCode: 'INITIAL_RELEASE' | 'RETRY_AFTER_FIX' | 'ROLLBACK_AFTER_FAILURE';
}

export interface ReleaseExecutionReceipt {
  executionId: string;
  status: 'QUEUED';
  releasePlanId: string;
  releaseVersion: string;
  strategy: ReleasePlanSummary['strategy'];
  reasonCode: ReleaseExecutionInput['reasonCode'];
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export interface SubscriptionInstanceSummary {
  instanceId: string;
  subscriptionId: string;
  approvedRevisionId: string;
  effectiveRevisionId: string | null;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  coverageSummary: string;
  channelType: 'UU_A' | 'UU_B' | 'PC5' | 'UU_T';
  lifecycle: InstanceLifecycle;
  controlStatus: (typeof fr2StateFamilies.controlStatus)[number];
  activationReadiness: ActivationReadiness;
  releaseStatus: ReleaseStatus;
  runtimeHealth: RuntimeHealth;
  evidenceGrade: EvidenceGrade;
  updatedAt: string;
}

export interface SubscriptionDetail {
  summary: SubscriptionSummary;
  approvedRevisionId: string;
  targetRevisionId: string | null;
  instances: readonly SubscriptionInstanceSummary[];
  dataTime: string;
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  description: string;
}

export type PrecheckLayer = 'AUTHORIZATION' | 'CONTRACT' | 'QUALIFICATION' | 'ACCESS' | 'CONNECTIVITY';
export type FindingOutcome = 'PASS' | 'CONDITION' | 'BLOCKED' | 'UNKNOWN';
export type Severity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface EvidenceSummary {
  evidenceRef: string;
  objectType: string;
  objectId: string;
  revision: string;
  contentHash: string;
  source: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIABLE' | 'EXPIRED';
  accessLevel: 'NORMAL' | 'CONTROLLED' | 'RESTRICTED';
  validUntil: string;
}

export interface PrecheckFinding {
  findingId: string;
  ruleId: string;
  ruleName: string;
  layer: PrecheckLayer;
  severity: Severity;
  expected: string;
  actual: string;
  outcome: FindingOutcome;
  validity: PrecheckValidity;
  reasonCode: string;
  ownerName: string;
  nextAction: string;
  dueAt: string;
  evidence: readonly EvidenceSummary[];
  remediationCaseId?: string;
}

export interface PrecheckLayerSummary {
  layer: PrecheckLayer;
  label: string;
  passed: number;
  conditions: number;
  blocked: number;
  unknown: number;
  expired: number;
  evaluatedAt: string;
}

export interface PrecheckRunDetail {
  runId: string;
  requestId: string;
  requestRevision: number;
  inputSnapshotId: string;
  inputHash: string;
  ruleSetVersion: string;
  runStatus: (typeof fr2StateFamilies.precheckRunStatus)[number];
  outcome: PrecheckOutcome;
  validity: PrecheckValidity;
  startedAt: string;
  completedAt: string;
  progress: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  layers: readonly PrecheckLayerSummary[];
  findings: readonly PrecheckFinding[];
  referencedByApprovalCaseId?: string;
}

export interface SubmissionContext {
  requestId: string;
  draftRevision: number;
  oemName: string;
  applicationName: string;
  entitlementRevision: string;
  applicationClientId: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  contentHash: string;
  generatedAt: string;
  summaryValidity: PrecheckValidity;
  serviceName: string;
  purpose: string;
  capabilityGroup: string;
  coverage: string;
  schedule: string;
  channelProfile: string;
  qualityProfile: string;
  feedbackProfile: string;
  validPeriod: string;
  responsibility: string;
  exitObligation: string;
  scopeHash: string;
  reasonCodeVersion: string;
  precheck: PrecheckRunDetail;
  previousRevision?: number;
  changes: readonly { category: 'ADDED' | 'MODIFIED' | 'REMOVED' | 'NARROWED' | 'UNKNOWN'; field: string; before: string; after: string }[];
}

export interface SubmissionReceipt {
  requestId: string;
  requestRevision: number;
  contentHash: string;
  approvalCaseId: string;
  submittedAt: string;
  idempotencyKey: string;
  requestStatus: 'SUBMITTED';
}

export interface RemediationCaseDetail {
  caseId: string;
  status: (typeof fr2StateFamilies.remediationCase)[number];
  sourceType: 'PRECHECK_FINDING' | 'APPROVAL_ISSUE' | 'DEPENDENCY_CHANGE';
  sourceId: string;
  requestId: string;
  requestRevision: number;
  precheckRunId: string;
  ruleId: string;
  issueSummary: string;
  affectedScope: string;
  remediationType: string;
  ownerName: string;
  collaborators: readonly string[];
  dueAt: string;
  requiredEvidence: string;
  nextAction: string;
  priority: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  verifierName: string;
  evidence: readonly EvidenceSummary[];
  history: readonly { time: string; actor: string; action: string; detail: string }[];
}

export type RemediationActionType = 'SUBMIT_MATERIALS' | 'REQUEST_RECHECK';
export type RemediationActionReasonCode = 'MATERIALS_SUPPLEMENTED' | 'RECHECK_REQUESTED';

/** 补正动作只提交处理意图和材料引用，不直接关闭任务或改写准入结果。 */
export interface RemediationActionInput {
  caseId: string;
  action: RemediationActionType;
  evidenceRefs: readonly string[];
  note: string;
  reasonCode: RemediationActionReasonCode;
}

export interface RemediationActionReceipt {
  actionId: string;
  status: 'RECORDED';
  caseId: string;
  action: RemediationActionType;
  evidenceRefs: readonly string[];
  note: string;
  reasonCode: RemediationActionReasonCode;
  submittedAt: string;
  idempotencyKey: string;
  nextStep: string;
}

export interface ApprovalNode {
  nodeId: string;
  nodeName: string;
  assigneeName: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'RETURNED';
  dueAt: string;
  parallelGroup?: string;
}

export interface ConditionCandidate {
  candidateId: string;
  sourceFindingId: string;
  candidateType: 'ACTIVATION_PREREQUISITE' | 'ONGOING_OBLIGATION' | 'SCOPE_RESTRICTION';
  description: string;
  hardGate: boolean;
}

export interface ApprovalCaseSummary {
  approvalCaseId: string;
  requestId: string;
  requestRevision: number;
  status: (typeof fr2StateFamilies.approvalCase)[number];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  serviceName: string;
  oemName: string;
  applicationName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  currentAssigneeId: string;
  currentAssigneeName: string;
  dueAt: string;
  precheckOutcome: PrecheckOutcome;
  hardBlockerCount: number;
  updatedAt: string;
}

export interface ApprovalCaseDetail {
  approvalCaseId: string;
  requestId: string;
  requestRevision: number;
  requestContentHash: string;
  precheckRunId: string;
  approvalMatrixVersion: string;
  status: (typeof fr2StateFamilies.approvalCase)[number];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  applicantName: string;
  applicantId: string;
  serviceName: string;
  oemName: string;
  applicationName: string;
  environment: 'SANDBOX' | 'TEST' | 'PRODUCTION';
  scopeSummary: string;
  entitlementLimit: string;
  precheckOutcome: PrecheckOutcome;
  precheckValidity: PrecheckValidity;
  hardBlockerCount: number;
  currentAssigneeId: string;
  currentAssigneeName: string;
  dueAt: string;
  sodPassed: boolean;
  nodes: readonly ApprovalNode[];
  conditionCandidates: readonly ConditionCandidate[];
}

export type ApprovalDecisionType = 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'RETURNED' | 'REJECTED';

export interface ExecutionConditionDraft {
  sourceFindingId: string;
  sourceCandidateId: string;
  candidateDisposition: 'ACCEPTED' | 'REJECTED' | 'TRANSFORMED';
  conditionType: ConditionCandidate['candidateType'];
  scope: string;
  description: string;
  ownerName: string;
  dueAt: string;
  evidenceRule: string;
  breachAction: string;
  blocksActivation: boolean;
}

export interface ApprovalDecisionInput {
  decision: ApprovalDecisionType;
  reasonCode: string;
  comment: string;
  condition?: ExecutionConditionDraft;
  returnRequirements?: string;
  returnOwnerName?: string;
  returnDueAt?: string;
  resubmitScope?: string;
  rejectionBasis?: string;
  allowReapply?: boolean;
  reapplyGuidance?: string;
}

export interface ApprovalDecisionReceipt {
  decisionId: string;
  approvalCaseId: string;
  requestId: string;
  requestRevision: number;
  decision: ApprovalDecisionType;
  reasonCode: string;
  comment: string;
  decidedAt: string;
  idempotencyKey: string;
  condition?: ExecutionConditionDraft;
  returnRequirements?: string;
  rejectionBasis?: string;
  subscriptionRevisionId?: string;
  successorDraftPath?: string;
}
