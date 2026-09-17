import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Empty, Space, Table, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type {
  ConfigurationSummary,
  DeliveryEvidenceSummary,
  IncidentSummary,
  QualificationSummary,
  ReleasePlanSummary,
  SubscriptionDetail,
  SubscriptionInstanceSummary,
} from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

interface DiagnosisData {
  detail: SubscriptionDetail;
  configurations: readonly ConfigurationSummary[];
  qualifications: readonly QualificationSummary[];
  releases: readonly ReleasePlanSummary[];
  evidence: readonly DeliveryEvidenceSummary[];
  incidents: readonly IncidentSummary[];
}

interface InstanceDiagnosis {
  instance: SubscriptionInstanceSummary;
  configuration: ConfigurationSummary | undefined;
  qualification: QualificationSummary | undefined;
  release: ReleasePlanSummary | undefined;
  evidence: DeliveryEvidenceSummary | undefined;
  incidents: readonly IncidentSummary[];
}

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };

function findNextAction(row: InstanceDiagnosis): string {
  if (row.configuration?.status === 'BLOCKED' || (row.configuration?.pendingRequiredFields ?? 0) > 0) return '补齐配置参数';
  if (row.qualification?.status === 'BLOCKED' || row.qualification?.status === 'FAILED') return '处理联合测试阻断';
  if (row.release?.status === 'FAILED' || row.release?.status === 'BLOCKED') return '核对发布异常';
  if (row.evidence && row.evidence.interactionGrade === 'UNKNOWN') return '补采车辆交互证据';
  if (row.evidence && row.evidence.displayGrade === 'UNKNOWN') return '补采车辆展示证据';
  return '继续核验';
}

function statusOf(value: string | undefined) {
  return value ?? 'UNKNOWN';
}

