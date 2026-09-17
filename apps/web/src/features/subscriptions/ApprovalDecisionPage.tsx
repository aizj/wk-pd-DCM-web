import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { App, Alert, Button, Card, Checkbox, Col, Descriptions, Form, Input, Result, Row, Select, Space, Switch, Typography } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { ApprovalCaseDetail, ApprovalDecisionInput, ApprovalDecisionType, ExecutionConditionDraft } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const riskLabel: Readonly<Record<string, string>> = { LOW: '低', MEDIUM: '中', HIGH: '高' };

const decisionLabels: Record<ApprovalDecisionType, string> = {
  APPROVED: '批准', CONDITIONALLY_APPROVED: '附条件批准', RETURNED: '退回补充', REJECTED: '拒绝',
};
const reasons: Record<ApprovalDecisionType, { value: string; label: string }[]> = {
  APPROVED: [{ value: 'ALL_REQUIREMENTS_MET', label: '全部准入要求已满足' }],
  CONDITIONALLY_APPROVED: [{ value: 'APPROVED_WITH_SCOPE_RESTRICTION', label: '收窄范围或期限后批准' }],
  RETURNED: [{ value: 'MATERIALS_INCOMPLETE', label: '申请材料不完整' }, { value: 'INPUT_RECHECK_REQUIRED', label: '申请内容变化，需重新检查' }],
  REJECTED: [{ value: 'HARD_GATE_REJECTED', label: '不符合准入硬性要求' }, { value: 'OUT_OF_ENTITLEMENT', label: '超出授权范围' }],
};
const initialCondition: ExecutionConditionDraft = {
  sourceFindingId: 'FND-240916-002', sourceCandidateId: 'PCC-240916-001', candidateDisposition: 'ACCEPTED',
  conditionType: 'SCOPE_RESTRICTION', scope: '沙盒环境 / 经十路示范走廊 / 38路口',
  description: '服务有效期不得晚于2026-11-30；生产环境需重新申请并验证。',
  ownerName: '赵明', dueAt: '2026-09-20',
  evidenceRule: '申请有效期不晚于车型能力授权的截止日期，并保留核验记录',
  breachAction: '条件未满足时暂停开通，并生成补正任务', blocksActivation: true,
};

function conditionScope(approval: ApprovalCaseDetail): string {
  const scopeParts = approval.scopeSummary.split(' · ');
  const coverageParts = scopeParts[1]?.startsWith('CAP-') ? scopeParts.slice(0, 1) : scopeParts.slice(0, Math.min(2, scopeParts.length));
  return `${environmentLabel[approval.environment] ?? approval.environment}环境 / ${coverageParts.join(' / ')}`;
}

function decisionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    APPROVAL_ASSIGNEE_MISMATCH: '当前账号不是该审批环节的处理人，不能提交审批意见；如需改派，请联系审批管理员。',
    APPROVAL_SELF_ACTION: '申请人不能处理自己的审批事项，请由独立审批人办理。',
    APPROVAL_ALREADY_DECIDED: '该审批单已有决定，请刷新页面查看最新状态。',
    APPROVAL_OUT_OF_SCOPE: '当前账号无权处理该租户或环境下的审批事项。',
    APPROVAL_GUARD_REJECTED: '审批门禁未满足，请刷新审批单并核对准入结论、有效期和职责分离状态。',
    PERMISSION_DENIED: '当前账号缺少审批决定权限，请切换到具备审批权限的工作身份。',
  } as Record<string, string>)[code] ?? '审批意见提交失败，请刷新审批单后重试。';
}

