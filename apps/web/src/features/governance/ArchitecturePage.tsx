import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { IntegrationStatus, SystemIntegrationSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const statusLabel: Readonly<Record<IntegrationStatus, string>> = {
  CONNECTED: '已接入',
  PARTIAL: '部分接入',
  DEGRADED: '已降级',
  PENDING: '待接入',
  NOT_CONNECTED: '未接入',
};
const statusColor: Readonly<Record<IntegrationStatus, string>> = {
  CONNECTED: 'green',
  PARTIAL: 'gold',
  DEGRADED: 'orange',
  PENDING: 'blue',
  NOT_CONNECTED: 'red',
};

function integrationTag(status: IntegrationStatus) {
  return <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>;
}

export function ArchitecturePage() {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState<IntegrationStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<SystemIntegrationSummary | null>(null);
  const query = useQuery({ queryKey: ['system-integrations', appliedKeyword], queryFn: () => subscriptionGateway.listIntegrations(appliedKeyword) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) =>
    (environment === 'ALL' || item.environments.includes(environment as 'SANDBOX' | 'TEST' | 'PRODUCTION'))
    && (status === 'ALL' || item.status === status),
  );
  const connectedCount = allItems.filter((item) => item.status === 'CONNECTED').length;
  const attentionCount = allItems.filter((item) => ['PARTIAL', 'DEGRADED'].includes(item.status)).length;
  const pendingCount = allItems.filter((item) => ['PENDING', 'NOT_CONNECTED'].includes(item.status)).length;

  return <>
    <PageHeader eyebrow="安全与审计" title="对接状态" description="查看平台、配置、测试发布、OEM、车端和审计系统的数据域接入状态，明确链路事实与后续责任。" badges={['数据状态 · 以服务端为准']} />

    <Alert className="data-notice" type="info" showIcon icon={<InfoCircleOutlined />} title="对接状态不等于业务服务成功" description="本页只表达系统链路和数据域可用性，不代表订阅已开通、消息已送达或车辆端已展示。真实健康度、心跳和连接变更由监控与服务端适配器负责。" />

    <div className="configuration-overview" aria-label="对接概览">
      <div><span>登记系统</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>个</small></div>
      <div><span>已接入</span><strong>{query.isPending ? '—' : connectedCount}</strong><small>个</small></div>
      <div><span>需关注</span><strong>{query.isPending ? '—' : attentionCount}</strong><small>个</small></div>
      <div><span>待接入</span><strong>{query.isPending ? '—' : pendingCount}</strong><small>个</small></div>
    </div>

    <Card className="configuration-list-card" title={<Space size={8}><span>系统对接清单</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="系统 / 数据域 / 负责人 / 下一步" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="接入状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的对接记录" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<SystemIntegrationSummary> rowKey="integrationId" dataSource={items} pagination={false} scroll={{ x: 1260 }} columns={[
          { title: '系统 / 类型', width: 210, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.systemName}</Typography.Text><small>{record.integrationId} · {record.systemType}</small></div> },
          { title: '数据域', width: 230, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.dataDomains.join('、')}</Typography.Text><small>{record.dependencySummary}</small></div> },
          { title: '环境', width: 145, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.environments.map((item) => `${environmentLabel[item]}环境`).join('、')}</Typography.Text><small>最近观测：{record.lastObservedAt}</small></div> },
          { title: '状态', width: 125, render: (_, record) => <div className="configuration-status-cell">{integrationTag(record.status)}<small>来源：{record.sourceSystem}</small></div> },
          { title: '负责人 / 下一步', width: 230, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.ownerName}</Typography.Text><small>{record.nextAction}</small></div> },
          { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => setSelected(record)}>查看详情</Button> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.integrationId}>
          <div className="mobile-configuration-head"><div><strong>{record.systemName}</strong><span>{record.integrationId} · {record.systemType}</span></div>{integrationTag(record.status)}</div>
          <div className="mobile-configuration-meta">数据域：{record.dataDomains.join('、')}</div>
          <div className="mobile-configuration-meta">环境：{record.environments.map((item) => `${environmentLabel[item]}环境`).join('、')} · 最近观测：{record.lastObservedAt}</div>
          <div className="mobile-configuration-status">下一步：{record.nextAction}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName}</span><Button type="link" onClick={() => setSelected(record)}>查看详情</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `对接详情 · ${selected.systemName}` : '对接详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={580}>
      {selected ? <>
        <div className="drawer-status-line">{integrationTag(selected.status)}<Typography.Text type="secondary">更新于 {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="对接编号">{selected.integrationId}</Descriptions.Item>
          <Descriptions.Item label="系统 / 类型">{selected.systemName} · {selected.systemType}</Descriptions.Item>
          <Descriptions.Item label="接入状态">{statusLabel[selected.status]}</Descriptions.Item>
          <Descriptions.Item label="覆盖环境">{selected.environments.map((item) => `${environmentLabel[item]}环境`).join('、')}</Descriptions.Item>
          <Descriptions.Item label="数据域">{selected.dataDomains.join('、')}</Descriptions.Item>
          <Descriptions.Item label="最近观测 / 来源">{selected.lastObservedAt} · {selected.sourceSystem}</Descriptions.Item>
          <Descriptions.Item label="依赖说明">{selected.dependencySummary}</Descriptions.Item>
          <Descriptions.Item label="负责人">{selected.ownerName}</Descriptions.Item>
          <Descriptions.Item label="下一步">{selected.nextAction}</Descriptions.Item>
        </Descriptions>
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>当前为只读接入状态，不执行连接、重试、证书轮换或配置变更。连接状态应由监控、适配器和服务端接口提供心跳及回执。</span></div>
      </> : null}
    </Drawer>
  </>;
}
