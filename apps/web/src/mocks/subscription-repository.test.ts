import { afterEach, describe, expect, it } from 'vitest';
import type { ActorContext } from '@vrc/contracts';
import { mockActor } from '../core/auth/permissions';
import { setDataScopeContext } from '../core/auth/data-scope';
import { subscriptionRepository } from './subscription-repository';

afterEach(() => setDataScopeContext(null));

describe('subscriptionRepository transaction semantics', () => {
  it('keeps catalog availability separate from entitlement scope', async () => {
    const services = await subscriptionRepository.listCatalog('信号灯');
    const rights = await subscriptionRepository.listEntitlements('信号灯');

    expect(services.items).toHaveLength(1);
    expect(services.items[0]?.availability).toBe('AVAILABLE');
    expect(rights.items[0]?.entitlementId).toBe('ENT-JN-SANDBOX-001');
    expect(rights.items[0]?.coverageSummary).toContain('38路口');
  });
  it('creates a sandbox draft from service entitlement context and continues to submission', async () => {
    const input = {
      serviceId: 'SVC-VRU-1.5',
      entitlementId: 'ENT-JN-TEST-004',
      applicationClientId: 'APP-QILU-VRU-01',
      capabilityGroupId: 'CAP-VRU-CONFIRMED-02',
      coverageId: 'COV-JINAN-WEST-001',
      channelType: 'UU_A' as const,
      validTo: '2026-10-10',
    };
    const first = await subscriptionRepository.createSubscriptionDraft(input, 'DRAFT-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.createSubscriptionDraft(input, 'DRAFT-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.requestStatus).toBe('DRAFT');
    const context = await subscriptionRepository.getSubmissionContext(first.requestId);
    expect(context.serviceName).toContain('超视距弱势交通参与者碰撞预警');
    expect(context.entitlementRevision).toBe('ENT-JN-TEST-004@2');
    expect((await subscriptionRepository.listRequests()).items.find((item) => item.requestId === first.requestId)?.requestStatus).toBe('DRAFT');
    const submitted = await subscriptionRepository.submitRequest(first.requestId, 'SUBMIT-DRAFT-001');
    expect(submitted.approvalCaseId).toContain('APR-240916-');
    expect(await subscriptionRepository.submitRequest(first.requestId, 'SUBMIT-DRAFT-001')).toBe(submitted);
    expect((await subscriptionRepository.listRequests()).items.find((item) => item.requestId === first.requestId)?.requestStatus).toBe('SUBMITTED');
    const dynamicApproval = await subscriptionRepository.getApprovalCase(submitted.approvalCaseId);
    expect(dynamicApproval.requestId).toBe(first.requestId);
    const candidate = dynamicApproval.conditionCandidates[0]!;
    const decision = await subscriptionRepository.decideApproval(submitted.approvalCaseId, 'DECIDE-DRAFT-001', {
      decision: 'CONDITIONALLY_APPROVED',
      reasonCode: 'APPROVED_WITH_SCOPE_RESTRICTION',
      comment: '测试范围和有效期均在当前企业权益边界内，附条件进入后续交付。',
      condition: {
        sourceFindingId: candidate.sourceFindingId,
        sourceCandidateId: candidate.candidateId,
        candidateDisposition: 'ACCEPTED',
        conditionType: 'SCOPE_RESTRICTION',
        scope: 'TEST / 济南西站示范区',
        description: candidate.description,
        ownerName: '赵明',
        dueAt: '2026-09-20',
        evidenceRule: '保留测试接收、展示和交互证据，并在期限内完成核验。',
        breachAction: '条件未满足时暂停开通并创建补正任务。',
        blocksActivation: true,
      },
    });
    expect(decision.decision).toBe('CONDITIONALLY_APPROVED');
    await expect(subscriptionRepository.createSubscriptionDraft({ ...input, validTo: '2026-12-31' }, 'DRAFT-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.createSubscriptionDraft({ ...input, entitlementId: 'ENT-JN-SANDBOX-005' }, 'DRAFT-REVOKED-001')).rejects.toThrow('DRAFT_ENTITLEMENT_MISMATCH');
  });

  it('keeps atomic instance counts and unknown downstream facts explicit', async () => {
    const summaries = await subscriptionRepository.listSubscriptions();
    const instances = await subscriptionRepository.listInstances();
    for (const summary of summaries.items) {
      const detail = await subscriptionRepository.getSubscription(summary.subscriptionId);
      expect(detail.instances).toHaveLength(summary.instanceCount);
      expect(detail.instances.every((item) => item.subscriptionId === summary.subscriptionId)).toBe(true);
    }
    expect(instances.items).toHaveLength(summaries.items.reduce((total, item) => total + item.instanceCount, 0));
    expect(instances.items.every((item) => item.lifecycle !== 'ACTIVE' || item.releaseStatus === 'SUCCEEDED')).toBe(true);
  });
  it('records remediation material and recheck intents without mutating the case fact', async () => {
    const input = {
      caseId: 'REM-240916-001',
      action: 'SUBMIT_MATERIALS' as const,
      evidenceRefs: ['EVD-CAP-240916-011'],
      note: '已补充车型能力授权材料，并确认有效期不超过权益截止日。',
      reasonCode: 'MATERIALS_SUPPLEMENTED' as const,
    };
    const first = await subscriptionRepository.recordRemediationAction(input, 'REMEDIATION-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.recordRemediationAction(input, 'REMEDIATION-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('RECORDED');
    expect((await subscriptionRepository.listRemediationActionReceipts()).items).toContain(first);
    expect((await subscriptionRepository.getRemediationCase(input.caseId)).status).toBe('PENDING_VERIFY');
    await expect(subscriptionRepository.recordRemediationAction({ ...input, action: 'REQUEST_RECHECK', reasonCode: 'RECHECK_REQUESTED' }, 'REMEDIATION-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.recordRemediationAction({ ...input, evidenceRefs: [] }, 'REMEDIATION-EVIDENCE-001')).rejects.toThrow('REMEDIATION_EVIDENCE_REQUIRED');
    await expect(subscriptionRepository.recordRemediationAction({ ...input, reasonCode: 'RECHECK_REQUESTED' }, 'REMEDIATION-REASON-001')).rejects.toThrow('REMEDIATION_ACTION_INPUT_INVALID');
    await expect(subscriptionRepository.recordRemediationAction({ ...input, action: 'REQUEST_RECHECK', reasonCode: 'RECHECK_REQUESTED' }, 'REMEDIATION-RECHECK-001')).resolves.toMatchObject({ action: 'REQUEST_RECHECK' });
  });
  it('lists configuration revisions with explicit readiness blockers', async () => {
    const all = await subscriptionRepository.listConfigurations();
    const filtered = await subscriptionRepository.listConfigurations('弱势交通参与者');

    expect(all.items).toHaveLength(3);
    expect(all.items.find((item) => item.configurationId === 'CFG-JN-0004-R1')?.status).toBe('BLOCKED');
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.pendingRequiredFields).toBe(1);
  });
  it('keeps configuration parameter readiness separate from release readiness', async () => {
    const detail = await subscriptionRepository.getConfiguration('CFG-JN-0001-R3');
    const blocked = await subscriptionRepository.getConfiguration('CFG-JN-0004-R1');

    expect(detail.schemaVersion).toBe('SPAT-UU-A-CONFIG v1.2');
    expect(detail.parameters.filter((item) => item.status === 'MISSING')).toHaveLength(2);
    expect(detail.status).toBe('READY_FOR_TEST');
    expect(blocked.parameters.some((item) => item.status === 'INVALID')).toBe(true);
    expect(blocked.status).toBe('BLOCKED');
  });
  it('keeps configuration change requests pending and idempotent without changing the active revision', async () => {
    const input = {
      changeType: 'UPDATE' as const,
      configurationId: 'CFG-JN-0001-R3',
      subscriptionId: 'SUB-JN-0001',
      instanceId: 'INS-JN-0001-A',
      baseRevision: 3,
      targetEnvironment: 'SANDBOX' as const,
      changeSummary: '补齐车端展示证据回传字段',
      reasonCode: 'PARAMETER_CORRECTION',
      justification: '当前配置缺少展示和交互证据参数，需要补齐字段后重新验证。',
      requiresRequalification: true,
    };
    const first = await subscriptionRepository.requestConfigurationChange(input, 'CFG-CHANGE-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestConfigurationChange(input, 'CFG-CHANGE-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect(first.baseRevision).toBe(3);
    expect(first.requiresRequalification).toBe(true);
    expect((await subscriptionRepository.listConfigurationChangeRequests()).items).toContain(first);
    expect((await subscriptionRepository.getConfiguration('CFG-JN-0001-R3')).revision).toBe(3);
    await expect(subscriptionRepository.requestConfigurationChange({ ...input, changeSummary: '改变基线' }, 'CFG-CHANGE-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestConfigurationChange(input, '   ')).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
    await expect(subscriptionRepository.requestConfigurationChange({ ...input, reasonCode: 'ROLLBACK_AFTER_FAILURE' }, 'CFG-CHANGE-REASON-001')).rejects.toThrow('CONFIGURATION_CHANGE_REASON_INVALID');
    await expect(subscriptionRepository.requestConfigurationChange({ ...input, baseRevision: 2 }, 'CFG-CHANGE-BASE-001')).rejects.toThrow('CONFIGURATION_CHANGE_INPUT_INVALID');
    await expect(subscriptionRepository.requestConfigurationChange({ ...input, targetEnvironment: 'TEST' }, 'CFG-CHANGE-ENV-001')).rejects.toThrow('CONFIGURATION_CHANGE_ENVIRONMENT_MISMATCH');
  });
  it('keeps blocked qualification tasks separate from passed test evidence', async () => {
    const tasks = await subscriptionRepository.listQualifications();
    const blocked = tasks.items.find((item) => item.status === 'BLOCKED');

    expect(tasks.items).toHaveLength(3);
    expect(blocked?.failedCount).toBe(2);
    expect(tasks.items.every((item) => item.status !== 'PASSED' || item.passedCount === item.caseCount)).toBe(true);
  });
  it('keeps qualification case blockers separate from task summary status', async () => {
    const ready = await subscriptionRepository.getQualification('QAL-JN-0001-A');
    const blocked = await subscriptionRepository.getQualification('QAL-JN-0004-A');

    expect(ready.testCases).toHaveLength(4);
    expect(ready.testCases.every((item) => item.status === 'NOT_STARTED')).toBe(true);
    expect(blocked.testCases.some((item) => item.status === 'FAILED')).toBe(true);
    expect(blocked.testCases.some((item) => item.status === 'BLOCKED')).toBe(true);
    expect(blocked.status).toBe('BLOCKED');
  });
  it('queues qualification execution only after the entry gate passes', async () => {
    const input = { qualificationId: 'QAL-JN-0001-A', reasonCode: 'INITIAL_RUN' as const };
    const first = await subscriptionRepository.requestQualificationExecution(input, 'QUAL-EXEC-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestQualificationExecution(input, 'QUAL-EXEC-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('QUEUED');
    expect(first.configurationId).toBe('CFG-JN-0001-R3');
    expect(first.nextStep).toContain('不代表测试已通过');
    await expect(subscriptionRepository.requestQualificationExecution({ qualificationId: 'QAL-JN-0004-A', reasonCode: 'INITIAL_RUN' }, 'QUAL-EXEC-BLOCKED-001')).rejects.toThrow('QUALIFICATION_ENTRY_GATE_BLOCKED');
    await expect(subscriptionRepository.requestQualificationExecution(input, '   ')).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
    await expect(subscriptionRepository.requestQualificationExecution({ ...input, reasonCode: 'BAD_REASON' as never }, 'QUAL-EXEC-REASON-001')).rejects.toThrow('QUALIFICATION_EXECUTION_INPUT_INVALID');
  });
  it('keeps release progress separate from delivery success', async () => {
    const plans = await subscriptionRepository.listReleasePlans();
    const failed = plans.items.find((item) => item.status === 'FAILED');

    expect(plans.items).toHaveLength(3);
    expect(failed?.completedNodeCount).toBeLessThan(failed?.nodeCount ?? 0);
    expect(plans.items.every((item) => item.status !== 'SUCCEEDED' || item.completedNodeCount === item.nodeCount)).toBe(true);
  });
  it('keeps release node receipts separate from plan status', async () => {
    const ready = await subscriptionRepository.getReleasePlan('REL-JN-0001-A');
    const failed = await subscriptionRepository.getReleasePlan('REL-JN-0004-A');

    expect(ready.nodes).toHaveLength(3);
    expect(ready.nodes.every((item) => item.status === 'PENDING')).toBe(true);
    expect(failed.nodes.some((item) => item.status === 'SUCCEEDED')).toBe(true);
    expect(failed.nodes.some((item) => item.status === 'FAILED')).toBe(true);
    expect(failed.nodes.some((item) => item.status === 'ROLLBACK_REQUIRED')).toBe(true);
    expect(failed.status).toBe('FAILED');
  });
  it('queues release execution only when the qualification gate is passed', async () => {
    const input = { releasePlanId: 'REL-JN-0001-A', reasonCode: 'INITIAL_RELEASE' as const };
    await expect(subscriptionRepository.requestReleaseExecution(input, 'RELEASE-EXEC-BLOCKED-001')).rejects.toThrow('RELEASE_ENTRY_GATE_BLOCKED');
    await expect(subscriptionRepository.requestReleaseExecution(input, '   ')).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
    await expect(subscriptionRepository.requestReleaseExecution({ ...input, reasonCode: 'BAD_REASON' as never }, 'RELEASE-EXEC-REASON-001')).rejects.toThrow('RELEASE_EXECUTION_INPUT_INVALID');
  });
  it('keeps revision comparison scoped to the selected subscription', async () => {
    const revisions = await subscriptionRepository.listSubscriptionRevisions('SUB-JN-0001');
    const diffs = await subscriptionRepository.listRevisionDiffs('SUB-JN-0001', 2, 3);

    expect(revisions.items.map((item) => item.revision)).toEqual([2, 3]);
    expect(diffs.items).toHaveLength(2);
    expect(diffs.items.some((item) => item.requiresRequalification)).toBe(true);
    expect((await subscriptionRepository.listSubscriptionRevisions('SUB-JN-0004')).items).toHaveLength(1);
  });
  it('keeps subscription change requests pending and scoped to the approved revision', async () => {
    const input = {
      subscriptionId: 'SUB-JN-0001',
      baseRevision: 3,
      changeType: 'SCOPE_NARROWING' as const,
      targetScope: '经十路东段 · 20路口',
      changeSummary: '收窄至东段示范范围',
      reasonCode: 'SCOPE_REDUCTION' as const,
      justification: '根据车企首批车型覆盖情况收窄范围，完成影响评估后重新测试。',
    };
    const first = await subscriptionRepository.requestSubscriptionChange(input, 'SUB-CHANGE-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestSubscriptionChange(input, 'SUB-CHANGE-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect(first.targetScope).toBe(input.targetScope);
    expect((await subscriptionRepository.listSubscriptionChangeRequests()).items).toContain(first);
    await expect(subscriptionRepository.requestSubscriptionChange({ ...input, targetScope: '济南市全域' }, 'SUB-CHANGE-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestSubscriptionChange({ ...input, baseRevision: 2 }, 'SUB-CHANGE-BASE-001')).rejects.toThrow('SUBSCRIPTION_CHANGE_INPUT_INVALID');
    await expect(subscriptionRepository.requestSubscriptionChange({ ...input, targetScope: '经十路示范走廊 · 38路口' }, 'SUB-CHANGE-SCOPE-001')).rejects.toThrow('SUBSCRIPTION_CHANGE_SCOPE_INVALID');
  });
  it('records control plans without mutating instance control state', async () => {
    const input = {
      subscriptionId: 'SUB-JN-0001',
      baseRevision: 3,
      action: 'PAUSE' as const,
      instanceIds: ['INS-JN-0001-A'],
      reasonCode: 'RUNTIME_RISK' as const,
      justification: '发现接收回执异常，先暂停东段实例新增投递并完成影响核验。',
    };
    const first = await subscriptionRepository.requestControlPlan(input, 'CTRL-PLAN-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestControlPlan(input, 'CTRL-PLAN-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect((await subscriptionRepository.getSubscription('SUB-JN-0001')).instances.find((item) => item.instanceId === 'INS-JN-0001-A')?.controlStatus).toBe('ENABLED');
    expect((await subscriptionRepository.listControlPlanRequests()).items).toContain(first);
    await expect(subscriptionRepository.requestControlPlan({ ...input, instanceIds: ['INS-JN-0001-B'] }, 'CTRL-PLAN-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestControlPlan({ ...input, action: 'RESUME', reasonCode: 'OEM_REQUEST' }, 'CTRL-PLAN-STATE-001')).rejects.toThrow('CONTROL_PLAN_STATE_INVALID');
    await expect(subscriptionRepository.requestControlPlan({ ...input, justification: '太短' }, 'CTRL-PLAN-INPUT-001')).rejects.toThrow('CONTROL_PLAN_INPUT_INVALID');
  });
  it('keeps evidence grades independent across the delivery chain', async () => {
    const rows = await subscriptionRepository.listEvidence();

    expect(rows.items).toHaveLength(3);
    expect(rows.items.find((item) => item.evidenceId === 'EVD-JN-0001-A')?.receiveGrade).toBe('F1');
    expect(rows.items.find((item) => item.evidenceId === 'EVD-JN-0001-A')?.displayGrade).toBe('UNKNOWN');
  });
  it('keeps evidence events independent across delivery stages', async () => {
    const partial = await subscriptionRepository.getEvidence('EVD-JN-0001-A');
    const broken = await subscriptionRepository.getEvidence('EVD-JN-0001-B');

    expect(partial.chainStatus).toBe('PARTIAL');
    expect(partial.events.find((item) => item.stage === 'RECEIVE')?.status).toBe('CONFIRMED');
    expect(partial.events.find((item) => item.stage === 'DISPLAY')?.status).toBe('UNKNOWN');
    expect(broken.chainStatus).toBe('BROKEN');
  });
  it('keeps incident status and severity explicit', async () => {
    const rows = await subscriptionRepository.listIncidents();
    const releaseIncident = rows.items.find((item) => item.incidentId === 'INC-JN-0004');

    expect(rows.items).toHaveLength(3);
    expect(releaseIncident?.status).toBe('IN_PROGRESS');
    expect(releaseIncident?.severity).toBe('HIGH');
  });
  it('keeps incident timeline and recovery evidence separate from incident status', async () => {
    const active = await subscriptionRepository.getIncident('INC-JN-0004');
    const resolved = await subscriptionRepository.getIncident('INC-JN-0007');

    expect(active.timeline).toHaveLength(2);
    expect(active.nextAction).toContain('核对');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.recoveryEvidence).toContain('恢复');
  });
  it('records incident handling intent idempotently without mutating incident facts', async () => {
    const input = {
      incidentId: 'INC-JN-0004',
      action: 'ACKNOWLEDGE' as const,
      note: '已确认发布节点失败影响范围，安排负责人核对回执关联字段。',
      reasonCode: 'CONFIRM_RECEIPT' as const,
    };
    const first = await subscriptionRepository.recordIncidentAction(input, 'INC-ACTION-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.recordIncidentAction(input, 'INC-ACTION-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('RECORDED');
    expect(first.action).toBe('ACKNOWLEDGE');
    expect((await subscriptionRepository.listIncidentActionReceipts()).items).toContain(first);
    expect((await subscriptionRepository.getIncident('INC-JN-0004')).status).toBe('IN_PROGRESS');
    await expect(subscriptionRepository.recordIncidentAction({ ...input, note: '改写后的处置说明。' }, 'INC-ACTION-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
  });
  it('requires an owner for handoff and recovery evidence for resolution', async () => {
    await expect(subscriptionRepository.recordIncidentAction({ incidentId: 'INC-JN-0004', action: 'ASSIGN', note: '请转派处理。', reasonCode: 'OWNER_HANDOFF' }, 'INC-ACTION-OWNER-001')).rejects.toThrow('INCIDENT_ACTION_OWNER_REQUIRED');
    await expect(subscriptionRepository.recordIncidentAction({ incidentId: 'INC-JN-0004', action: 'RESOLVE', note: '已处理完成。', reasonCode: 'RECOVERY_VERIFIED' }, 'INC-ACTION-RESOLVE-001')).rejects.toThrow('INCIDENT_RESOLVE_EVIDENCE_REQUIRED');
    await expect(subscriptionRepository.recordIncidentAction({ incidentId: 'INC-JN-0004', action: 'ASSIGN', ownerName: '车企云负责人', note: '请核对车端回执关联字段。', reasonCode: 'OWNER_HANDOFF' }, 'INC-ACTION-ASSIGN-001')).resolves.toMatchObject({ action: 'ASSIGN', ownerName: '车企云负责人' });
    await expect(subscriptionRepository.recordIncidentAction({ incidentId: 'INC-JN-0004', action: 'ACKNOWLEDGE', note: '错误原因。', reasonCode: 'OWNER_HANDOFF' }, 'INC-ACTION-REASON-001')).rejects.toThrow('INCIDENT_ACTION_INPUT_INVALID');
  });
  it('keeps system integration state separate from business success', async () => {
    const all = await subscriptionRepository.listIntegrations();
    const searched = await subscriptionRepository.listIntegrations('车端展示与交互回传');

    expect(all.items).toHaveLength(7);
    expect(all.items.find((item) => item.integrationId === 'INT-JN-0005')?.status).toBe('DEGRADED');
    expect(searched.items).toHaveLength(1);
    expect(searched.items[0]?.status).toBe('PENDING');
  });
  it('separates tenant admission from role authorization and applies tenant/environment scope', async () => {
    setDataScopeContext(mockActor);
    const cityPartners = await subscriptionRepository.listPartners();
    const cityApplications = await subscriptionRepository.listApplicationClients();
    expect(cityPartners.items).toHaveLength(1);
    expect(cityPartners.items[0]?.tenantId).toBe('CITY-JINAN');
    expect(cityApplications.items).toHaveLength(1);
    expect(cityApplications.items[0]?.applicationClientId).toBe('APP-JN-OPERATOR-01');

    const platformAdmin: ActorContext = {
      ...mockActor,
      actorId: 'U-PLATFORM-ADMIN-SCOPE-001',
      roles: ['PLATFORM_ADMIN'],
      permissions: new Set(),
      scopes: ['TENANT:*', 'ENV:*', 'GOVERNANCE:*'],
    };
    setDataScopeContext(platformAdmin);
    expect((await subscriptionRepository.listPartners()).items).toHaveLength(3);

    const oemActor: ActorContext = {
      ...mockActor,
      actorId: 'U-OEM-READ-001',
      tenantId: 'OEM-QILU',
      environment: 'TEST',
      roles: ['OEM_INTEGRATION'],
      permissions: new Set(),
      scopes: ['TENANT:OEM-QILU', 'ENV:SANDBOX', 'ENV:TEST', 'FR6:*'],
    };
    setDataScopeContext(oemActor);
    const oemPartners = await subscriptionRepository.listPartners();
    const oemApplications = await subscriptionRepository.listApplicationClients();
    expect(oemPartners.items).toHaveLength(1);
    expect(oemPartners.items[0]?.partnerId).toBe('PTN-OEM-QILU-0001');
    expect(oemApplications.items).toHaveLength(2);
    await expect(subscriptionRepository.getPartner('PTN-JN-0001')).rejects.toThrow('PARTNER_OUT_OF_SCOPE');
    await expect(subscriptionRepository.getApplicationClient('APP-JN-OPERATOR-01')).rejects.toThrow('APPLICATION_CLIENT_OUT_OF_SCOPE');
  });
  it('keeps partner onboarding pending, idempotent and permission-scoped', async () => {
    const oemActor: ActorContext = {
      ...mockActor,
      actorId: 'U-OEM-REQUEST-001',
      tenantId: 'OEM-QILU',
      environment: 'TEST',
      roles: ['OEM_INTEGRATION'],
      permissions: new Set(),
      scopes: ['TENANT:OEM-QILU', 'ENV:SANDBOX', 'ENV:TEST', 'FR6:*'],
    };
    setDataScopeContext(oemActor);
    const input = {
      partnerType: 'OEM_TSP' as const,
      tenantId: 'OEM-QILU',
      partnerName: '齐鲁智行汽车',
      legalName: '齐鲁智行汽车科技有限公司',
      protocolVersion: 'OEM-UUA-PROFILE-2.4',
      protocolExpiresAt: '2027-12-31',
      applicationClientId: 'APP-QILU-QUEUE-01',
      applicationName: '前方拥堵预警接入',
      purpose: '消费前方拥堵预警和异常停车预警事件，并在车端进行风险提示。',
      environments: ['TEST'] as const,
      scopeSummary: '齐鲁智行租户资源 · 经十路示范走廊',
      networkAllowlist: ['172.18.40.0/24'],
      authMethod: 'mTLS + OAuth2 Client Credentials',
      ownerName: '车企接入负责人',
      contactName: '赵明',
      contactEmail: 'v2x@qilu.example.invalid',
      reasonCode: 'NEW_APPLICATION' as const,
      justification: '新增拥堵和异常停车预警场景接入，先在测试环境完成联合验证后再申请生产准入。',
    };
    const first = await subscriptionRepository.requestPartnerOnboarding(input, 'PARTNER-ONBOARDING-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestPartnerOnboarding(input, 'PARTNER-ONBOARDING-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('PENDING_REVIEW');
    expect((await subscriptionRepository.listPartnerOnboardingRequests()).items).toContain(first);
    await expect(subscriptionRepository.requestPartnerOnboarding({ ...input, purpose: '改写用途' }, 'PARTNER-ONBOARDING-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestPartnerOnboarding({ ...input, applicationClientId: 'APP-QILU-QUEUE-02', environments: ['PRODUCTION'] as const }, 'PARTNER-ONBOARDING-SCOPE-001')).rejects.toThrow('PARTNER_ONBOARDING_SCOPE_INVALID');

    const auditor: ActorContext = { ...oemActor, actorId: 'U-AUDITOR-PARTNER-001', roles: ['AUDITOR'], permissions: new Set(), scopes: ['CITY:*', 'ENV:*'] };
    setDataScopeContext(auditor);
    await expect(subscriptionRepository.requestPartnerOnboarding({ ...input, applicationClientId: 'APP-QILU-QUEUE-03' }, 'PARTNER-ONBOARDING-PERMISSION-001')).rejects.toThrow('PERMISSION_DENIED');
  });
  it('keeps tenant lifecycle and endpoint credential actions as auditable intents', async () => {
    const platformAdmin: ActorContext = {
      ...mockActor,
      actorId: 'U-PLATFORM-ADMIN-ACTION-001',
      environment: 'TEST',
      roles: ['PLATFORM_ADMIN'],
      permissions: new Set(),
      scopes: ['TENANT:*', 'ENV:*', 'GOVERNANCE:*'],
    };
    setDataScopeContext(platformAdmin);
    const freeze = await subscriptionRepository.requestPartnerLifecycleChange({ partnerId: 'PTN-OEM-QILU-0001', action: 'FREEZE', reasonCode: 'COMPLIANCE_RISK', justification: '协议或安全资料存在待核验项，先冻结新增权益和生产通道。' }, 'PARTNER-LIFECYCLE-FREEZE-001');
    expect(freeze.status).toBe('PENDING_REVIEW');
    await expect(subscriptionRepository.requestPartnerLifecycleChange({ partnerId: 'PTN-OEM-QILU-0001', action: 'FREEZE', reasonCode: 'COMPLIANCE_RISK', justification: '不同说明。' }, 'PARTNER-LIFECYCLE-FREEZE-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    const connect = await subscriptionRepository.requestApplicationAccessAction({ applicationClientId: 'APP-QILU-TRAFFIC-01', action: 'CONNECT_TEST', reasonCode: 'CONNECTIVITY_VALIDATION', justification: '验证测试环境端点、TLS、应用身份、Scope 和协议握手结果。' }, 'APPLICATION-ACTION-CONNECT-001');
    expect(connect.status).toBe('PENDING_EXECUTION');
    const endpointConnect = await subscriptionRepository.requestApplicationAccessAction({ applicationClientId: 'APP-QILU-VRU-01', endpointId: 'EP-QILU-VRU-TST', environment: 'TEST', action: 'CONNECT_TEST', reasonCode: 'CONNECTIVITY_VALIDATION', justification: '仅对指定测试端点执行 DNS、TLS、应用身份和协议握手验证。' }, 'APPLICATION-ACTION-ENDPOINT-001');
    expect(endpointConnect).toMatchObject({ endpointId: 'EP-QILU-VRU-TST', environment: 'TEST' });
    await expect(subscriptionRepository.requestApplicationAccessAction({ applicationClientId: 'APP-QILU-VRU-01', endpointId: 'EP-QILU-UUA-TST', environment: 'TEST', action: 'CONNECT_TEST', reasonCode: 'CONNECTIVITY_VALIDATION', justification: '端点与应用不匹配时不得创建操作意图。' }, 'APPLICATION-ACTION-ENDPOINT-MISMATCH-001')).rejects.toThrow('APPLICATION_ACCESS_ACTION_INVALID');
    const rotate = await subscriptionRepository.requestApplicationAccessAction({ applicationClientId: 'APP-QILU-VRU-01', action: 'ROTATE_CREDENTIAL', reasonCode: 'CREDENTIAL_EXPIRING', justification: '凭证临期，申请通过证书中心完成新旧引用切换和回滚保护。' }, 'APPLICATION-ACTION-ROTATE-001');
    expect(rotate.status).toBe('PENDING_REVIEW');

    setDataScopeContext({ ...platformAdmin, environment: 'SANDBOX' });
    const sandboxReceipt = await subscriptionRepository.requestApplicationAccessAction({ applicationClientId: 'APP-QILU-TRAFFIC-01', endpointId: 'EP-QILU-UUA-SBX', environment: 'SANDBOX', action: 'CONNECT_TEST', reasonCode: 'CONNECTIVITY_VALIDATION', justification: '验证沙盒端点操作回执只在沙盒工作环境展示。' }, 'APPLICATION-ACTION-SANDBOX-HISTORY-001');
    setDataScopeContext({ ...platformAdmin, environment: 'TEST' });
    expect((await subscriptionRepository.listApplicationAccessActionRequests()).items).not.toContain(sandboxReceipt);

    setDataScopeContext(mockActor);
    await expect(subscriptionRepository.requestPartnerLifecycleChange({ partnerId: 'PTN-JN-0001', action: 'FREEZE', reasonCode: 'COMPLIANCE_RISK', justification: '无管理权限的运营账号不应直接冻结合作方。' }, 'PARTNER-LIFECYCLE-DENIED-001')).rejects.toThrow('PERMISSION_DENIED');
  });
  it('isolates endpoint credentials by tenant and active environment', async () => {
    setDataScopeContext(mockActor);
    const cityEndpoints = await subscriptionRepository.listEndpointCredentials();
    expect(cityEndpoints.items).toHaveLength(1);
    expect(cityEndpoints.items[0]?.endpointId).toBe('EP-JN-UUA-SBX');
    expect(cityEndpoints.items[0]?.endpointAddressMasked).not.toContain('token');
    const cityChecks = await subscriptionRepository.listEndpointVerificationChecks('EP-JN-UUA-SBX');
    expect(cityChecks.items).toHaveLength(6);
    expect(cityChecks.items.every((item) => item.status === 'PASS' && item.tenantId === 'CITY-JINAN')).toBe(true);

    const oemActor: ActorContext = {
      ...mockActor,
      actorId: 'U-OEM-ENDPOINT-READ-001',
      tenantId: 'OEM-QILU',
      environment: 'TEST',
      roles: ['OEM_INTEGRATION'],
      permissions: new Set(),
      scopes: ['TENANT:OEM-QILU', 'ENV:SANDBOX', 'ENV:TEST', 'FR6:*'],
    };
    setDataScopeContext(oemActor);
    const oemEndpoints = await subscriptionRepository.listEndpointCredentials();
    expect(oemEndpoints.items).toHaveLength(2);
    expect(oemEndpoints.items.every((item) => item.tenantId === 'OEM-QILU' && item.environment === 'TEST')).toBe(true);
    await expect(subscriptionRepository.getEndpointCredential('EP-JN-UUA-SBX')).rejects.toThrow('ENDPOINT_CREDENTIAL_OUT_OF_SCOPE');
    await expect(subscriptionRepository.listEndpointVerificationChecks('EP-JN-UUA-SBX')).rejects.toThrow('ENDPOINT_CREDENTIAL_OUT_OF_SCOPE');
    await expect(subscriptionRepository.getEndpointCredential('EP-QILU-VRU-TST')).resolves.toMatchObject({ trustDecision: 'PARTIAL', credentialStatus: 'EXPIRING' });
  });
  it('keeps role templates separate from subject authorization instances', async () => {
    const all = await subscriptionRepository.listRoleAssignments();
    const serviceAccounts = await subscriptionRepository.listRoleAssignments('服务账号');

    expect(all.items).toHaveLength(5);
    expect(all.items.find((item) => item.subjectId === 'ORG-QILU-AUTO')?.status).toBe('PENDING_APPROVAL');
    expect(serviceAccounts.items).toHaveLength(1);
    expect(serviceAccounts.items[0]?.subjectType).toBe('SERVICE_ACCOUNT');
  });
  it('keeps access review scope, self-review protection and pending decisions explicit', async () => {
    setDataScopeContext(mockActor);
    const cityReviews = await subscriptionRepository.listAccessReviews();
    expect(cityReviews.items).toHaveLength(2);
    expect(cityReviews.items.every((item) => item.tenantId === 'CITY-JINAN' && item.environment === 'SANDBOX')).toBe(true);

    const admin: ActorContext = {
      ...mockActor,
      actorId: 'U-ACCESS-REVIEW-ADMIN-001',
      environment: 'SANDBOX',
      roles: ['PLATFORM_ADMIN'],
      permissions: new Set(),
      scopes: ['TENANT:*', 'ENV:*', 'GOVERNANCE:*'],
    };
    setDataScopeContext(admin);
    const input = { reviewId: 'AR-JN-0002', result: 'RETAIN' as const, reasonCode: 'PERIODIC_REVIEW', comment: '审批职责仍然必要，最近使用记录与当前订阅审批范围一致，继续保留。' };
    const first = await subscriptionRepository.requestAccessReview(input, 'ACCESS-REVIEW-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestAccessReview(input, 'ACCESS-REVIEW-IDEMPOTENCY-001');
    expect(replay).toBe(first);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect((await subscriptionRepository.listAccessReviewRequests()).items).toContain(first);
    await expect(subscriptionRepository.requestAccessReview({ ...input, result: 'NARROW' }, 'ACCESS-REVIEW-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');

    setDataScopeContext({ ...admin, actorId: 'U-APPROVER-001' });
    await expect(subscriptionRepository.requestAccessReview({ reviewId: 'AR-JN-0002', result: 'REVOKE', reasonCode: 'SECURITY_RISK', comment: '不应由被复核主体本人提交复核结论。' }, 'ACCESS-REVIEW-SELF-001')).rejects.toThrow('ACCESS_REVIEW_SELF_ACTION');

    setDataScopeContext({ ...admin, actorId: 'U-AUDITOR-ACCESS-001', roles: ['AUDITOR'], permissions: new Set() });
    await expect(subscriptionRepository.requestAccessReview({ ...input, reviewId: 'AR-JN-0001' }, 'ACCESS-REVIEW-PERMISSION-001')).rejects.toThrow('PERMISSION_DENIED');
  });
  it('keeps role change requests pending and idempotent without changing assignments', async () => {
    const input = {
      changeType: 'GRANT' as const,
      subjectType: 'USER' as const,
      subjectId: 'U-TEST-001',
      subjectName: '测试发布员',
      tenantId: 'CITY-JINAN',
      organizationName: '济南市交通运输局',
      roleCode: 'TEST_OPERATOR' as const,
      scopeSummary: '济南市 · 经十路示范走廊',
      environments: ['SANDBOX'] as const,
      effectiveFrom: '2026-09-20',
      expiresAt: '2026-12-31',
      reasonCode: 'ROLE_ASSIGNMENT_REQUIRED',
      justification: '测试岗位需要在沙盒环境执行联合验证和发布回归。',
    };
    const first = await subscriptionRepository.requestRoleAssignmentChange(input, 'ROLE-REQUEST-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestRoleAssignmentChange(input, 'ROLE-REQUEST-IDEMPOTENCY-001');
    expect(first).toBe(replay);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect(first.scopeSummary).toBe(input.scopeSummary);
    expect(first.environments).toEqual(['SANDBOX']);
    expect((await subscriptionRepository.listRoleAssignmentChangeRequests()).items).toContain(first);
    expect((await subscriptionRepository.listRoleAssignments()).items).toHaveLength(5);
    await expect(subscriptionRepository.requestRoleAssignmentChange({ ...input, scopeSummary: '济南市 · 全市' }, 'ROLE-REQUEST-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestRoleAssignmentChange(input, '   ')).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
    await expect(subscriptionRepository.requestRoleAssignmentChange({ ...input, expiresAt: '2026-09-19' }, 'ROLE-REQUEST-DATE-001')).rejects.toThrow('ROLE_ASSIGNMENT_CHANGE_DATES_INVALID');
    await expect(subscriptionRepository.requestRoleAssignmentChange({ ...input, reasonCode: 'OFFBOARDING' }, 'ROLE-REQUEST-REASON-001')).rejects.toThrow('ROLE_ASSIGNMENT_CHANGE_REASON_INVALID');
    await expect(subscriptionRepository.requestRoleAssignmentChange({ ...input, changeType: 'REVOKE', subjectId: 'U-NOT-ASSIGNED-001', subjectName: '不存在的主体', reasonCode: 'OFFBOARDING' }, 'ROLE-REQUEST-REVOKE-UNKNOWN-001')).rejects.toThrow('ROLE_ASSIGNMENT_NOT_FOUND');
    await expect(subscriptionRepository.requestRoleAssignmentChange({ ...input, subjectId: 'U-PLATFORM-001', subjectName: '平台产品验证员', roleCode: 'SUBSCRIPTION_OPERATOR' }, 'ROLE-REQUEST-DUPLICATE-001')).rejects.toThrow('ROLE_ASSIGNMENT_DUPLICATE');
  });
  it('keeps role permission configuration requests pending and records an explicit diff', async () => {
    const basePermissionCodes = ['FR1.CATALOG.READ', 'FR2.REQUEST.READ', 'FR2.PRECHECK.READ', 'FR5.INCIDENT.READ'] as const;
    const input = {
      roleCode: 'SUBSCRIPTION_OPERATOR' as const,
      basePermissionCodes,
      permissionCodes: ['FR1.CATALOG.READ', 'FR2.REQUEST.READ', 'FR2.PRECHECK.READ', 'FR2.PRECHECK.EXECUTE'] as const,
      reasonCode: 'LEAST_PRIVILEGE' as const,
      justification: '按最小权限原则收敛事件查看范围，并临时补充准入检查执行权限。',
    };
    const first = await subscriptionRepository.requestRolePermissionConfigChange(input, 'ROLE-CONFIG-IDEMPOTENCY-001');
    const replay = await subscriptionRepository.requestRolePermissionConfigChange(input, 'ROLE-CONFIG-IDEMPOTENCY-001');
    expect(first).toBe(replay);
    expect(first.status).toBe('PENDING_APPROVAL');
    expect(first.addedPermissionCodes).toEqual(['FR2.PRECHECK.EXECUTE']);
    expect(first.removedPermissionCodes).toEqual(['FR5.INCIDENT.READ']);
    expect((await subscriptionRepository.listRolePermissionConfigChangeRequests()).items).toContain(first);
    await expect(subscriptionRepository.requestRolePermissionConfigChange({ ...input, justification: '不同的配置说明。' }, 'ROLE-CONFIG-IDEMPOTENCY-001')).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
    await expect(subscriptionRepository.requestRolePermissionConfigChange({ ...input, permissionCodes: basePermissionCodes }, 'ROLE-CONFIG-NO-DIFF-001')).rejects.toThrow('ROLE_PERMISSION_CONFIG_CHANGE_INPUT_INVALID');
    await expect(subscriptionRepository.requestRolePermissionConfigChange({ ...input, reasonCode: 'FUNCTION_CHANGE' }, 'ROLE-CONFIG-REASON-001')).resolves.toBeDefined();
  });
  it('keeps approval queue visibility separate from approval decisions', async () => {
    const queue = await subscriptionRepository.listApprovalCases();
    const searched = await subscriptionRepository.listApprovalCases('REQ-240916-001');

    expect(queue.items.some((item) => item.approvalCaseId === 'APR-240916-001' && item.status === 'IN_REVIEW')).toBe(true);
    expect(queue.items.find((item) => item.approvalCaseId === 'APR-240916-001')?.currentAssigneeId).toBe('U-APPROVER-001');
    expect(searched.items[0]?.approvalCaseId).toBe('APR-240916-001');
  });

  it('enforces the active environment on detail reads and write intents', async () => {
    const testOnly: ActorContext = {
      ...mockActor,
      actorId: 'U-TEST-BOUNDARY-001',
      environment: 'TEST',
      scopes: ['CITY:JINAN', 'ENV:TEST', 'FR1:*', 'FR2:*', 'FR3:*', 'FR4:*', 'FR5:*'],
    };
    setDataScopeContext(testOnly);

    await expect(subscriptionRepository.getPrecheckRun('PCR-240916-001')).rejects.toThrow('PRECHECK_RUN_OUT_OF_SCOPE');
    await expect(subscriptionRepository.getQualification('QAL-JN-0004-A')).resolves.toMatchObject({ environment: 'TEST' });
    await expect(subscriptionRepository.requestControlPlan({
      subscriptionId: 'SUB-JN-0001',
      baseRevision: 3,
      action: 'PAUSE',
      instanceIds: ['INS-JN-0001-A'],
      reasonCode: 'RUNTIME_RISK',
      justification: '测试环境账号不得对沙盒订阅创建控制计划。',
    }, 'SCOPE-CONTROL-001')).rejects.toThrow('SUBSCRIPTION_OUT_OF_SCOPE');
  });
  it('enforces command permissions and authorization-request scope at the service boundary', async () => {
    const readonlyAuditor: ActorContext = {
      ...mockActor,
      actorId: 'U-AUDITOR-BOUNDARY-001',
      roles: ['AUDITOR'],
      permissions: new Set(),
      scopes: ['CITY:*', 'ENV:*'],
    };
    setDataScopeContext(readonlyAuditor);
    await expect(subscriptionRepository.requestControlPlan({
      subscriptionId: 'SUB-JN-0001',
      baseRevision: 3,
      action: 'PAUSE',
      instanceIds: ['INS-JN-0001-A'],
      reasonCode: 'RUNTIME_RISK',
      justification: '审计账号不应直接创建订阅控制计划。',
    }, 'PERMISSION-CONTROL-001')).rejects.toThrow('PERMISSION_DENIED');

    setDataScopeContext(mockActor);
    await expect(subscriptionRepository.requestRoleAssignmentChange({
      changeType: 'GRANT',
      subjectType: 'USER',
      subjectId: 'U-TEST-BOUNDARY-002',
      subjectName: '测试发布员',
      tenantId: 'CITY-JINAN',
      organizationName: '济南市交通运输局',
      roleCode: 'TEST_OPERATOR',
      scopeSummary: '济南市 · 经十路示范走廊',
      environments: ['TEST'],
      effectiveFrom: '2026-09-20',
      expiresAt: '2026-12-31',
      reasonCode: 'ROLE_ASSIGNMENT_REQUIRED',
      justification: '验证申请不能越过当前身份的环境授权范围。',
    }, 'SCOPE-ROLE-001')).rejects.toThrow('ROLE_ASSIGNMENT_CHANGE_SCOPE_INVALID');
  });
  it('scopes role assignment request history by target tenant and active environment', async () => {
    const cityOperator: ActorContext = {
      ...mockActor,
      actorId: 'U-ROLE-HISTORY-CITY-001',
      environment: 'SANDBOX',
      scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'FR2:*', 'GOVERNANCE:*'],
    };
    setDataScopeContext(cityOperator);
    const cityRequest = {
      changeType: 'GRANT' as const,
      subjectType: 'USER' as const,
      subjectId: 'U-HISTORY-CITY-001',
      subjectName: '沙盒运营员',
      tenantId: 'CITY-JINAN',
      organizationName: '济南市交通运输局',
      roleCode: 'SUBSCRIPTION_OPERATOR' as const,
      scopeSummary: '济南市 · 经十路示范走廊',
      environments: ['SANDBOX'] as const,
      effectiveFrom: '2026-09-20',
      expiresAt: '2026-12-31',
      reasonCode: 'ROLE_ASSIGNMENT_REQUIRED',
      justification: '验证授权历史只返回当前租户和当前环境范围内的申请记录。',
    };
    const cityReceipt = await subscriptionRepository.requestRoleAssignmentChange(cityRequest, 'ROLE-HISTORY-CITY-001');
    expect((await subscriptionRepository.listRoleAssignmentChangeRequests()).items).toContain(cityReceipt);

    const oemOperator: ActorContext = {
      ...mockActor,
      actorId: 'U-ROLE-HISTORY-OEM-001',
      tenantId: 'OEM-QILU',
      environment: 'TEST',
      roles: ['OEM_INTEGRATION'],
      permissions: new Set(),
      scopes: ['TENANT:OEM-QILU', 'ENV:TEST', 'GOVERNANCE:*'],
    };
    setDataScopeContext(oemOperator);
    expect((await subscriptionRepository.listRoleAssignmentChangeRequests()).items).not.toContain(cityReceipt);
  });
  it('hides dynamic subscription drafts after switching to another tenant', async () => {
    setDataScopeContext(mockActor);
    const draft = await subscriptionRepository.createSubscriptionDraft({
      serviceId: 'SVC-SPAT-2.3',
      entitlementId: 'ENT-JN-SANDBOX-001',
      applicationClientId: 'APP-QILU-SCOPE-01',
      capabilityGroupId: 'CAP-OEM-CONFIRMED-01',
      coverageId: 'COV-JINGSHI-038',
      channelType: 'UU_A',
      validTo: '2026-11-30',
    }, 'DRAFT-SCOPE-ISOLATION-001');
    setDataScopeContext({
      ...mockActor,
      actorId: 'U-OEM-SCOPE-001',
      tenantId: 'OEM-QILU',
      environment: 'TEST',
      roles: ['OEM_INTEGRATION'],
      permissions: new Set(),
      scopes: ['TENANT:OEM-QILU', 'ENV:TEST', 'GOVERNANCE:*'],
    });
    await expect(subscriptionRepository.getSubscriptionDraft(draft.requestId)).resolves.toBeNull();
  });
  it('keeps a submission idempotent for the same key', async () => {
    const key = 'TEST-SUBMIT-IDEMPOTENCY-001';
    const first = await subscriptionRepository.submitRequest('REQ-240916-003', key);
    const replay = await subscriptionRepository.submitRequest('REQ-240916-003', key);

    expect(replay).toBe(first);
    expect(replay.requestRevision).toBe(1);
    expect(replay.requestStatus).toBe('SUBMITTED');
  });

  it('requires the assigned approver and rejects self-approval at the service boundary', async () => {
    setDataScopeContext({
      ...mockActor,
      actorId: 'U-APPROVER-OTHER-001',
      roles: ['APPROVER'],
      permissions: new Set(),
      scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'FR2:APPROVAL'],
    });
    await expect(subscriptionRepository.decideApproval('APR-240916-001', 'APPROVAL-ASSIGNEE-001', {
      decision: 'APPROVED',
      reasonCode: 'ALL_REQUIREMENTS_MET',
      comment: '不应由非当前处理人提交。',
    })).rejects.toThrow('APPROVAL_ASSIGNEE_MISMATCH');

    setDataScopeContext({
      ...mockActor,
      actorId: 'OEM-QILU-APPLICANT-01',
      roles: ['APPROVER'],
      permissions: new Set(),
      scopes: ['CITY:JINAN', 'ENV:SANDBOX', 'FR2:APPROVAL'],
    });
    await expect(subscriptionRepository.decideApproval('APR-240916-001', 'APPROVAL-SELF-001', {
      decision: 'APPROVED',
      reasonCode: 'ALL_REQUIREMENTS_MET',
      comment: '申请人不应自审。',
    })).rejects.toThrow('APPROVAL_SELF_ACTION');
    setDataScopeContext(null);
  });

  it('keeps an approval decision idempotent for the same key', async () => {
    const key = 'TEST-DECISION-IDEMPOTENCY-001';
    const input = {
      decision: 'CONDITIONALLY_APPROVED' as const,
      reasonCode: 'APPROVED_WITH_SCOPE_RESTRICTION',
      comment: '申请期限收窄后，可以在沙盒环境范围内开展后续验证。',
      condition: {
        sourceFindingId: 'FND-240916-002',
        sourceCandidateId: 'PCC-240916-001',
        candidateDisposition: 'ACCEPTED' as const,
        conditionType: 'SCOPE_RESTRICTION' as const,
        scope: 'SANDBOX / 经十路示范走廊 / 38路口',
        description: '有效期不得晚于2026-11-30',
        ownerName: '赵明',
        dueAt: '2026-09-20',
        evidenceRule: '核验订阅有效期',
        breachAction: '未满足时禁止开通',
        blocksActivation: true,
      },
    };
    const first = await subscriptionRepository.decideApproval(
      'APR-240916-001',
      key,
      input,
    );
    const replay = await subscriptionRepository.decideApproval(
      'APR-240916-001',
      key,
      input,
    );

    expect(replay).toBe(first);
    expect(replay.decision).toBe('CONDITIONALLY_APPROVED');
    expect(replay.subscriptionRevisionId).toBeDefined();
    await expect(subscriptionRepository.decideApproval('APR-240916-001', key, { ...input, comment: '不同的审批意见' })).rejects.toThrow('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('rejects unconditional approval when a mandatory condition is unresolved', async () => {
    await expect(subscriptionRepository.decideApproval('APR-240916-003', 'TEST-UNCONDITIONAL-003', {
      decision: 'APPROVED', reasonCode: 'ALL_REQUIREMENTS_MET', comment: '检查已完成',
    })).rejects.toThrow('HARD_CONDITION_REQUIRES_DISPOSITION');
  });

  it('requires concrete return instructions instead of a generic comment', async () => {
    await expect(subscriptionRepository.decideApproval('APR-240916-003', 'TEST-RETURN-INCOMPLETE-003', {
      decision: 'RETURNED', reasonCode: 'MATERIALS_INCOMPLETE', comment: '请补充材料',
    })).rejects.toThrow('RETURN_REQUIREMENTS_INCOMPLETE');
  });

  it('returns one independent summary for every precheck layer', async () => {
    const run = await subscriptionRepository.getPrecheckRun('PCR-240916-001');

    expect(run.layers.map((item) => item.layer)).toEqual([
      'AUTHORIZATION',
      'CONTRACT',
      'QUALIFICATION',
      'ACCESS',
      'CONNECTIVITY',
    ]);
    expect(run.runStatus).toBe('COMPLETED');
    expect(run.outcome).toBe('PASS_WITH_CONDITIONS');
    expect(run.validity).toBe('CURRENT');
  });
});
