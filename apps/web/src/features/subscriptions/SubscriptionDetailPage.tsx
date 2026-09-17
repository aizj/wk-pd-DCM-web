import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Empty, Space, Table, Tabs, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { SubscriptionInstanceSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';
import { PermissionGate } from '../../shared/components/PermissionGate';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };

function UnavailableFact({ title, owner }: { title: string; owner: string }) {
  return <Card size="small" title={title} className="full-height-card">
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未接入权威数据" />
    <Typography.Text type="secondary">待对接：{owner}。接入前不推断该阶段结果。</Typography.Text>
  </Card>;
}

export function SubscriptionDetailPage() {
  const navigate = useNavigate();
  const { subscriptionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const selectedInstanceId = searchParams.get('instanceId');
  const query = useQuery({ queryKey: ['subscription', subscriptionId], queryFn: () => subscriptionGateway.getSubscription(subscriptionId), enabled: Boolean(subscriptionId) });
  const detail = query.data;
  const selectedInstance = detail?.instances.find((item) => item.instanceId === selectedInstanceId);

  return <>
    <PageHeader eyebrow="订阅运营" title="订阅详情" description="查看获批版本、各实例状态和后续交付事实。" badges={['数据状态 · 以服务端为准']} actions={<Space>
      <Button onClick={() => navigate(`/fr2/revisions/compare?subscriptionId=${subscriptionId}`)}>版本比较</Button>
      <PermissionGate permission="FR2.SUBSCRIPTION.CHANGE" fallback={<Button disabled>变更与续期</Button>}><Button onClick={() => navigate(`/fr2/subscriptions/${subscriptionId}/change`)}>变更与续期</Button></PermissionGate>
      <PermissionGate permission="FR2.CONTROL.PLAN" fallback={<Button disabled>控制与退出</Button>}><Button onClick={() => navigate(`/fr2/subscriptions/${subscriptionId}/control`)}>控制与退出</Button></PermissionGate>
      <PermissionGate permission="FR2.DIAGNOSIS.READ" fallback={<Button type="primary" disabled>运行诊断</Button>}><Button type="primary" onClick={() => navigate(`/fr2/subscriptions/${subscriptionId}/diagnosis`)}>运行诊断</Button></PermissionGate>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/fr2/subscriptions')}>返回订阅实例</Button>
    </Space>} />
    <StateBoundary state={query.isPending ? 'loading' : query.isError ? query.error instanceof Error && query.error.message === 'SUBSCRIPTION_NOT_FOUND' ? 'empty' : 'error' : detail ? 'ready' : 'empty'} emptyTitle="未找到该订阅" onRetry={() => void query.refetch()}>
      {detail ? <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="data-notice detail-notice"><InfoCircleOutlined /><span>配置、测试、发布、运行和车端展示尚未接入；未接入结果不按成功展示。</span></div>
        <Card className="subscription-detail-card" title={`${detail.summary.serviceName} · ${detail.summary.serviceVersion}`} extra={<Typography.Text type="secondary">数据时间：{detail.dataTime}</Typography.Text>}>
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
            <Descriptions.Item label="订阅编号">{detail.summary.subscriptionId}</Descriptions.Item>
            <Descriptions.Item label="申请企业">{detail.summary.oemName}</Descriptions.Item>
            <Descriptions.Item label="应用">{detail.summary.applicationName}</Descriptions.Item>
            <Descriptions.Item label="环境">{environmentLabel[detail.summary.environment] ?? detail.summary.environment}</Descriptions.Item>
            <Descriptions.Item label="当前获批版本">{detail.approvedRevisionId}</Descriptions.Item>
            <Descriptions.Item label="目标版本">{detail.targetRevisionId ?? '暂无切换任务'}</Descriptions.Item>
            <Descriptions.Item label="实例数量">{detail.instances.length} 个</Descriptions.Item>
            <Descriptions.Item label="更新时间">{detail.summary.updatedAt}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Tabs items={[
          { key: 'overview', label: '状态概览', children: <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card className="status-overview-card" title="实例状态概览" extra={<Typography.Text type="secondary">各实例独立展示，不合并为订阅总状态</Typography.Text>}>
              <div className="desktop-detail-status"><Table<SubscriptionInstanceSummary> rowKey="instanceId" dataSource={detail.instances} pagination={false} scroll={{ x: 900 }} columns={[
                { title: '实例编号', dataIndex: 'instanceId', width: 155 },
                { title: '生命周期', dataIndex: 'lifecycle', width: 110, render: (value) => <StatusTag value={String(value)} /> },
                { title: '控制', dataIndex: 'controlStatus', width: 100, render: (value) => <StatusTag value={String(value)} /> },
                { title: '开通条件', dataIndex: 'activationReadiness', width: 115, render: (value) => <StatusTag value={String(value)} /> },
                { title: '发布', dataIndex: 'releaseStatus', width: 100, render: (value) => <StatusTag value={String(value)} /> },
                { title: '运行', dataIndex: 'runtimeHealth', width: 100, render: (value) => <StatusTag value={String(value)} /> },
                { title: '证据', dataIndex: 'evidenceGrade', width: 100, render: (value) => <StatusTag value={String(value)} /> },
              ]} /></div>
              <div className="mobile-detail-status">
                {detail.instances.map((instance) => <div className={`mobile-detail-status-row${selectedInstanceId === instance.instanceId ? ' is-selected' : ''}`} key={instance.instanceId}>
                  <div><strong>{instance.instanceId}</strong><small>{instance.coverageSummary}</small></div>
                  <div><span>生命周期</span><StatusTag value={instance.lifecycle} /></div>
                  <div><span>控制</span><StatusTag value={instance.controlStatus} /></div>
                  <div><span>开通条件</span><StatusTag value={instance.activationReadiness} /></div>
                  <div><span>发布 / 运行 / 证据</span><small>未接入</small></div>
                </div>)}
              </div>
            </Card>
            {selectedInstanceId && !selectedInstance ? <Alert type="warning" showIcon title="指定实例不属于当前订阅" description="请从下方实例列表重新选择。" /> : null}
            {selectedInstance ? <Card className="selected-instance-card" title={`所选实例：${selectedInstance.instanceId}`}>
              <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
                <Descriptions.Item label="适用区域">{selectedInstance.coverageSummary}</Descriptions.Item>
                <Descriptions.Item label="实际版本">{selectedInstance.effectiveRevisionId ?? '尚未生效'}</Descriptions.Item>
                <Descriptions.Item label="发布状态"><StatusTag value={selectedInstance.releaseStatus} /></Descriptions.Item>
                <Descriptions.Item label="运行状态"><StatusTag value={selectedInstance.runtimeHealth} /></Descriptions.Item>
              </Descriptions>
            </Card> : null}
          </Space> },
          { key: 'instances', label: `实例（${detail.instances.length}）`, children: <Card title="原子实例">
            <Table<SubscriptionInstanceSummary> rowKey="instanceId" dataSource={detail.instances} pagination={false} scroll={{ x: 1050 }} columns={[
              { title: '实例编号', dataIndex: 'instanceId', width: 160 },
              { title: '适用区域', dataIndex: 'coverageSummary', width: 190 },
              { title: '通道', dataIndex: 'channelType', width: 100, render: (value) => value === 'UU_A' ? '企业云接入' : String(value) },
              { title: '获批版本', dataIndex: 'approvedRevisionId', width: 190 },
              { title: '实际版本', dataIndex: 'effectiveRevisionId', width: 190, render: (value) => value ?? '尚未生效' },
              { title: '生命周期', dataIndex: 'lifecycle', width: 120, render: (value) => <StatusTag value={String(value)} /> },
              { title: '开通条件', dataIndex: 'activationReadiness', width: 120, render: (value) => <StatusTag value={String(value)} /> },
              { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
            ]} />
          </Card> },
          { key: 'external', label: '配置与运行事实', children: <div className="external-facts-grid">
            <UnavailableFact title="有效配置" owner="参数配置模块" />
            <UnavailableFact title="联合测试与发布" owner="测试发布模块" />
            <UnavailableFact title="运行健康与交付证据" owner="运行监控模块" />
          </div> },
        ]} />
      </Space> : null}
    </StateBoundary>
  </>;
}
