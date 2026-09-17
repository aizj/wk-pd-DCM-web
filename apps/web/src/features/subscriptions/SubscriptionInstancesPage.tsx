import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { SubscriptionInstanceSummary, SubscriptionSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

interface InstanceRow {
  summary: SubscriptionSummary;
  instance: SubscriptionInstanceSummary;
  subscriptionRowSpan: number;
}

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };

function ExternalFact({ label, value }: { label: string; value: string }) {
  return <div className="external-fact-line"><span>{label}</span><span className={value === 'UNKNOWN' ? 'fact-unavailable' : 'fact-known'}>{value === 'UNKNOWN' ? '未接入' : statusLabel(value)}</span></div>;
}

export function SubscriptionInstancesPage() {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [lifecycle, setLifecycle] = useState('ALL');
  const subscriptions = useQuery({ queryKey: ['subscriptions'], queryFn: () => subscriptionGateway.listSubscriptions() });
  const instances = useQuery({ queryKey: ['subscription-instances'], queryFn: () => subscriptionGateway.listInstances() });
  const summaries = subscriptions.data?.items ?? [];
  const allInstances = instances.data?.items ?? [];
  const normalized = appliedKeyword.trim().toLowerCase();
  const rows: InstanceRow[] = summaries.flatMap((summary) => {
    const subscriptionMatches = [summary.subscriptionId, summary.oemName, summary.applicationName, summary.serviceName].some((value) => value.toLowerCase().includes(normalized));
    const matchingInstances = allInstances.filter((instance) => instance.subscriptionId === summary.subscriptionId
      && (environment === 'ALL' || instance.environment === environment)
      && (lifecycle === 'ALL' || instance.lifecycle === lifecycle)
      && (subscriptionMatches || [instance.instanceId, instance.coverageSummary].some((value) => value.toLowerCase().includes(normalized))));
    return matchingInstances.map((instance, index) => ({ summary, instance, subscriptionRowSpan: index === 0 ? matchingInstances.length : 0 }));
  });
  const pendingCount = allInstances.filter((item) => item.lifecycle === 'PENDING_ACTIVATION').length;
  const unknownCount = allInstances.filter((item) => item.releaseStatus === 'UNKNOWN' || item.runtimeHealth === 'UNKNOWN' || item.evidenceGrade === 'UNKNOWN').length;
  const loading = subscriptions.isPending || instances.isPending;

  return <>
    <PageHeader eyebrow="订阅运营" title="订阅实例" description="按实例核对订阅范围、开通条件和后续交付状态。" badges={['数据状态 · 以服务端为准']} />

    <div className="subscription-overview" aria-label="订阅实例概览">
      <div><span>订阅关系</span><strong>{loading ? '—' : summaries.length}</strong><small>项</small></div>
      <div><span>原子实例</span><strong>{loading ? '—' : allInstances.length}</strong><small>个</small></div>
      <div><span>待开通</span><strong>{loading ? '—' : pendingCount}</strong><small>个</small></div>
      <div><span>外部状态未接入</span><strong>{loading ? '—' : unknownCount}</strong><small>个</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>当前为汇总快照。配置、发布、运行及车辆展示须以各系统实际结果为准，未接入状态不会按“成功”展示。</span></div>

    <Card className="subscription-list-card" title={<Space size={8}><span>实例清单</span><span className="list-count">{loading ? '—' : rows.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{instances.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="subscription-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="订阅编号 / 实例编号 / 企业 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="生命周期" value={lifecycle} onChange={setLifecycle} options={[{ value: 'ALL', label: '全部状态' }, { value: 'PENDING_ACTIVATION', label: '待开通' }, { value: 'ACTIVE', label: '已开通' }, { value: 'EXPIRED', label: '已过期' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setLifecycle('ALL'); void subscriptions.refetch(); void instances.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={loading ? 'loading' : subscriptions.isError || instances.isError ? 'error' : rows.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的订阅实例" onRetry={() => { void subscriptions.refetch(); void instances.refetch(); }}>
        <div className="desktop-instance-table"><Table<InstanceRow> rowKey={(row) => row.instance.instanceId} dataSource={rows} pagination={false} scroll={{ x: 1120 }} columns={[
          { title: '订阅 / 服务', width: 215, onCell: (row) => ({ rowSpan: row.subscriptionRowSpan }), render: (_, row) => <div className="subscription-cell"><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}`}>{row.summary.subscriptionId}</Link><strong>{row.summary.serviceName}</strong><small>{row.summary.oemName} · {row.summary.applicationName}</small></div> },
          { title: '实例 / 适用区域', width: 220, render: (_, row) => <div className="instance-cell"><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}?instanceId=${row.instance.instanceId}`}>{row.instance.instanceId}</Link><span>{row.instance.coverageSummary}</span><small>{environmentLabel[row.instance.environment]}环境 · {row.instance.channelType === 'UU_A' ? '企业云接入' : row.instance.channelType}</small></div> },
          { title: '版本', width: 130, render: (_, row) => <div className="version-cell"><span>获批 V{row.summary.currentRevision}</span><small>{row.instance.effectiveRevisionId ? '已生效' : '尚未生效'}</small></div> },
          { title: '生命周期 / 控制', width: 130, render: (_, row) => <div className="status-cell"><StatusTag value={row.instance.lifecycle} /><small>控制：{statusLabel(row.instance.controlStatus)}</small></div> },
          { title: '开通条件', width: 105, render: (_, row) => <StatusTag value={row.instance.activationReadiness} /> },
          { title: '外部交付事实', width: 145, render: (_, row) => <div className="external-fact-stack"><ExternalFact label="发布" value={row.instance.releaseStatus} /><ExternalFact label="运行" value={row.instance.runtimeHealth} /><ExternalFact label="证据" value={row.instance.evidenceGrade} /></div> },
          { title: '更新时间', width: 125, render: (_, row) => <span className="table-time">{row.instance.updatedAt}</span> },
          { title: '操作', width: 135, fixed: 'right', render: (_, row) => <Space size={8}><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}?instanceId=${row.instance.instanceId}`}>查看详情</Link><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}/diagnosis`}>运行诊断</Link></Space> },
        ]} /></div>
        <div className="mobile-instance-list">
          {rows.map((row) => <div className="mobile-instance-card" key={row.instance.instanceId}>
            <div className="mobile-subscription-name"><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}`}>{row.summary.subscriptionId}</Link><span>{row.summary.serviceName}</span></div>
            <div className="mobile-instance-title"><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}?instanceId=${row.instance.instanceId}`}>{row.instance.instanceId}</Link><span>{row.instance.coverageSummary}</span></div>
            <div className="mobile-instance-meta">{environmentLabel[row.instance.environment]}环境 · {row.instance.channelType === 'UU_A' ? '企业云接入' : row.instance.channelType} · 获批 V{row.summary.currentRevision}</div>
            <div className="mobile-instance-status"><StatusTag value={row.instance.lifecycle} /><StatusTag value={row.instance.activationReadiness} /><span>发布 / 运行 / 证据未接入</span></div>
            <div className="mobile-instance-footer"><span>更新于 {row.instance.updatedAt}</span><Space size={8}><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}?instanceId=${row.instance.instanceId}`}>详情</Link><Link to={`/fr2/subscriptions/${row.summary.subscriptionId}/diagnosis`}>诊断</Link></Space></div>
          </div>)}
        </div>
      </StateBoundary>
    </Card>
  </>;
}
