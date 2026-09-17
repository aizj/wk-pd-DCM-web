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
  PartnerSummary,
  ApplicationClientSummary,
  PartnerOnboardingInput,
  PartnerOnboardingReceipt,
  PartnerLifecycleChangeInput,
  PartnerLifecycleChangeReceipt,
  ApplicationAccessActionInput,
  ApplicationAccessActionReceipt,
  EndpointCredentialSummary,
  EndpointVerificationCheckSummary,
  AccessReviewSummary,
  AccessReviewRequestInput,
  AccessReviewRequestReceipt,
} from '@vrc/contracts';
import { subscriptionRepository } from '../../mocks/subscription-repository';

/** 页面只依赖业务网关。真实接口接入时替换实现，不改页面的数据语义。 */
export interface SubscriptionGateway {
  listCatalog(search?: string): Promise<PageResult<ServiceCatalogSummary>>;
  listEntitlements(search?: string): Promise<PageResult<EntitlementSummary>>;
  listEvidence(search?: string): Promise<PageResult<DeliveryEvidenceSummary>>;
  getEvidence(evidenceId: string): Promise<DeliveryEvidenceDetail>;
  listIncidents(search?: string): Promise<PageResult<IncidentSummary>>;
  getIncident(incidentId: string): Promise<IncidentDetail>;
  recordIncidentAction(input: IncidentActionInput, idempotencyKey: string): Promise<IncidentActionReceipt>;
  listIncidentActionReceipts(): Promise<PageResult<IncidentActionReceipt>>;
  listAuditEvents(search?: string): Promise<PageResult<AuditEventSummary>>;
  listIntegrations(search?: string): Promise<PageResult<SystemIntegrationSummary>>;
  listPartners(search?: string): Promise<PageResult<PartnerSummary>>;
  getPartner(partnerId: string): Promise<PartnerSummary>;
  listApplicationClients(search?: string): Promise<PageResult<ApplicationClientSummary>>;
  listEndpointCredentials(search?: string): Promise<PageResult<EndpointCredentialSummary>>;
  getEndpointCredential(endpointId: string): Promise<EndpointCredentialSummary>;
  listEndpointVerificationChecks(endpointId?: string): Promise<PageResult<EndpointVerificationCheckSummary>>;
  getApplicationClient(applicationClientId: string): Promise<ApplicationClientSummary>;
  requestPartnerOnboarding(input: PartnerOnboardingInput, idempotencyKey: string): Promise<PartnerOnboardingReceipt>;
  listPartnerOnboardingRequests(): Promise<PageResult<PartnerOnboardingReceipt>>;
  requestPartnerLifecycleChange(input: PartnerLifecycleChangeInput, idempotencyKey: string): Promise<PartnerLifecycleChangeReceipt>;
  requestApplicationAccessAction(input: ApplicationAccessActionInput, idempotencyKey: string): Promise<ApplicationAccessActionReceipt>;
  listPartnerLifecycleChangeRequests(): Promise<PageResult<PartnerLifecycleChangeReceipt>>;
  listApplicationAccessActionRequests(): Promise<PageResult<ApplicationAccessActionReceipt>>;
  listRoleAssignments(search?: string): Promise<PageResult<RoleAssignmentSummary>>;
  listAccessReviews(search?: string): Promise<PageResult<AccessReviewSummary>>;
  requestAccessReview(input: AccessReviewRequestInput, idempotencyKey: string): Promise<AccessReviewRequestReceipt>;
  listAccessReviewRequests(): Promise<PageResult<AccessReviewRequestReceipt>>;
  requestRoleAssignmentChange(input: RoleAssignmentChangeInput, idempotencyKey: string): Promise<RoleAssignmentChangeReceipt>;
  listRoleAssignmentChangeRequests(): Promise<PageResult<RoleAssignmentChangeReceipt>>;
  requestRolePermissionConfigChange(input: RolePermissionConfigChangeInput, idempotencyKey: string): Promise<RolePermissionConfigChangeReceipt>;
  listRolePermissionConfigChangeRequests(): Promise<PageResult<RolePermissionConfigChangeReceipt>>;
  listApprovalCases(search?: string): Promise<PageResult<ApprovalCaseSummary>>;
  listRequests(search?: string): Promise<PageResult<SubscriptionRequestSummary>>;
  createSubscriptionDraft(input: SubscriptionDraftInput, idempotencyKey: string): Promise<SubscriptionDraftReceipt>;
  getSubscriptionDraft(requestId: string): Promise<SubscriptionDraftReceipt | null>;
  listSubscriptions(): Promise<PageResult<SubscriptionSummary>>;
  listSubscriptionRevisions(subscriptionId?: string): Promise<PageResult<SubscriptionRevisionSummary>>;
  listRevisionDiffs(subscriptionId: string, fromRevision: number, toRevision: number): Promise<PageResult<SubscriptionRevisionDiff>>;
  listInstances(): Promise<PageResult<SubscriptionInstanceSummary>>;
  listConfigurations(search?: string): Promise<PageResult<ConfigurationSummary>>;
  getConfiguration(configurationId: string): Promise<ConfigurationDetail>;
  requestConfigurationChange(input: ConfigurationChangeInput, idempotencyKey: string): Promise<ConfigurationChangeReceipt>;
  listConfigurationChangeRequests(): Promise<PageResult<ConfigurationChangeReceipt>>;
  listQualifications(search?: string): Promise<PageResult<QualificationSummary>>;
  getQualification(qualificationId: string): Promise<QualificationDetail>;
  requestQualificationExecution(input: QualificationExecutionInput, idempotencyKey: string): Promise<QualificationExecutionReceipt>;
  listReleasePlans(search?: string): Promise<PageResult<ReleasePlanSummary>>;
  getReleasePlan(releasePlanId: string): Promise<ReleasePlanDetail>;
  requestReleaseExecution(input: ReleaseExecutionInput, idempotencyKey: string): Promise<ReleaseExecutionReceipt>;
  getSubscription(subscriptionId: string): Promise<SubscriptionDetail>;
  requestSubscriptionChange(input: SubscriptionChangeInput, idempotencyKey: string): Promise<SubscriptionChangeReceipt>;
  listSubscriptionChangeRequests(): Promise<PageResult<SubscriptionChangeReceipt>>;
  requestControlPlan(input: ControlPlanInput, idempotencyKey: string): Promise<ControlPlanReceipt>;
  listControlPlanRequests(): Promise<PageResult<ControlPlanReceipt>>;
  dashboardMetrics(): Promise<readonly DashboardMetric[]>;
  getSubmissionContext(requestId: string): Promise<SubmissionContext>;
  getSubmissionReceipt(requestId: string): Promise<SubmissionReceipt | null>;
  submitRequest(requestId: string, idempotencyKey: string): Promise<SubmissionReceipt>;
  getPrecheckRun(runId: string): Promise<PrecheckRunDetail>;
  getFinding(findingId: string): Promise<PrecheckFinding>;
  getRemediationCase(caseId: string): Promise<RemediationCaseDetail>;
  recordRemediationAction(input: RemediationActionInput, idempotencyKey: string): Promise<RemediationActionReceipt>;
  listRemediationActionReceipts(): Promise<PageResult<RemediationActionReceipt>>;
  getApprovalCase(caseId: string): Promise<ApprovalCaseDetail>;
  decideApproval(caseId: string, idempotencyKey: string, input: ApprovalDecisionInput): Promise<ApprovalDecisionReceipt>;
}

export const subscriptionGateway: SubscriptionGateway = subscriptionRepository;