export function ApprovalDecisionPage() {
  const { caseId = 'APR-240916-001' } = useParams();
  const { modal } = App.useApp();
  const { actor, authorize } = useAuth();
  const [decision, setDecision] = useState<ApprovalDecisionType>('CONDITIONALLY_APPROVED');
  const [reasonCode, setReasonCode] = useState('APPROVED_WITH_SCOPE_RESTRICTION');
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [condition, setCondition] = useState<ExecutionConditionDraft>(() => caseId === 'APR-240916-003'
    ? { ...initialCondition, sourceFindingId: 'FND-240916-102', sourceCandidateId: 'PCC-240916-003' }
    : initialCondition);
  const [returnRequirements, setReturnRequirements] = useState('');
  const [returnOwnerName, setReturnOwnerName] = useState('赵明');
  const [returnDueAt, setReturnDueAt] = useState('');
  const [resubmitScope, setResubmitScope] = useState('');
  const [rejectionBasis, setRejectionBasis] = useState('');
  const [allowReapply, setAllowReapply] = useState(false);
  const [reapplyGuidance, setReapplyGuidance] = useState('');
  const idempotencyKey = useRef(`DECIDE-${caseId}-${actor.actorId}-${actor.environment}-01`);
  useEffect(() => {
    // 环境或工作身份切换后不能复用上一上下文的高风险请求流水号。
    idempotencyKey.current = `DECIDE-${caseId}-${actor.actorId}-${actor.environment}-01`;
  }, [actor.actorId, actor.environment, caseId]);
  const query = useQuery({ queryKey: ['approval-case', caseId], queryFn: () => subscriptionGateway.getApprovalCase(caseId) });
  const approval = query.data;
  useEffect(() => {
    const candidate = approval?.conditionCandidates[0];
    if (!approval || !candidate) return;
    setCondition((current) => ({
      ...current,
      sourceFindingId: candidate.sourceFindingId,
      sourceCandidateId: candidate.candidateId,
      scope: conditionScope(approval),
      description: candidate.description,
    }));
  }, [approval]);
  const authorization = authorize({
    permission: 'FR2.APPROVAL.DECIDE', objectStateAllowed: approval?.status === 'IN_REVIEW',
    separationOfDutiesPassed: approval ? approval.sodPassed : false,
    ...(approval?.applicantId ? { subjectActorId: approval.applicantId, prohibitSelfAction: true } : {}),
  });
  const hasMandatoryCondition = Boolean(approval?.conditionCandidates.some((item) => item.hardGate));
  const conditionComplete = Object.entries(condition).every(([, value]) => typeof value === 'boolean' || String(value).trim().length > 0);
  const branchComplete = decision === 'CONDITIONALLY_APPROVED'
    ? conditionComplete && condition.candidateDisposition !== 'REJECTED'
    : decision === 'RETURNED'
      ? Boolean(returnRequirements.trim() && returnOwnerName.trim() && returnDueAt && resubmitScope.trim())
      : decision === 'REJECTED'
        ? Boolean(rejectionBasis.trim() && reapplyGuidance.trim())
        : !hasMandatoryCondition;
  const canConfirm = Boolean(approval && authorization.allowed && approval.currentAssigneeId === actor.actorId
    && approval.precheckValidity === 'CURRENT' && approval.hardBlockerCount === 0
    && ['PASS', 'PASS_WITH_CONDITIONS'].includes(approval.precheckOutcome)
    && reasons[decision].some((item) => item.value === reasonCode)
    && comment.trim() && branchComplete && confirmed);
  const mutation = useMutation({ mutationFn: () => {
    const input: ApprovalDecisionInput = {
      decision, reasonCode, comment: comment.trim(),
      ...(decision === 'CONDITIONALLY_APPROVED' ? { condition } : {}),
      ...(decision === 'RETURNED' ? { returnRequirements: returnRequirements.trim(), returnOwnerName: returnOwnerName.trim(), returnDueAt, resubmitScope: resubmitScope.trim() } : {}),
      ...(decision === 'REJECTED' ? { rejectionBasis: rejectionBasis.trim(), allowReapply, reapplyGuidance: reapplyGuidance.trim() } : {}),
    };
    return subscriptionGateway.decideApproval(caseId, idempotencyKey.current, input);
  } });

  function changeDecision(next: ApprovalDecisionType) {
    setDecision(next);
    setReasonCode(reasons[next][0]?.value ?? '');
    setComment('');
    setConfirmed(false);
  }
  function confirmDecision() {
    if (!approval || !canConfirm) return;
    modal.confirm({
      title: `确认${decisionLabels[decision]}这份申请？`,
      content: `审批单 ${approval.approvalCaseId}，申请 ${approval.requestId} / V${approval.requestRevision}。${decision === 'RETURNED' ? '退回后申请人需补充材料并重新提交。' : decision === 'REJECTED' ? '拒绝后不会创建订阅。' : '审批通过后仍需完成配置、测试和发布。'}`,
      okText: '确认提交审批意见', cancelText: '返回检查', onOk: async () => { await mutation.mutateAsync(); },
    });
  }

  if (mutation.data) {
    const receipt = mutation.data;
    return <Card><Result status="success" title="审批意见已提交"
      subTitle={receipt.subscriptionRevisionId ? '已生成待开通订阅版本，仍需完成配置、测试和发布。' : receipt.successorDraftPath ? '申请已退回。原申请保持只读，可依据退回要求创建新的申请草稿。' : '申请已拒绝，未创建订阅。'}
      extra={[<Link key="case" className="ant-btn ant-btn-primary" to={`/fr2/approvals/${caseId}`}>返回审批单</Link>, receipt.successorDraftPath ? <Link key="draft" className="ant-btn ant-btn-default" to={receipt.successorDraftPath}>查看退回说明</Link> : null]}>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="审批记录编号">{receipt.decisionId}</Descriptions.Item>
        <Descriptions.Item label="审批结论"><StatusTag value={receipt.decision} /></Descriptions.Item>
        <Descriptions.Item label="审批原因">{reasons[receipt.decision].find((item) => item.value === receipt.reasonCode)?.label ?? receipt.reasonCode}</Descriptions.Item>
        <Descriptions.Item label="订阅版本">{receipt.subscriptionRevisionId ?? '未创建'}</Descriptions.Item>
        <Descriptions.Item label="审批说明" span={2}>{receipt.comment}</Descriptions.Item>
        <Descriptions.Item label="提交时间">{receipt.decidedAt}</Descriptions.Item>
        <Descriptions.Item label="请求流水号">{receipt.idempotencyKey}</Descriptions.Item>
      </Descriptions>
    </Result></Card>;
  }

  return <>
    <PageHeader eyebrow="订阅审批" title="填写审批意见"
      description="选择审批结论并填写依据。附条件批准、退回和拒绝需补充对应的处理要求。"
      badges={approval ? [`审批单：${approval.approvalCaseId}`, `申请版本：V${approval.requestRevision}`] : []}
      actions={<Link className="ant-btn ant-btn-default" to={`/fr2/approvals/${caseId}`}><ArrowLeftOutlined /> 返回审批单</Link>} />
    <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : approval ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
      {approval ? <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {!authorization.allowed || approval.currentAssigneeId !== actor.actorId ? <Alert type="error" showIcon title="当前账号不能处理该审批单" description="请确认当前审批环节的处理人和权限；如需改派，请联系审批管理员。" /> : null}
        {hasMandatoryCondition ? <Alert type="warning" showIcon title="存在必须处理的附加条件" description="本申请存在范围收窄要求，不能直接无条件批准。可附条件批准、退回补充或拒绝。" /> : null}
        <Card title="申请与检查结果" extra={<Space><StatusTag value={approval.status} /><StatusTag value={approval.precheckValidity} /></Space>}>
          <Descriptions column={4} size="small">
            <Descriptions.Item label="申请编号 / 版本">{approval.requestId} / V{approval.requestRevision}</Descriptions.Item>
            <Descriptions.Item label="检查批次">{approval.precheckRunId}</Descriptions.Item>
            <Descriptions.Item label="风险等级">{riskLabel[approval.riskLevel] ?? approval.riskLevel}</Descriptions.Item>
            <Descriptions.Item label="未通过项">{approval.hardBlockerCount} 项</Descriptions.Item>
            <Descriptions.Item label="申请范围" span={2}>{approval.scopeSummary}</Descriptions.Item>
            <Descriptions.Item label="授权上限" span={2}>{approval.entitlementLimit}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={9}><Card title="审批结论" className="full-height-card"><Form layout="vertical">
            <Form.Item label="处理结果" required><Select value={decision} onChange={changeDecision} options={Object.entries(decisionLabels).map(([value, label]) => ({ value, label, disabled: value === 'APPROVED' && hasMandatoryCondition }))} /></Form.Item>
            <Form.Item label="审批原因" required><Select value={reasonCode} onChange={setReasonCode} options={reasons[decision]} /></Form.Item>
            <Form.Item label="审批说明" required extra="请说明判断依据，不能只填写‘同意’或‘不同意’。"><Input.TextArea rows={6} maxLength={500} showCount value={comment} onChange={(event) => setComment(event.target.value)} placeholder="填写本次审批的具体依据" /></Form.Item>
          </Form></Card></Col>
          <Col xs={24} xl={15}>
            {decision === 'CONDITIONALLY_APPROVED' ? <Card title="附加条件" className="full-height-card">
              <Alert type="info" showIcon title="授权范围不能扩大" description={`当前授权上限：${approval.entitlementLimit}`} className="section-gap-bottom" />
              <Form layout="vertical"><Row gutter={16}>
                <Col span={12}><Form.Item label="来源检查项"><Input value={condition.sourceFindingId} disabled /></Form.Item></Col>
                <Col span={12}><Form.Item label="条件建议编号"><Input value={condition.sourceCandidateId} disabled /></Form.Item></Col>
                <Col span={12}><Form.Item label="处理建议" required><Select value={condition.candidateDisposition} onChange={(value) => setCondition((current) => ({ ...current, candidateDisposition: value }))} options={[{ value: 'ACCEPTED', label: '采纳建议' }, { value: 'TRANSFORMED', label: '调整后采纳' }]} /></Form.Item></Col>
                <Col span={12}><Form.Item label="条件类型" required><Select value={condition.conditionType} onChange={(value) => setCondition((current) => ({ ...current, conditionType: value }))} options={[{ value: 'ACTIVATION_PREREQUISITE', label: '开通前提' }, { value: 'ONGOING_OBLIGATION', label: '持续履行要求' }, { value: 'SCOPE_RESTRICTION', label: '服务范围限制' }]} /></Form.Item></Col>
                <Col span={24}><Form.Item label="适用范围" required><Select value={condition.scope} onChange={(value) => setCondition((current) => ({ ...current, scope: value }))} options={[{ value: condition.scope, label: condition.scope.replaceAll(' / ', ' · ') }]} /></Form.Item></Col>
                <Col span={24}><Form.Item label="具体要求" required><Input.TextArea rows={2} value={condition.description} onChange={(event) => setCondition((current) => ({ ...current, description: event.target.value }))} /></Form.Item></Col>
                <Col span={12}><Form.Item label="落实负责人" required><Input value={condition.ownerName} onChange={(event) => setCondition((current) => ({ ...current, ownerName: event.target.value }))} /></Form.Item></Col>
                <Col span={12}><Form.Item label="完成期限" required><Input type="date" value={condition.dueAt} onChange={(event) => setCondition((current) => ({ ...current, dueAt: event.target.value }))} /></Form.Item></Col>
                <Col span={12}><Form.Item label="核验依据" required><Input.TextArea rows={2} value={condition.evidenceRule} onChange={(event) => setCondition((current) => ({ ...current, evidenceRule: event.target.value }))} /></Form.Item></Col>
                <Col span={12}><Form.Item label="未满足时的处理" required><Input.TextArea rows={2} value={condition.breachAction} onChange={(event) => setCondition((current) => ({ ...current, breachAction: event.target.value }))} /></Form.Item></Col>
                <Col span={24}><Form.Item label="未满足时禁止开通"><Switch checked={condition.blocksActivation} onChange={(value) => setCondition((current) => ({ ...current, blocksActivation: value }))} /></Form.Item></Col>
              </Row></Form>
            </Card> : decision === 'RETURNED' ? <Card title="退回补充要求" className="full-height-card"><Form layout="vertical">
              <Alert type="info" showIcon title="退回后不修改原审批记录" description="申请人需依据补充要求创建新草稿，重新检查并提交。" className="section-gap-bottom" />
              <Form.Item label="需补充内容" required><Input.TextArea rows={3} value={returnRequirements} onChange={(event) => setReturnRequirements(event.target.value)} placeholder="逐项写明需要补充或更正的材料" /></Form.Item>
              <Row gutter={16}><Col span={12}><Form.Item label="补充责任人" required><Input value={returnOwnerName} onChange={(event) => setReturnOwnerName(event.target.value)} /></Form.Item></Col><Col span={12}><Form.Item label="补充期限" required><Input type="date" value={returnDueAt} onChange={(event) => setReturnDueAt(event.target.value)} /></Form.Item></Col></Row>
              <Form.Item label="允许重新提交的范围" required><Input value={resubmitScope} onChange={(event) => setResubmitScope(event.target.value)} placeholder="例如：仅补充当前申请的车型能力证明" /></Form.Item>
            </Form></Card> : decision === 'REJECTED' ? <Card title="拒绝依据与后续建议" className="full-height-card"><Form layout="vertical">
              <Form.Item label="拒绝依据" required><Input.TextArea rows={3} value={rejectionBasis} onChange={(event) => setRejectionBasis(event.target.value)} placeholder="说明不符合的具体要求和依据" /></Form.Item>
              <Form.Item label="允许重新申请"><Switch checked={allowReapply} onChange={setAllowReapply} /></Form.Item>
              <Form.Item label="后续处理建议" required><Input.TextArea rows={3} value={reapplyGuidance} onChange={(event) => setReapplyGuidance(event.target.value)} placeholder={allowReapply ? '说明重新申请前必须满足的条件' : '说明当前不允许重新申请的原因与咨询途径'} /></Form.Item>
            </Form></Card> : <Card title="批准后的处理" className="full-height-card"><Alert type="info" showIcon title="审批通过不等于服务开通" description="系统将生成待开通订阅版本；配置、联合测试和发布完成后，才能判断是否具备开通条件。" /></Card>}
          </Col>
        </Row>
        <Card title="提交前确认">
          <Typography.Paragraph>审批单：{approval.approvalCaseId}；申请版本：V{approval.requestRevision}；本次结论：{decisionLabels[decision]}。</Typography.Paragraph>
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>我已核对申请内容、准入检查、授权上限和本次审批依据。</Checkbox>
          {!branchComplete ? <Alert type="warning" showIcon title="请补全当前审批结论所需的信息" className="section-gap" /> : null}
          {mutation.isError ? <Alert type="error" showIcon title="审批意见提交失败" description={decisionErrorMessage(mutation.error)} className="section-gap" /> : null}
          <PermissionGate permission="FR2.APPROVAL.DECIDE" input={{ objectStateAllowed: approval.status === 'IN_REVIEW', separationOfDutiesPassed: approval.sodPassed, subjectActorId: approval.applicantId, prohibitSelfAction: true }} fallback={<Button type="primary" size="large" icon={<CheckCircleOutlined />} disabled style={{ marginTop: 16 }}>提交审批意见</Button>}>
            <Button type="primary" size="large" icon={<CheckCircleOutlined />} disabled={!canConfirm} loading={mutation.isPending} onClick={confirmDecision} style={{ marginTop: 16 }}>提交审批意见</Button>
          </PermissionGate>
        </Card>
      </Space> : null}
    </StateBoundary>
  </>;
}
