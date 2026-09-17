import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { PrecheckFinding } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const severityLabels: Readonly<Record<string, string>> = {
  CRITICAL: '严重',
  HIGH: '高',
  WARNING: '一般',
};

const layerLabels: Readonly<Record<string, string>> = {
  ACCESS: '接入安全',
  AUTHORIZATION: '授权范围',
  CONNECTIVITY: '通道能力',
  CONTRACT: '订阅内容',
  QUALIFICATION: '服务质量',
};

const riskLabels: Readonly<Record<string, string>> = { HIGH: '高风险', MEDIUM: '中风险', LOW: '低风险' };
const remediationActionLabels: Readonly<Record<string, string>> = { SUBMIT_MATERIALS: '提交补正材料', REQUEST_RECHECK: '申请重新检查' };

export function PrecheckWorkbenchPage() {
  const { runId = 'PCR-240916-001' } = useParams();
  const query = useQuery({ queryKey: ['precheck-run', runId], queryFn: () => subscriptionGateway.getPrecheckRun(runId) });
  const remediationReceiptsQuery = useQuery({ queryKey: ['remediation-action-receipts'], queryFn: () => subscriptionGateway.listRemediationActionReceipts() });
  const run = query.data;

  return (
    <>
      <PageHeader
        eyebrow="订阅申请"
        title="准入检查结果"
        description="系统从授权范围、订阅内容、服务质量、接入安全和通道能力五个方面检查申请，并给出待处理事项。"
        badges={run ? [`申请版本 V${run.requestRevision}`, `检查${statusLabel(run.runStatus)}`, `结果${statusLabel(run.validity)}`] : []}
        actions={<Link className="ant-btn ant-btn-default" to="/fr2/requests"><ArrowLeftOutlined /> 返回申请管理</Link>}
      />
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : run ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
        {run ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <Row gutter={[20, 20]} align="middle">
                <Col xs={24} lg={8}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="申请编号 / 版本">{run.requestId} / V{run.requestRevision}</Descriptions.Item>
                    <Descriptions.Item label="检查批次">{run.runId}</Descriptions.Item>
                    <Descriptions.Item label="检查规则版本">{run.ruleSetVersion}</Descriptions.Item>
                    <Descriptions.Item label="开始时间">{run.startedAt}</Descriptions.Item>
                    <Descriptions.Item label="完成时间">{run.completedAt}</Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col xs={24} lg={10}>
                  <Progress percent={run.progress} status={run.runStatus === 'FAILED' ? 'exception' : 'success'} />
                  <Descriptions column={3} size="small" style={{ marginTop: 12 }}>
                    <Descriptions.Item label="任务状态"><StatusTag value={run.runStatus} /></Descriptions.Item>
                    <Descriptions.Item label="检查结论"><StatusTag value={run.outcome} /></Descriptions.Item>
                    <Descriptions.Item label="结果有效性"><StatusTag value={run.validity} /></Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col xs={24} lg={6}>
                  <Statistic title="规则总数" value={run.layers.reduce((sum, layer) => sum + layer.passed + layer.conditions + layer.blocked + layer.unknown + layer.expired, 0)} suffix="项" />
                  <Tag color="red">{riskLabels[run.riskLevel] ?? run.riskLevel}</Tag>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>已关联审批单：{run.referencedByApprovalCaseId ?? '暂无'}</Typography.Paragraph>
                </Col>
              </Row>
            </Card>

            <Row gutter={[12, 12]}>
              {run.layers.map((layer) => (
                <Col xs={24} sm={12} xl={Math.floor(24 / run.layers.length)} key={layer.layer}>
                  <Card size="small" title={layer.label} className="precheck-layer-card">
                    <Space wrap><Tag color="green">通过 {layer.passed}</Tag><Tag color="orange">条件 {layer.conditions}</Tag><Tag color="red">阻断 {layer.blocked}</Tag><Tag>未知 {layer.unknown}</Tag></Space>
                    <Typography.Text type="secondary">完成时间 {layer.evaluatedAt}</Typography.Text>
                  </Card>
                </Col>
              ))}
            </Row>

            <Alert type="info" showIcon title="检查通过后仍需审批" description="本页只说明申请满足当前准入检查要求。审批、配置、联合测试和发布完成后，服务才能正式开通。" />

            <Card title="检查项" extra={<Typography.Text type="secondary">共 {run.findings.length} 项</Typography.Text>}>
              <Table<PrecheckFinding>
                rowKey="findingId"
                pagination={false}
                dataSource={run.findings}
                scroll={{ x: 1100 }}
                columns={[
                  { title: '检查维度', width: 120, dataIndex: 'layer', render: (value) => layerLabels[String(value)] ?? String(value) },
                  { title: '检查项', width: 220, render: (_, record) => <Space orientation="vertical" size={0}><Typography.Text strong>{record.ruleName}</Typography.Text><Typography.Text type="secondary">{record.ruleId}</Typography.Text></Space> },
                  { title: '风险等级', dataIndex: 'severity', width: 100, render: (value) => <Tag color={value === 'CRITICAL' ? 'red' : value === 'HIGH' ? 'orange' : 'default'}>{severityLabels[String(value)] ?? String(value)}</Tag> },
                  { title: '当前情况', dataIndex: 'actual', width: 300 },
                  { title: '检查结果', width: 130, render: (_, record) => <Space orientation="vertical" size={2}><StatusTag value={record.outcome} /><StatusTag value={record.validity} /></Space> },
                  { title: '负责人及下一步', width: 220, render: (_, record) => <Space orientation="vertical" size={0}><span>{record.ownerName}</span><Typography.Text type="secondary">{record.nextAction}</Typography.Text></Space> },
                  { title: '操作', fixed: 'right', width: 90, render: (_, record) => <Link to={`/fr2/findings/${record.findingId}?runId=${run.runId}`}>查看详情</Link> },
                ]}
              />
            </Card>

            <Card title="历史检查记录">
              <Table pagination={false} rowKey="run" dataSource={[
                { run: run.runId, input: run.inputHash, outcome: run.outcome, validity: run.validity, reference: run.referencedByApprovalCaseId ?? '—' },
                { run: 'PCR-240915-014', input: 'sha256:f2a1…901c', outcome: 'INCONCLUSIVE', validity: 'STALE', reference: '—' },
              ]} columns={[
                { title: '检查批次', dataIndex: 'run' },
                { title: '申请数据校验码', dataIndex: 'input' },
                { title: '检查结论', dataIndex: 'outcome', render: (value) => <StatusTag value={String(value)} /> },
                { title: '结果有效性', dataIndex: 'validity', render: (value) => <StatusTag value={String(value)} /> },
                { title: '关联审批单', dataIndex: 'reference' },
              ]} />
            </Card>
            <Card title="补正动作回执" extra={<Typography.Text type="secondary">回执不代表补正已通过</Typography.Text>}>
              {(() => {
                const caseIds = new Set(run.findings.map((finding) => finding.remediationCaseId).filter((value): value is string => Boolean(value)));
                const receipts = (remediationReceiptsQuery.data?.items ?? []).filter((item) => caseIds.has(item.caseId));
                return receipts.length ? <Table pagination={false} rowKey="actionId" dataSource={receipts} columns={[{ title: '动作编号', dataIndex: 'actionId' }, { title: '补正任务', dataIndex: 'caseId' }, { title: '动作', render: (_, item) => remediationActionLabels[item.action] ?? item.action }, { title: '材料引用', render: (_, item) => item.evidenceRefs.join('、') }, { title: '提交时间', dataIndex: 'submittedAt' }, { title: '下一步', dataIndex: 'nextStep' }]} /> : <Alert type="info" showIcon title="当前检查批次暂无补正动作回执" description="如需补充材料或申请重新检查，请从对应检查项进入补正任务办理。" />;
              })()}
            </Card>
          </Space>
        ) : null}
      </StateBoundary>
    </>
  );
}
