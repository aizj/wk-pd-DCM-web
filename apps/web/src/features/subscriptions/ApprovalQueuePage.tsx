import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import type { ApprovalCaseSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { useAuth } from '../../core/auth/AuthProvider';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const riskLabel: Readonly<Record<ApprovalCaseSummary['riskLevel'], string>> = { LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险' };
const riskColor: Readonly<Record<ApprovalCaseSummary['riskLevel'], string>> = { LOW: 'default', MEDIUM: 'blue', HIGH: 'red' };
const decisionStatuses: readonly { value: ApprovalCaseSummary['status'] | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'IN_REVIEW', label: '审批中' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'CONDITIONALLY_APPROVED', label: '附条件批准' },
  { value: 'RETURNED', label: '已退回' },
  { value: 'REJECTED', label: '已拒绝' },
];

export function ApprovalQueuePage() {
  const navigate = useNavigate();
  const { actor } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [scope, setScope] = useState<'ALL' | 'MINE'>('MINE');
  const [status, setStatus] = useState<ApprovalCaseSummary['status'] | 'ALL'>('ALL');
  const [risk, setRisk] = useState<ApprovalCaseSummary['riskLevel'] | 'ALL'>('ALL');
  const [environment, setEnvironment] = useState('ALL');
  const query = useQuery({ queryKey: ['approval-cases', appliedKeyword], queryFn: () => subscriptionGateway.listApprovalCases(appliedKeyword) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) =>
    (scope === 'ALL' || item.currentAssigneeId === actor.actorId)
    && (status === 'ALL' || item.status === status)
    && (risk === 'ALL' || item.riskLevel === risk)
    && (environment === 'ALL' || item.environment === environment),
  );
  const pendingCount = allItems.filter((item) => ['PENDING', 'IN_REVIEW'].includes(item.status) && item.currentAssigneeId === actor.actorId).length;
  const highRiskCount = allItems.filter((item) => item.riskLevel === 'HIGH' && ['PENDING', 'IN_REVIEW'].includes(item.status)).length;
  const conditionalCount = allItems.filter((item) => item.precheckOutcome === 'PASS_WITH_CONDITIONS').length;

  return <>
    <PageHeader eyebrow="订阅审批" title="审批队列" description="按处理人、状态和风险查看审批事项，再进入单条审批页核对申请、准入检查和附加条件。" badges={['数据状态 · 以服务端为准']} actions={<Button type="primary" onClick={() => navigate('/fr2/requests')}>查看申请管理</Button>} />

    <Alert className="data-notice" type="info" showIcon icon={<InfoCircleOutlined />} title="队列只负责定位审批事项" description="进入详情后仍需服务端校验当前处理人、职责分离、准入检查有效性和对象状态；本页不改变审批状态，也不替代审批决定。" />

    <div className="configuration-overview" aria-label="审批概览">
      <div><span>队列事项</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>我的待处理</span><strong>{query.isPending ? '—' : pendingCount}</strong><small>项</small></div>
      <div><span>高风险待处理</span><strong>{query.isPending ? '—' : highRiskCount}</strong><small>项</small></div>
      <div><span>有条件通过</span><strong>{query.isPending ? '—' : conditionalCount}</strong><small>项</small></div>
    </div>

    <Card className="configuration-list-card" title={<Space size={8}><span>审批事项</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="审批单 / 申请 / 服务 / 企业 / 处理人" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="处理范围" value={scope} onChange={setScope} options={[{ value: 'MINE', label: '我的待办' }, { value: 'ALL', label: '全部事项' }]} />
        <Select aria-label="审批状态" value={status} onChange={setStatus} options={decisionStatuses.map((item) => ({ value: item.value, label: item.label }))} />
        <Select aria-label="风险等级" value={risk} onChange={setRisk} options={[{ value: 'ALL', label: '全部风险' }, { value: 'LOW', label: '低风险' }, { value: 'MEDIUM', label: '中风险' }, { value: 'HIGH', label: '高风险' }]} />
        <Select aria-label="申请环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setScope('MINE'); setStatus('ALL'); setRisk('ALL'); setEnvironment('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的审批事项" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<ApprovalCaseSummary> rowKey="approvalCaseId" dataSource={items} pagination={false} scroll={{ x: 1260 }} columns={[
          { title: '审批单 / 申请', width: 220, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.approvalCaseId}</Typography.Text><small>{record.requestId} · V{record.requestRevision}</small></div> },
          { title: '服务 / 企业', width: 250, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.serviceName}</Typography.Text><small>{record.oemName} · {record.applicationName}</small></div> },
          { title: '状态 / 风险', width: 160, render: (_, record) => <div className="configuration-status-cell"><Space size={4} wrap><StatusTag value={record.status} /><Tag color={riskColor[record.riskLevel]}>{riskLabel[record.riskLevel]}</Tag></Space><small>{record.precheckOutcome === 'PASS_WITH_CONDITIONS' ? '准入有条件通过' : statusLabel(record.precheckOutcome)}</small></div> },
          { title: '处理人 / 时限', width: 190, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.currentAssigneeName}</Typography.Text><small>截止：{record.dueAt}</small></div> },
          { title: '环境 / 更新', width: 150, render: (_, record) => <div className="configuration-cell"><Typography.Text>{environmentLabel[record.environment]}环境</Typography.Text><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 105, fixed: 'right', render: (_, record) => <Link className="ant-btn ant-btn-link" to={`/fr2/approvals/${record.approvalCaseId}`}>查看审批</Link> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.approvalCaseId}>
          <div className="mobile-configuration-head"><div><strong>{record.approvalCaseId}</strong><span>{record.serviceName}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-configuration-meta">{record.oemName} · {record.applicationName}</div>
          <div className="mobile-configuration-meta">{environmentLabel[record.environment]}环境 · {record.currentAssigneeName} · 截止 {record.dueAt}</div>
          <div className="mobile-configuration-status"><Tag color={riskColor[record.riskLevel]}>{riskLabel[record.riskLevel]}</Tag> · {record.precheckOutcome === 'PASS_WITH_CONDITIONS' ? '准入有条件通过' : statusLabel(record.precheckOutcome)}</div>
          <div className="mobile-configuration-footer"><span>更新：{record.updatedAt}</span><Link to={`/fr2/approvals/${record.approvalCaseId}`}>查看审批</Link></div>
        </div>)}</div>
      </StateBoundary>
    </Card>
  </>;
}
