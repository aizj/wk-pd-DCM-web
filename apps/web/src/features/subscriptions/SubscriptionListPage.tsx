import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Typography } from 'antd';
import { FileAddOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import type { SubscriptionRequestSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';
import { PermissionGate } from '../../shared/components/PermissionGate';

function requestAction(record: SubscriptionRequestSummary) {
  if (record.requestStatus === 'DRAFT') return { label: '核对并提交', href: `/fr2/requests/${record.requestId}/submit` };
  if (record.requestStatus === 'SUBMITTED') return { label: '查看提交结果', href: `/fr2/requests/${record.requestId}/submit` };
  return { label: '查看审批', href: `/fr2/approvals/APR-${record.requestId.replace(/^REQ-/, '')}` };
}

const requestStatusOptions = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'WITHDRAWN', 'ABANDONED', 'REQUEST_EXPIRED', 'SUPERSEDED'] as const;
const environmentLabel: Readonly<Record<SubscriptionRequestSummary['environment'], string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };

export function SubscriptionListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [queryKeyword, setQueryKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const query = useQuery({ queryKey: ['subscription-requests', queryKeyword], queryFn: () => subscriptionGateway.listRequests(queryKeyword) });
  const items = query.data?.items ?? [];
  const visibleItems = items.filter((item) => (environment === 'ALL' || item.environment === environment) && (status === 'ALL' || item.requestStatus === status));
  const draftCount = items.filter((item) => item.requestStatus === 'DRAFT').length;
  const reviewCount = items.filter((item) => item.requestStatus === 'IN_REVIEW').length;
  const attentionCount = items.filter((item) => item.precheckOutcome !== 'PASS' || item.blockerCount > 0).length;

  return <>
    <PageHeader eyebrow="订阅申请" title="申请管理" description="查看申请进度，进入对应记录继续办理。" badges={['当前租户 · 当前环境']} actions={<PermissionGate permission="FR2.REQUEST.CREATE" fallback={<Button disabled icon={<FileAddOutlined />}>新建申请</Button>}><Button type="primary" icon={<FileAddOutlined />} onClick={() => navigate('/fr2/requests/new')}>新建申请</Button></PermissionGate>} />

    <div className="request-overview" aria-label="申请概览">
      <div><span>全部申请</span><strong>{items.length}</strong><small>项</small></div>
      <div><span>待提交</span><strong>{draftCount}</strong><small>项</small></div>
      <div><span>审批中</span><strong>{reviewCount}</strong><small>项</small></div>
      <div><span>需关注</span><strong>{attentionCount}</strong><small>项</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>申请状态只代表平台申请流程；审批通过后仍需完成配置、测试和发布。</span></div>

    <Card className="request-list-card" title={<Space size={8}><span>申请列表</span><span className="list-count">{visibleItems.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="filter-row">
        <Input allowClear prefix={<SearchOutlined />} placeholder="申请编号 / 企业 / 应用 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setQueryKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="申请状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, ...requestStatusOptions.map((value) => ({ value, label: statusLabel(value) }))]} />
        <Button type="primary" onClick={() => setQueryKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setQueryKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : visibleItems.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的申请" onRetry={() => void query.refetch()}>
        <div className="desktop-request-table"><Table<SubscriptionRequestSummary> rowKey={(record) => `${record.requestId}-${record.requestRevision}`} dataSource={visibleItems} pagination={{ pageSize: 10, total: visibleItems.length }} scroll={{ x: 980 }} columns={[
          { title: '申请', width: 220, render: (_, record) => <div className="request-cell"><Typography.Text strong>{record.requestId}</Typography.Text><span>版本 V{record.requestRevision} · {record.oemName}</span><small>{record.applicationName}</small></div> },
          { title: '服务与范围', width: 240, render: (_, record) => <div className="request-cell"><Typography.Text>{record.serviceName}</Typography.Text><span>{record.coverageSummary}</span><small>{record.channelType === 'UU_A' ? '企业云接入' : record.channelType} · {environmentLabel[record.environment]}</small></div> },
          { title: '申请状态', width: 115, render: (_, record) => <StatusTag value={record.requestStatus} /> },
          { title: '准入检查', width: 145, render: (_, record) => <div className="request-status-cell"><StatusTag value={record.precheckOutcome} /><small>{record.blockerCount ? `${record.blockerCount} 项未通过` : statusLabel(record.precheckValidity)}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="request-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '下一步', width: 110, fixed: 'right', render: (_, record) => { const action = requestAction(record); return <Link to={action.href}>{action.label}</Link>; } },
        ]} /></div>
        <div className="mobile-request-list">{visibleItems.map((record) => { const action = requestAction(record); return <div className="mobile-request-card" key={`${record.requestId}-${record.requestRevision}`}>
          <div className="mobile-request-head"><div><Link to={action.href}>{record.requestId}</Link><strong>{record.serviceName}</strong></div><StatusTag value={record.requestStatus} /></div>
          <div className="mobile-request-meta">{record.oemName} · {record.applicationName}</div>
          <div className="mobile-request-scope">{record.coverageSummary}</div>
          <div className="mobile-request-status"><StatusTag value={record.precheckOutcome} /><span>{record.blockerCount ? `${record.blockerCount} 项未通过` : statusLabel(record.precheckValidity)}</span></div>
          <div className="mobile-request-footer"><span>{record.ownerName} · {record.updatedAt}</span><Link to={action.href}>{action.label}</Link></div>
        </div>; })}</div>
      </StateBoundary>
    </Card>
  </>;
}
