import { useQuery } from '@tanstack/react-query';
import { App, Alert, Button, Card, Col, Descriptions, Row, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { EvidenceSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const layerLabels: Readonly<Record<string, string>> = {
  AUTHORIZATION: '授权范围', CONTRACT: '订阅内容', QUALIFICATION: '服务质量', ACCESS: '接入安全', CONNECTIVITY: '通道能力',
};

export function FindingDetailPage() {
  const { findingId = 'FND-240916-001' } = useParams();
  const [searchParams] = useSearchParams();
  const inferredRunId = findingId.startsWith('REQ-') ? `PCR-${findingId.split('-F')[0]?.replace('REQ-', '')}` : undefined;
  const runId = searchParams.get('runId') ?? inferredRunId ?? 'PCR-240916-001';
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ['precheck-finding', findingId], queryFn: () => subscriptionGateway.getFinding(findingId) });
  const finding = query.data;

  return (
    <>
      <PageHeader
        eyebrow="准入检查"
        title={finding?.ruleName ?? '检查项详情'}
        description="查看本项检查的要求、当前情况、核验依据和处理方式。已完成的检查记录不会被直接修改。"
        badges={finding ? [`检查结果：${finding.outcome === 'PASS' ? '通过' : '需处理'}`, `负责人：${finding.ownerName}`] : []}
        actions={[
          <Link key="back" className="ant-btn ant-btn-default" to={`/fr2/prechecks/${runId}`}><ArrowLeftOutlined /> 返回检查结果</Link>,
          <Button key="copy" icon={<CopyOutlined />} onClick={() => {
            if (!finding) return;
            void navigator.clipboard.writeText(finding.findingId).then(() => message.success('检查项编号已复制')).catch(() => message.error('复制失败，请检查浏览器权限'));
          }}>复制检查项编号</Button>,
        ]}
      />
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : finding ? 'ready' : 'empty'} onRetry={() => void query.refetch()}>
        {finding ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {finding.validity !== 'CURRENT' ? <Alert type="warning" showIcon title="该检查结果已失效" description="申请内容或依据已经变化，请重新运行准入检查后再继续办理。" /> : null}
            <Card title={finding.ruleName} extra={<Space><StatusTag value={finding.outcome} /><StatusTag value={finding.validity} /></Space>}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="检查项编号">{finding.findingId}</Descriptions.Item>
                <Descriptions.Item label="规则编号">{finding.ruleId}</Descriptions.Item>
                <Descriptions.Item label="检查维度">{layerLabels[finding.layer]}</Descriptions.Item>
                <Descriptions.Item label="风险等级"><Tag color={finding.severity === 'CRITICAL' ? 'red' : finding.severity === 'HIGH' ? 'orange' : 'default'}>{finding.severity === 'CRITICAL' ? '严重' : finding.severity === 'HIGH' ? '高' : '一般'}</Tag></Descriptions.Item>
                <Descriptions.Item label="处理原因">{finding.reasonCode === 'VALIDITY_NARROWED' ? '申请期限需要收窄' : finding.outcome === 'PASS' ? '符合检查要求' : '需进一步核验'}</Descriptions.Item>
                <Descriptions.Item label="检查时间">2026-09-16 10:18:31</Descriptions.Item>
                <Descriptions.Item label="检查批次">{runId}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card title="检查要求" className="comparison-card expected-card"><Typography.Paragraph>{finding.expected}</Typography.Paragraph><Typography.Text type="secondary">检查标准由平台统一配置，本页不能修改。</Typography.Text></Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card title="当前情况" className="comparison-card actual-card"><Typography.Paragraph>{finding.actual}</Typography.Paragraph><Typography.Text type="secondary">内容来自本次申请及其关联资料。</Typography.Text></Card>
              </Col>
            </Row>

            <Card title="核验依据" extra={<Typography.Text type="secondary">部分资料仅限有权限人员查看</Typography.Text>}>
              {finding.evidence.length === 0 ? <Alert type="warning" showIcon title="暂无可核验的依据" /> : (
                <Table<EvidenceSummary> pagination={false} rowKey="evidenceRef" dataSource={finding.evidence} columns={[
                  { title: '依据编号', dataIndex: 'evidenceRef' },
                  { title: '来源对象 / 版本', render: (_, record) => <Space orientation="vertical" size={0}><span>{record.objectType} · {record.objectId}</span><Typography.Text type="secondary">版本 {record.revision}</Typography.Text></Space> },
                  { title: '来源', dataIndex: 'source' },
                  { title: '核验状态', dataIndex: 'verificationStatus', render: (value) => <StatusTag value={String(value)} /> },
                  { title: '访问范围', dataIndex: 'accessLevel', render: (value) => <StatusTag value={String(value)} /> },
                  { title: '有效至', dataIndex: 'validUntil' },
                ]} />
              )}
            </Card>

            <Card title="处置与复检">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="负责人">{finding.ownerName}</Descriptions.Item>
                <Descriptions.Item label="处理时限">{finding.dueAt}</Descriptions.Item>
                <Descriptions.Item label="处理建议" span={2}>{finding.nextAction}</Descriptions.Item>
                <Descriptions.Item label="补正任务">{finding.remediationCaseId ?? '尚未创建'}</Descriptions.Item>
                <Descriptions.Item label="重新检查条件">补正材料提交并核验后，重新运行准入检查</Descriptions.Item>
              </Descriptions>
              <Space style={{ marginTop: 16 }}>
                {finding.remediationCaseId ? <Link className="ant-btn ant-btn-primary" to={`/fr2/remediations/${finding.remediationCaseId}`}>查看补正任务</Link> : null}
                <Link className="ant-btn ant-btn-default" to={`/fr2/prechecks/${runId}`}>返回检查结果</Link>
              </Space>
            </Card>
          </Space>
        ) : null}
      </StateBoundary>
    </>
  );
}
