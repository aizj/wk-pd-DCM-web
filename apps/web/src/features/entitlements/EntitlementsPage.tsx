import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import type { EntitlementSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';
import { PermissionGate } from '../../shared/components/PermissionGate';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };

export function EntitlementsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<EntitlementSummary | null>(null);
  const query = useQuery({ queryKey: ['entitlements', appliedKeyword], queryFn: () => subscriptionGateway.listEntitlements(appliedKeyword) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) => (environment === 'ALL' || item.environment === environment) && (status === 'ALL' || item.status === status));
  const activeCount = allItems.filter((item) => item.status === 'ACTIVE').length;
  const expiringCount = allItems.filter((item) => item.status === 'EXPIRING').length;
  const revokedCount = allItems.filter((item) => item.status === 'REVOKED' || item.status === 'EXPIRED').length;

  return <>
    <PageHeader eyebrow="服务与授权" title="权益与授权" description="查看企业可用的服务、车型能力、环境和有效期边界。" badges={['数据状态 · 以服务端为准']} />

    <div className="catalog-overview" aria-label="权益概览">
      <div><span>权益记录</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>当前有效</span><strong>{query.isPending ? '—' : activeCount}</strong><small>项</small></div>
      <div><span>即将到期</span><strong>{query.isPending ? '—' : expiringCount}</strong><small>项</small></div>
      <div><span>已撤销/过期</span><strong>{query.isPending ? '—' : revokedCount}</strong><small>项</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>权益是申请的上游边界；订阅申请不得扩大服务、环境、覆盖范围、车型能力或有效期。</span></div>

    <Card className="catalog-list-card" title={<Space size={8}><span>权益列表</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="catalog-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="权益编号 / 企业 / 应用 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="权益状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, { value: 'ACTIVE', label: '当前有效' }, { value: 'EXPIRING', label: '即将到期' }, { value: 'REVOKED', label: '已撤销' }, { value: 'EXPIRED', label: '已过期' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的权益记录" onRetry={() => void query.refetch()}>
        <div className="desktop-catalog-table"><Table<EntitlementSummary> rowKey="entitlementId" dataSource={items} pagination={false} scroll={{ x: 1120 }} columns={[
          { title: '权益', width: 220, render: (_, record) => <div className="catalog-cell"><Typography.Text strong>{record.entitlementId}</Typography.Text><span>{record.serviceName} · V{record.revision}</span><small>{record.oemName} · {record.applicationName}</small></div> },
          { title: '环境 / 范围', width: 210, render: (_, record) => <div className="catalog-cell"><span>{environmentLabel[record.environment]}环境</span><small>{record.coverageSummary}</small></div> },
          { title: '车型能力', width: 220, render: (_, record) => <div className="catalog-cell"><span>{record.capabilitySummary}</span><small>有效期至 {record.validTo}</small></div> },
          { title: '权益状态', width: 120, render: (_, record) => <div className="catalog-status-cell"><StatusTag value={record.status} /><small>{statusLabel(record.status)}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="catalog-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 180, fixed: 'right', render: (_, record) => <Space size={0}><Button type="link" onClick={() => setSelected(record)}>查看权益</Button><PermissionGate permission="FR2.REQUEST.CREATE" fallback={null}><>{['ACTIVE', 'EXPIRING'].includes(record.status) ? <Button type="link" onClick={() => navigate(`/fr2/requests/new?serviceId=${encodeURIComponent(record.serviceId)}&entitlementId=${encodeURIComponent(record.entitlementId)}`)}>创建申请</Button> : null}</></PermissionGate></Space> },
        ]} /></div>
        <div className="mobile-catalog-list">{items.map((record) => <div className="mobile-catalog-card" key={record.entitlementId}>
          <div className="mobile-catalog-head"><div><strong>{record.entitlementId}</strong><span>{record.serviceName} · V{record.revision}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-catalog-meta">{record.oemName} · {record.applicationName}</div>
          <div className="mobile-catalog-meta">{environmentLabel[record.environment]}环境 · {record.coverageSummary}</div>
          <div className="mobile-catalog-meta">{record.capabilitySummary} · 有效期至 {record.validTo}</div>
          <div className="mobile-catalog-footer"><span>{record.ownerName} · {record.updatedAt}</span><Space size={0}><Button type="link" onClick={() => setSelected(record)}>查看权益</Button><PermissionGate permission="FR2.REQUEST.CREATE" fallback={null}><>{['ACTIVE', 'EXPIRING'].includes(record.status) ? <Button type="link" onClick={() => navigate(`/fr2/requests/new?serviceId=${encodeURIComponent(record.serviceId)}&entitlementId=${encodeURIComponent(record.entitlementId)}`)}>创建申请</Button> : null}</></PermissionGate></Space></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `权益详情 · ${selected.entitlementId}` : '权益详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={540}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.status} /><Typography.Text type="secondary">V{selected.revision} · {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="授权服务"><Link to="/fr1/catalog" onClick={() => setSelected(null)}>{selected.serviceName}</Link></Descriptions.Item>
          <Descriptions.Item label="企业 / 应用">{selected.oemName} · {selected.applicationName}</Descriptions.Item>
          <Descriptions.Item label="环境 / 范围">{environmentLabel[selected.environment]}环境 · {selected.coverageSummary}</Descriptions.Item>
          <Descriptions.Item label="车型能力">{selected.capabilitySummary}</Descriptions.Item>
          <Descriptions.Item label="有效期">{selected.validFrom} 至 {selected.validTo}</Descriptions.Item>
          <Descriptions.Item label="权益负责人">{selected.ownerName}</Descriptions.Item>
        </Descriptions>
        <div className="data-notice catalog-drawer-notice"><InfoCircleOutlined /><span>{selected.status === 'ACTIVE' ? '申请时只能选择该权益记录覆盖的服务、环境、范围、车型能力和有效期。' : '当前权益不可作为新的有效授权依据，请先联系权益服务负责人确认。'}</span></div>
      </> : null}
    </Drawer>
  </>;
}