export function DiagnosisPage() {
  const { subscriptionId = '' } = useParams();
  const query = useQuery<DiagnosisData>({
    queryKey: ['subscription-diagnosis', subscriptionId],
    enabled: Boolean(subscriptionId),
    queryFn: async () => {
      const [detail, configurations, qualifications, releases, evidence, incidents] = await Promise.all([
        subscriptionGateway.getSubscription(subscriptionId),
        subscriptionGateway.listConfigurations(),
        subscriptionGateway.listQualifications(),
        subscriptionGateway.listReleasePlans(),
        subscriptionGateway.listEvidence(),
        subscriptionGateway.listIncidents(),
      ]);
      return {
        detail,
        configurations: configurations.items.filter((item) => item.subscriptionId === subscriptionId),
        qualifications: qualifications.items.filter((item) => item.subscriptionId === subscriptionId),
        releases: releases.items.filter((item) => item.subscriptionId === subscriptionId),
        evidence: evidence.items.filter((item) => item.subscriptionId === subscriptionId),
        incidents: incidents.items.filter((item) => item.subscriptionId === subscriptionId),
      };
    },
  });
  const data = query.data;
  const rows: readonly InstanceDiagnosis[] = data?.detail.instances.map((instance) => ({
    instance,
    configuration: data.configurations.find((item) => item.instanceId === instance.instanceId),
    qualification: data.qualifications.find((item) => item.instanceId === instance.instanceId),
    release: data.releases.find((item) => item.instanceId === instance.instanceId),
    evidence: data.evidence.find((item) => item.instanceId === instance.instanceId),
    incidents: data.incidents.filter((item) => item.instanceId === instance.instanceId),
  })) ?? [];
  const blockedCount = rows.filter((row) => [row.configuration?.status, row.qualification?.status, row.release?.status].some((value) => value === 'BLOCKED' || value === 'FAILED')).length;
  const openIncidentCount = data?.incidents.filter((item) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(item.status)).length ?? 0;
  const displayEvidenceCount = rows.filter((row) => row.evidence && ['F2', 'F3'].includes(row.evidence.displayGrade)).length;

  return <>
    <PageHeader eyebrow="订阅运营" title="运行诊断" description="沿实例串起配置、联合测试、发布、交付证据和事件，定位车辆服务尚未形成闭环的原因。" badges={['数据状态 · 以服务端为准']} actions={<Link className="ant-btn ant-btn-default" to={`/fr2/subscriptions/${subscriptionId}`}><ArrowLeftOutlined /> 返回订阅详情</Link>} />

    <StateBoundary state={query.isPending ? 'loading' : query.isError ? query.error instanceof Error && query.error.message === 'SUBSCRIPTION_NOT_FOUND' ? 'empty' : 'error' : data ? 'ready' : 'empty'} emptyTitle="未找到该订阅" onRetry={() => void query.refetch()}>
      {data ? <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="data-notice detail-notice"><InfoCircleOutlined /><span>诊断页只汇总各业务系统已经提供的事实，不生成新的运行状态；“未知”表示尚未取得相应证据。</span></div>

        <Card className="subscription-detail-card" title={`${data.detail.summary.serviceName} · ${data.detail.summary.subscriptionId}`} extra={<Typography.Text type="secondary">数据时间：{data.detail.dataTime}</Typography.Text>}>
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
            <Descriptions.Item label="申请企业">{data.detail.summary.oemName}</Descriptions.Item>
            <Descriptions.Item label="应用">{data.detail.summary.applicationName}</Descriptions.Item>
            <Descriptions.Item label="环境">{environmentLabel[data.detail.summary.environment]}环境</Descriptions.Item>
            <Descriptions.Item label="订阅生命周期"><StatusTag value={data.detail.summary.lifecycle} /></Descriptions.Item>
            <Descriptions.Item label="获批版本">{data.detail.approvedRevisionId}</Descriptions.Item>
            <Descriptions.Item label="实例数量">{data.detail.instances.length} 个</Descriptions.Item>
            <Descriptions.Item label="存在阻断">{blockedCount ? `${blockedCount} 个实例` : '未发现直接阻断'}</Descriptions.Item>
            <Descriptions.Item label="待处理事件">{openIncidentCount} 条</Descriptions.Item>
          </Descriptions>
        </Card>

        <div className="configuration-overview" aria-label="运行诊断概览">
          <div><span>原子实例</span><strong>{rows.length}</strong><small>个</small></div>
          <div><span>存在流程阻断</span><strong>{blockedCount}</strong><small>个</small></div>
          <div><span>已确认展示证据</span><strong>{displayEvidenceCount}</strong><small>个</small></div>
          <div><span>待处理事件</span><strong>{openIncidentCount}</strong><small>条</small></div>
        </div>

        {blockedCount || openIncidentCount ? <Alert type="warning" showIcon title="当前订阅尚未形成完整交付闭环" description="请按实例查看阻断、异常和证据缺口；完成某个阶段不等于车辆端已经展示或产生交互。" /> : <Alert type="success" showIcon title="当前未发现直接阻断" description="仍需结合展示和交互证据确认车辆端实际使用结果。" />}

        <Card className="configuration-list-card" title="实例诊断链路" extra={<Typography.Text type="secondary">每个实例独立判断，不合并为订阅总状态</Typography.Text>}>
          <div className="desktop-configuration-table"><Table<InstanceDiagnosis> rowKey={(record) => record.instance.instanceId} dataSource={rows} pagination={false} scroll={{ x: 1240 }} columns={[
            { title: '实例 / 范围', width: 205, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.instance.instanceId}</Typography.Text><span>{record.instance.coverageSummary}</span><small>{record.instance.channelType === 'UU_A' ? '企业云接入' : record.instance.channelType}</small></div> },
            { title: '配置', width: 130, render: (_, record) => <div className="diagnosis-status-cell"><StatusTag value={statusOf(record.configuration?.status)} /><small>{record.configuration?.pendingRequiredFields ? `${record.configuration.pendingRequiredFields} 项待补` : record.configuration?.configurationId ?? '未接入'}</small></div> },
            { title: '联合测试', width: 130, render: (_, record) => <div className="diagnosis-status-cell"><StatusTag value={statusOf(record.qualification?.status)} /><small>{record.qualification?.qualificationId ?? '未接入'}</small></div> },
            { title: '发布', width: 130, render: (_, record) => <div className="diagnosis-status-cell"><StatusTag value={statusOf(record.release?.status)} /><small>{record.release ? `${record.release.completedNodeCount}/${record.release.nodeCount} 节点` : '未接入'}</small></div> },
            { title: '交付证据', width: 150, render: (_, record) => <div className="diagnosis-status-cell"><StatusTag value={statusOf(record.evidence?.displayGrade)} /><small>交互：{record.evidence?.interactionGrade ? statusOf(record.evidence.interactionGrade) : '未接入'}</small></div> },
            { title: '事件', width: 105, render: (_, record) => record.incidents.length ? <Space size={4}><StatusTag value={record.incidents.some((item) => ['HIGH', 'CRITICAL'].includes(item.severity)) ? 'HIGH' : 'OPEN'} /><span>{record.incidents.length} 条</span></Space> : <Typography.Text type="secondary">无事件</Typography.Text> },
            { title: '建议下一步', width: 155, render: (_, record) => <Typography.Text>{findNextAction(record)}</Typography.Text> },
          ]} /></div>
          <div className="mobile-configuration-list">{rows.map((record) => <div className="mobile-configuration-card" key={record.instance.instanceId}>
            <div className="mobile-configuration-head"><div><strong>{record.instance.instanceId}</strong><span>{record.instance.coverageSummary}</span></div><StatusTag value={statusOf(record.evidence?.displayGrade)} /></div>
            <div className="mobile-configuration-meta">配置 <StatusTag value={statusOf(record.configuration?.status)} /> · 测试 <StatusTag value={statusOf(record.qualification?.status)} /></div>
            <div className="mobile-configuration-meta">发布 <StatusTag value={statusOf(record.release?.status)} /> · 事件 {record.incidents.length ? `${record.incidents.length} 条` : '无'}</div>
            <div className="mobile-configuration-status">建议下一步：{findNextAction(record)}</div>
            <div className="mobile-configuration-footer"><span>展示证据 · 交互证据分开核验</span><Link to={`/fr2/subscriptions/${subscriptionId}?instanceId=${record.instance.instanceId}`}>查看实例</Link></div>
          </div>)}</div>
        </Card>

        <Card title="诊断口径" size="small">
          <Descriptions column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="配置事实">来自 FR-3 配置版本，待补参数和阻断状态保持独立。</Descriptions.Item>
            <Descriptions.Item label="测试 / 发布事实">分别来自 FR-4 联合测试和发布计划，不将发布状态当作车辆已生效。</Descriptions.Item>
            <Descriptions.Item label="交付证据">F0 仅代表投递记录；F1/F2/F3 逐级表示接收、展示和交互证据。</Descriptions.Item>
            <Descriptions.Item label="事件事实">事件关闭只代表处置状态变化，仍需回到证据链确认恢复结果。</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space> : <Empty description="暂无诊断数据" />}
    </StateBoundary>
  </>;
}
