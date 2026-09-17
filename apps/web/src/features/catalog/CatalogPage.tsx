import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Typography } from 'antd';
import { FileSearchOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ServiceCatalogSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';
import { PermissionGate } from '../../shared/components/PermissionGate';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };

export function CatalogPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [selected, setSelected] = useState<ServiceCatalogSummary | null>(null);
  const query = useQuery({ queryKey: ['service-catalog', appliedKeyword], queryFn: () => subscriptionGateway.listCatalog(appliedKeyword) });
  const entitlementQuery = useQuery({ queryKey: ['catalog-entitlements'], queryFn: () => subscriptionGateway.listEntitlements() });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) => (environment === 'ALL' || item.supportedEnvironments.includes(environment as ServiceCatalogSummary['supportedEnvironments'][number])) && (availability === 'ALL' || item.availability === availability));
  const availableCount = allItems.filter((item) => item.availability === 'AVAILABLE').length;
  const pilotCount = allItems.filter((item) => item.availability === 'PILOT').length;
  const scenarioCount = new Set(allItems.flatMap((item) => item.scenarioTags)).size;

  return <>
    <PageHeader eyebrow="服务与授权" title="服务目录" description="查看可提供的数据上车服务、适用场景和接入前置条件。" badges={['数据状态 · 以服务端为准']} />

    <div className="catalog-overview" aria-label="服务目录概览">
      <div><span>服务版本</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>当前可申请</span><strong>{query.isPending ? '—' : availableCount}</strong><small>项</small></div>
      <div><span>试点服务</span><strong>{query.isPending ? '—' : pilotCount}</strong><small>项</small></div>
      <div><span>覆盖场景</span><strong>{query.isPending ? '—' : scenarioCount}</strong><small>类</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>目录只说明平台当前可提供的服务能力，实际可申请范围仍以企业权益、车型能力和环境授权为准。</span></div>

    <Card className="catalog-list-card" title={<Space size={8}><span>服务列表</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="catalog-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="服务名称 / 场景 / 覆盖范围" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="支持环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="服务状态" value={availability} onChange={setAvailability} options={[{ value: 'ALL', label: '全部状态' }, { value: 'AVAILABLE', label: '可申请' }, { value: 'PILOT', label: '试点中' }, { value: 'SUSPENDED', label: '已暂停申请' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setAvailability('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的服务" onRetry={() => void query.refetch()}>
        <div className="desktop-catalog-table"><Table<ServiceCatalogSummary> rowKey="serviceId" dataSource={items} pagination={false} scroll={{ x: 1080 }} columns={[
          { title: '服务', width: 220, render: (_, record) => <div className="catalog-cell"><Typography.Text strong>{record.serviceName}</Typography.Text><span>{record.serviceId} · v{record.serviceVersion}</span><small>{record.description}</small></div> },
          { title: '场景与范围', width: 245, render: (_, record) => <div className="catalog-cell"><span>{record.scenarioTags.join('、')}</span><small>{record.coverageSummary}</small></div> },
          { title: '接入条件', width: 175, render: (_, record) => <div className="catalog-cell"><span>{record.channelTypes.map((type) => type === 'UU_A' ? '企业云接入' : type).join('、')}</span><small>{record.qualificationProfile}</small></div> },
          { title: '服务状态', width: 110, render: (_, record) => <StatusTag value={record.availability} /> },
          { title: '支持环境', width: 125, render: (_, record) => <span className="catalog-environment">{record.supportedEnvironments.map((env) => environmentLabel[env]).join('、')}</span> },
          { title: '操作', width: 120, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => setSelected(record)}>查看服务</Button> },
        ]} /></div>
        <div className="mobile-catalog-list">{items.map((record) => <div className="mobile-catalog-card" key={record.serviceId}>
          <div className="mobile-catalog-head"><div><strong>{record.serviceName}</strong><span>{record.serviceId} · v{record.serviceVersion}</span></div><StatusTag value={record.availability} /></div>
          <div className="mobile-catalog-description">{record.description}</div>
          <div className="mobile-catalog-meta">{record.scenarioTags.join('、')}</div>
          <div className="mobile-catalog-meta">{record.coverageSummary} · {record.supportedEnvironments.map((env) => `${environmentLabel[env]}环境`).join('、')}</div>
          <div className="mobile-catalog-footer"><span>{record.qualificationProfile}</span><Button type="link" onClick={() => setSelected(record)}>查看服务</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `服务详情 · ${selected.serviceName}` : '服务详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={540}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.availability} /><Typography.Text type="secondary">{selected.serviceId} · v{selected.serviceVersion}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="服务说明">{selected.description}</Descriptions.Item>
          <Descriptions.Item label="适用场景">{selected.scenarioTags.join('、')}</Descriptions.Item>
          <Descriptions.Item label="覆盖范围">{selected.coverageSummary}</Descriptions.Item>
          <Descriptions.Item label="接入方式">{selected.channelTypes.map((type) => type === 'UU_A' ? '企业云接入' : type).join('、')}</Descriptions.Item>
          <Descriptions.Item label="支持环境">{selected.supportedEnvironments.map((env) => environmentLabel[env]).join('、')}</Descriptions.Item>
          <Descriptions.Item label="联合测试配置">{selected.qualificationProfile}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{selected.updatedAt}</Descriptions.Item>
        </Descriptions>
        {(() => {
          const matched = (entitlementQuery.data?.items ?? []).filter((item) => item.serviceId === selected.serviceId && selected.supportedEnvironments.includes(item.environment));
          const active = matched.filter((item) => ['ACTIVE', 'EXPIRING'].includes(item.status));
          return <Card size="small" title="当前租户权益匹配" style={{ marginTop: 16 }}>
            {entitlementQuery.isPending ? <Typography.Text type="secondary">权益匹配加载中…</Typography.Text> : matched.length ? <Space orientation="vertical" size={6} style={{ width: '100%' }}>{matched.map((item) => <div className="catalog-cell" key={item.entitlementId}><Space><Typography.Text strong>{item.entitlementId}</Typography.Text><StatusTag value={item.status} /></Space><span>{item.serviceName} · {environmentLabel[item.environment]}环境 · {item.coverageSummary}</span><small>{item.capabilitySummary} · 有效期至 {item.validTo}</small></div>)}</Space> : <Typography.Text type="secondary">当前租户没有匹配的企业权益；需先完成权益授权。</Typography.Text>}
            <div className="data-notice catalog-drawer-notice"><InfoCircleOutlined /><span>{selected.availability === 'SUSPENDED' ? '当前服务暂停申请，请等待服务负责人恢复后再创建订阅。' : active.length ? '已匹配有效权益，但申请仍需再次校验车型能力、接入凭证、服务范围和有效期。' : '未匹配有效权益，不能扩大申请范围；请先完成企业权益授权。'}</span></div>
            {selected.availability !== 'SUSPENDED' && active.length ? <PermissionGate permission="FR2.REQUEST.CREATE" fallback={<Button type="primary" disabled>创建申请草稿</Button>}><Button type="primary" icon={<FileSearchOutlined />} onClick={() => { setSelected(null); navigate(`/fr2/requests/new?serviceId=${encodeURIComponent(selected.serviceId)}&entitlementId=${encodeURIComponent(active[0]!.entitlementId)}`); }}>创建申请草稿</Button></PermissionGate> : null}
          </Card>;
        })()}
      </> : null}
    </Drawer>
  </>;
}
