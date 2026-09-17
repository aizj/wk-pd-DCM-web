import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Row, Space, Table, Tag, Timeline, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApprovalNode } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { useAuth } from '../../core/auth/AuthProvider';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const riskLabel: Readonly<Record<string, string>> = { LOW: '低', MEDIUM: '中', HIGH: '高' };

export function ApprovalWorkbenchPage() {
  const { caseId = 'APR-240916-001' } = useParams();
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const query = useQuery({ queryKey: ['approval-case', caseId], queryFn: () => subscriptionGateway.getApprovalCase(caseId) });
  const approval = query.data;
  const decisionAllowed = Boolean(approval && authorize({ permission: 'FR2.APPROVAL.DECIDE', objectStateAllowed: approval.status === 'IN_REVIEW', separationOfDutiesPassed: approval.sodPassed, subjectActorId: approval.applicantId, prohibitSelfAction: true }).allowed && approval.currentAssigneeId === actor.actorId && approval.precheckValidity === 'CURRENT' && approval.hardBlockerCount === 0);

  return (
    <>
      <PageHeader
        eyebrow="订阅审批"
        title="审批处理"
        description="请核对申请内容、准入检查和待处理条件，并在当前审批环节填写审批意见。"
        badges={approval ? [`${riskLabel[approval.riskLevel] ?? approval.riskLevel}风险`, `截止：${approval.dueAt}`, approval.sodPassed ? '无职责冲突' : '存在职责冲突'] : []}
        actions={<Link className="ant-btn ant-btn-default" to="/fr2/requests"><ArrowLeftOutlined /> 返回申请管理</Link>}
      />
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : approval ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
        {approval ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {!decisionAllowed && approval.status === 'IN_REVIEW' ? <Alert type="error" showIcon title="当前审批单暂不能处理" description="请核对当前处理人、准入检查有效性和职责冲突；不满足要求时请先处理异常。" /> : null}
            <Card title={`${approval.approvalCaseId} · ${approval.serviceName}`} extra={<Space><StatusTag value={approval.status} /><Tag color="red">{approval.riskLevel === 'HIGH' ? '高风险' : approval.riskLevel === 'MEDIUM' ? '中风险' : '低风险'}</Tag></Space>}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="申请编号 / 版本">{approval.requestId} / V{approval.requestRevision}</Descriptions.Item>
                <Descriptions.Item label="检查批次">{approval.precheckRunId}</Descriptions.Item>
                <Descriptions.Item label="审批规则版本">{approval.approvalMatrixVersion}</Descriptions.Item>
                <Descriptions.Item label="处理时限">{approval.dueAt}</Descriptions.Item>
                <Descriptions.Item label="申请企业 / 应用">{approval.oemName} / {approval.applicationName}</Descriptions.Item>
                <Descriptions.Item label="申请环境">{environmentLabel[approval.environment] ?? approval.environment}环境</Descriptions.Item>
                <Descriptions.Item label="当前处理人">{approval.currentAssigneeName}</Descriptions.Item>
                <Descriptions.Item label="职责冲突检查"><Tag color={approval.sodPassed ? 'green' : 'red'}>{approval.sodPassed ? '通过' : '存在冲突'}</Tag></Descriptions.Item>
              </Descriptions>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={9}>
                <Card title="申请摘要" className="full-height-card">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="申请人">{approval.applicantName} · {approval.applicantId}</Descriptions.Item>
                    <Descriptions.Item label="服务">{approval.serviceName}</Descriptions.Item>
                    <Descriptions.Item label="申请范围">{approval.scopeSummary}</Descriptions.Item>
                    <Descriptions.Item label="权益上限">{approval.entitlementLimit}</Descriptions.Item>
                    <Descriptions.Item label="申请内容校验码">{approval.requestContentHash}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title="准入检查与待处理条件" className="full-height-card">
                  <Space wrap><StatusTag value={approval.precheckOutcome} /><StatusTag value={approval.precheckValidity} /><Tag color={approval.hardBlockerCount > 0 ? 'red' : 'green'}>未通过项 {approval.hardBlockerCount}</Tag></Space>
                  <Typography.Paragraph style={{ marginTop: 16 }}>系统提出 {approval.conditionCandidates.length} 项附加条件建议，审批时需逐项确认是否采纳或调整。</Typography.Paragraph>
                  {approval.conditionCandidates.map((candidate) => (
                    <Alert key={candidate.candidateId} type={candidate.hardGate ? 'warning' : 'info'} showIcon title={candidate.description} description={`建议编号：${candidate.candidateId}；来源检查项：${candidate.sourceFindingId}`} />
                  ))}
                </Card>
              </Col>
              <Col xs={24} xl={7}>
                <Card title="当前审批环节" className="full-height-card">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="当前处理人">{approval.currentAssigneeName}</Descriptions.Item>
                    <Descriptions.Item label="处理时限">{approval.dueAt}</Descriptions.Item>
                    <Descriptions.Item label="下一步">填写审批结论和必要的附加条件</Descriptions.Item>
                  </Descriptions>
                  <Button type="primary" block disabled={!decisionAllowed} onClick={() => navigate(`/fr2/approvals/${approval.approvalCaseId}/decision`)} style={{ marginTop: 16 }}>填写审批意见</Button>
                </Card>
              </Col>
            </Row>

            <Card title="审批链">
              <Table<ApprovalNode> pagination={false} rowKey="nodeId" dataSource={approval.nodes} columns={[
                { title: '节点', render: (_, record) => <Space orientation="vertical" size={0}><Typography.Text strong>{record.nodeName}</Typography.Text><Typography.Text type="secondary">{record.nodeId}</Typography.Text></Space> },
                { title: '处理人', dataIndex: 'assigneeName' },
                { title: '关系', dataIndex: 'parallelGroup', render: (value) => value ? <Tag>并行 {String(value)}</Tag> : <Tag>顺序</Tag> },
                { title: '状态', dataIndex: 'status', render: (value) => <StatusTag value={String(value)} /> },
                { title: '到期', dataIndex: 'dueAt' },
              ]} />
            </Card>

            <Card title="审批说明">
              <Timeline items={[
                { content: '审批过程中不能修改申请内容；如材料不完整，应退回申请人补充。' },
                { content: '附加条件只能收紧使用范围或增加开通要求，不能超过已有授权范围。' },
                { content: '审批通过后，仍需完成配置、测试和发布，服务才可正式开通。' },
              ]} />
            </Card>
          </Space>
        ) : null}
      </StateBoundary>
    </>
  );
}
