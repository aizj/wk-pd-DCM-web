import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Divider, Input, Result, Row, Select, Space, Steps, Table, Tag, Timeline, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { EvidenceSummary, RemediationActionType } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';
import { statusLabel } from '../../core/status/status-registry';

const caseStep = { OPEN: 0, IN_PROGRESS: 1, PENDING_VERIFY: 2, COMPLETED: 3, CANCELLED: 3 } as const;
const actionLabels: Record<RemediationActionType, string> = { SUBMIT_MATERIALS: '提交补正材料', REQUEST_RECHECK: '申请重新检查' };

function actionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号缺少准入补正权限，请联系申请负责人或切换到已授权身份。',
    IDEMPOTENCY_KEY_CONFLICT: '本次请求编号已用于其他补正动作，请刷新页面后重试。',
    REMEDIATION_EVIDENCE_REQUIRED: '至少选择一项可核验材料。',
    REMEDIATION_EVIDENCE_NOT_FOUND: '材料引用不存在，请从当前任务的材料列表中选择。',
    REMEDIATION_STATE_INVALID: '当前补正任务状态不允许提交该动作。',
  } as Record<string, string>)[code] ?? '补正动作提交失败，请刷新任务后重试。';
}

export function RemediationCasePage() {
  const { caseId = 'REM-240916-001' } = useParams();
  const { actor, authorize } = useAuth();
  const canRemediate = authorize({ permission: 'FR2.PRECHECK.REMEDIATE' }).allowed;
  const [action, setAction] = useState<RemediationActionType>('SUBMIT_MATERIALS');
  const [evidenceRefs, setEvidenceRefs] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof subscriptionGateway.recordRemediationAction>> | null>(null);
  const sequence = useRef(1);
  const idempotencyKey = useRef(`REMEDIATION-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`);
  useEffect(() => {
    idempotencyKey.current = `REMEDIATION-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
  }, [actor.actorId, actor.environment]);
  const query = useQuery({ queryKey: ['remediation-case', caseId], queryFn: () => subscriptionGateway.getRemediationCase(caseId) });
  const receiptsQuery = useQuery({ queryKey: ['remediation-action-receipts'], queryFn: () => subscriptionGateway.listRemediationActionReceipts() });
  const remediation = query.data;
  const mutation = useMutation({ mutationFn: () => subscriptionGateway.recordRemediationAction({ caseId, action, evidenceRefs, note, reasonCode: action === 'SUBMIT_MATERIALS' ? 'MATERIALS_SUPPLEMENTED' : 'RECHECK_REQUESTED' }, idempotencyKey.current), onSuccess: (nextReceipt) => { setReceipt(nextReceipt); void receiptsQuery.refetch(); } });

  function resetAction() {
    sequence.current += 1;
    idempotencyKey.current = `REMEDIATION-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
    setReceipt(null);
    mutation.reset();
    setEvidenceRefs(remediation?.evidence[0] ? [remediation.evidence[0].evidenceRef] : []);
    setNote('');
  }

  return (
    <>
      <PageHeader
        eyebrow="准入检查"
        title="补正任务"
        description="跟踪问题处理、材料补充和复核结果。提交材料后须由另一名有权限的人员核验，任务才可完成。"
        badges={remediation ? [`状态：${statusLabel(remediation.status)}`, `负责人：${remediation.ownerName}`, `截止：${remediation.dueAt}`, canRemediate ? '补正权限 · 已授权' : '补正权限 · 只读'] : []}
        actions={<Link className="ant-btn ant-btn-default" to={remediation ? `/fr2/findings/${remediation.sourceId}?runId=${remediation.precheckRunId}` : '/fr2/findings/FND-240916-002'}><ArrowLeftOutlined /> 返回检查项</Link>}
      />
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : remediation ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
        {remediation ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card title={remediation.caseId} extra={<Space><StatusTag value={remediation.status} /><Tag color="orange">{remediation.priority === 'HIGH' ? '高优先级' : remediation.priority === 'CRITICAL' ? '紧急' : '普通优先级'}</Tag></Space>}>
              <Steps current={caseStep[remediation.status]} items={[
                { title: '待处理' },
                { title: '处理中' },
                { title: '待验证' },
                { title: remediation.status === 'CANCELLED' ? '已取消' : '已完成' },
              ]} />
            </Card>

            <Alert type="info" showIcon title="材料已提交，等待复核" description={`${remediation.verifierName}将核对申请版本、补正材料和重新检查条件。为避免职责冲突，处理人不能复核自己的材料。`} />

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={15}>
                <Card title="问题与补正要求" className="full-height-card">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="来源检查项">{remediation.sourceId}</Descriptions.Item>
                    <Descriptions.Item label="规则编号">{remediation.ruleId}</Descriptions.Item>
                    <Descriptions.Item label="申请编号 / 版本">{remediation.requestId} / V{remediation.requestRevision}</Descriptions.Item>
                    <Descriptions.Item label="检查批次">{remediation.precheckRunId}</Descriptions.Item>
                    <Descriptions.Item label="问题摘要" span={2}>{remediation.issueSummary}</Descriptions.Item>
                    <Descriptions.Item label="影响范围" span={2}>{remediation.affectedScope}</Descriptions.Item>
                    <Descriptions.Item label="处理方式">确认收窄申请范围</Descriptions.Item>
                    <Descriptions.Item label="处理时限">{remediation.dueAt}</Descriptions.Item>
                    <Descriptions.Item label="需补充材料" span={2}>{remediation.requiredEvidence}</Descriptions.Item>
                    <Descriptions.Item label="下一步" span={2}>{remediation.nextAction}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} xl={9}>
                <Card title="任务分工" className="full-height-card">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="负责人">{remediation.ownerName}</Descriptions.Item>
                    <Descriptions.Item label="协作人">{remediation.collaborators.join('、')}</Descriptions.Item>
                    <Descriptions.Item label="复核人">{remediation.verifierName}</Descriptions.Item>
                    <Descriptions.Item label="复核要求">复核人不得与处理人为同一人</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            <Card title="已提交材料">
              <Table<EvidenceSummary> pagination={false} rowKey="evidenceRef" dataSource={remediation.evidence} columns={[
                { title: '材料编号', dataIndex: 'evidenceRef' },
                { title: '来源对象', render: (_, record) => `${record.objectType} / ${record.objectId} / 版本${record.revision}` },
                { title: '核验状态', dataIndex: 'verificationStatus', render: (value) => <StatusTag value={String(value)} /> },
                { title: '有效至', dataIndex: 'validUntil' },
              ]} />
            </Card>

            <Card title="补正处理" extra={<Typography.Text type="secondary">动作只生成处理回执，不直接关闭任务或修改检查结果</Typography.Text>}>
              {receipt ? <Result status="info" title={actionLabels[receipt.action]} subTitle="平台已接收补正处理意图，后续状态以独立复核和检查服务回传为准。" extra={<Button onClick={resetAction}>继续提交处理</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="动作编号">{receipt.actionId}</Descriptions.Item><Descriptions.Item label="材料引用">{receipt.evidenceRefs.join('、')}</Descriptions.Item><Descriptions.Item label="处理说明">{receipt.note}</Descriptions.Item><Descriptions.Item label="下一步">{receipt.nextStep}</Descriptions.Item></Descriptions></Result> : <PermissionGate permission="FR2.PRECHECK.REMEDIATE" fallback={<Alert type="warning" showIcon title="当前账号不能提交补正动作" description="请联系申请负责人或具备准入补正权限的账号办理。" />}><Space orientation="vertical" size={12} style={{ width: '100%' }}><Alert type="info" showIcon title="提交后由独立复核人处理" description={`当前复核人：${remediation.verifierName}。处理人不能复核本人提交的材料。`} /><Row gutter={16}><Col xs={24} md={8}><Typography.Text strong>处理动作</Typography.Text><Select style={{ width: '100%', marginTop: 8 }} value={action} onChange={setAction} options={Object.entries(actionLabels).map(([value, label]) => ({ value, label, disabled: value === 'REQUEST_RECHECK' && remediation.status !== 'PENDING_VERIFY' }))} /></Col><Col xs={24} md={16}><Typography.Text strong>引用材料</Typography.Text><Select mode="multiple" style={{ width: '100%', marginTop: 8 }} placeholder="选择当前任务已登记的材料" value={evidenceRefs} onChange={setEvidenceRefs} options={remediation.evidence.map((item) => ({ value: item.evidenceRef, label: `${item.evidenceRef} · ${item.verificationStatus === 'VERIFIED' ? '已核验' : '待核验'}` }))} /></Col></Row><Input.TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} showCount placeholder={action === 'SUBMIT_MATERIALS' ? '说明补充了哪些材料、对应哪项要求（不少于10个字）' : '说明重新检查的触发条件和希望核验的范围（不少于10个字）'} />{mutation.isError ? <Alert type="error" showIcon title="补正动作提交失败" description={actionErrorMessage(mutation.error)} /> : null}<Button type="primary" disabled={!evidenceRefs.length || note.trim().length < 10} loading={mutation.isPending} onClick={() => mutation.mutate()}>{actionLabels[action]}</Button></Space></PermissionGate>}
              <Divider />
              <Typography.Text type="secondary">当前任务的处理回执：{receiptsQuery.data?.items.filter((item) => item.caseId === caseId).length ?? 0} 条</Typography.Text>
              {(receiptsQuery.data?.items ?? []).filter((item) => item.caseId === caseId).map((item) => <Card size="small" key={item.actionId} style={{ marginTop: 8 }}><Space orientation="vertical" size={2}><Typography.Text strong>{item.actionId} · {actionLabels[item.action]}</Typography.Text><Typography.Text type="secondary">{item.evidenceRefs.join('、')} · {item.submittedAt}</Typography.Text></Space></Card>)}
            </Card>

            <Card title="处理历史">
              <Timeline items={remediation.history.map((item) => ({
                content: <Space orientation="vertical" size={0}><Typography.Text strong>{item.action} · {item.actor}</Typography.Text><Typography.Text>{item.detail}</Typography.Text><Typography.Text type="secondary">{item.time}</Typography.Text></Space>,
              }))} />
              <Space>
                <Link className="ant-btn ant-btn-default" to={`/fr2/findings/${remediation.sourceId}?runId=${remediation.precheckRunId}`}>查看来源检查项</Link>
                <Link className="ant-btn ant-btn-primary" to={`/fr2/prechecks/${remediation.precheckRunId}`}>查看准入检查</Link>
              </Space>
            </Card>
          </Space>
        ) : null}
      </StateBoundary>
    </>
  );
}
