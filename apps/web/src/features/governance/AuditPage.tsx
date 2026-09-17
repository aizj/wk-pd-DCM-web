import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { AuditDecision, AuditEventSummary } from '@vrc/contracts';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { getPermissionDefinition, roleCatalog } from '../../core/auth/permissions';
import { PageHeader } from '../../shared/components/PageHeader';
import { StateBoundary } from '../../shared/components/StateBoundary';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };

const decisionOptions: readonly { value: AuditDecision | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部结果' },
  { value: 'ALLOWED', label: '允许' },
  { value: 'DENIED', label: '拒绝' },
];

function decisionTag(decision: AuditDecision) {
  return <Tag color={decision === 'ALLOWED' ? 'green' : 'red'}>{decision === 'ALLOWED' ? '允许' : '拒绝'}</Tag>;
}

function roleLabel(code: string) {
  return roleCatalog.find((role) => role.code === code)?.label ?? code;
}

export function AuditPage() {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [decision, setDecision] = useState<AuditDecision | 'ALL'>('ALL');
  const [module, setModule] = useState('ALL');
  const [selected, setSelected] = useState<AuditEventSummary | null>(null);
  const query = useQuery({ queryKey: ['audit-events', appliedKeyword], queryFn: () => subscriptionGateway.listAuditEvents(appliedKeyword) });
  const allItems = query.data?.items ?? [];
  const modules = [...new Set(allItems.map((item) => getPermissionDefinition(item.permission)?.module).filter((value): value is string => Boolean(value)))];
  const items = allItems.filter((item) => {
    const permissionModule = getPermissionDefinition(item.permission)?.module;
    return (decision === 'ALL' || item.decision === decision) && (module === 'ALL' || permissionModule === module);
  });
  const deniedCount = allItems.filter((item) => item.decision === 'DENIED').length;
  const highRiskDeniedCount = allItems.filter((item) => item.decision === 'DENIED' && ['HIGH', 'CRITICAL'].includes(getPermissionDefinition(item.permission)?.risk ?? '')).length;

  return <>
    <PageHeader eyebrow="安全与审计" title="审计查询" description="查询权限决策和关键业务操作的留痕，核对谁在什么范围、什么环境下访问了什么资源，以及最终结果。" badges={['数据状态 · 以服务端为准']} />

    <Alert className="data-notice" type="info" showIcon icon={<InfoCircleOutlined />} title="审计事实由服务端审计服务生成" description="当前页面展示接入的审计记录；统一审计中心负责记录写入、完整性保护和留存，前端不具备修改或删除审计记录的能力。" />

    <div className="configuration-overview" aria-label="审计概览">
      <div><span>审计事件</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>条</small></div>
      <div><span>允许</span><strong>{query.isPending ? '—' : allItems.length - deniedCount}</strong><small>条</small></div>
      <div><span>拒绝</span><strong>{query.isPending ? '—' : deniedCount}</strong><small>条</small></div>
      <div><span>高风险拒绝</span><strong>{query.isPending ? '—' : highRiskDeniedCount}</strong><small>条</small></div>
    </div>

    <Card className="configuration-list-card" title={<Space size={8}><span>审计事件</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row audit-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="事件编号 / 账号 / 权限码 / 资源 / 链路追踪号" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="决策结果" value={decision} onChange={setDecision} options={decisionOptions.map((item) => ({ value: item.value, label: item.label }))} />
        <Select aria-label="权限模块" value={module} onChange={setModule} options={[{ value: 'ALL', label: '全部模块' }, ...modules.map((item) => ({ value: item, label: item }))]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setDecision('ALL'); setModule('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的审计事件" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<AuditEventSummary> rowKey="eventId" dataSource={items} pagination={false} scroll={{ x: 1180 }} columns={[
          { title: '时间 / 事件', width: 210, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.occurredAt}</Typography.Text><small>{record.eventId}</small></div> },
          { title: '操作者', width: 180, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.actorName}</Typography.Text><small>{record.actorId} · {record.actorRoles.length ? record.actorRoles.map(roleLabel).join('、') : '服务身份'}</small></div> },
          { title: '动作 / 权限', width: 245, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.actionLabel}</Typography.Text><small>{record.permission}</small></div> },
          { title: '资源', width: 180, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.resourceType}</Typography.Text><small>{record.resourceId}</small></div> },
          { title: '结果 / 原因', width: 190, render: (_, record) => <div className="configuration-cell">{decisionTag(record.decision)}<small>{record.reasonCode}</small></div> },
          { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => setSelected(record)}>查看</Button> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.eventId}>
          <div className="mobile-configuration-head"><div><strong>{record.actionLabel}</strong><span>{record.eventId}</span></div>{decisionTag(record.decision)}</div>
          <div className="mobile-configuration-meta">{record.occurredAt} · {record.actorName}</div>
          <div className="mobile-configuration-meta">{record.permission} · {record.resourceType} / {record.resourceId}</div>
          <div className="mobile-configuration-status">{record.reasonCode} · {record.reason}</div>
          <div className="mobile-configuration-footer"><span>{record.sourceSystem}</span><Button type="link" onClick={() => setSelected(record)}>查看</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `审计详情 · ${selected.eventId}` : '审计详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={580}>
      {selected ? <>
        <div className="drawer-status-line">{decisionTag(selected.decision)}<Typography.Text type="secondary">{selected.occurredAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="事件编号">{selected.eventId}</Descriptions.Item>
          <Descriptions.Item label="操作者">{selected.actorName}（{selected.actorId}）</Descriptions.Item>
          <Descriptions.Item label="角色">{selected.actorRoles.length ? selected.actorRoles.map(roleLabel).join('、') : '服务身份（无人工角色）'}</Descriptions.Item>
          <Descriptions.Item label="动作 / 权限">{selected.actionLabel} · {selected.permission}</Descriptions.Item>
          <Descriptions.Item label="决策原因">{selected.reasonCode} · {selected.reason}</Descriptions.Item>
          <Descriptions.Item label="资源">{selected.resourceType} · {selected.resourceId}</Descriptions.Item>
          <Descriptions.Item label="租户 / 环境">{selected.tenantId} · {environmentLabel[selected.environment] ?? selected.environment}</Descriptions.Item>
          <Descriptions.Item label="来源系统">{selected.sourceSystem}</Descriptions.Item>
          <Descriptions.Item label="链路追踪号"><Typography.Text copyable>{selected.traceId}</Typography.Text></Descriptions.Item>
        </Descriptions>
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>审计记录为追加写入事实；如需调查，请使用事件编号或链路追踪号关联网关、业务服务和车企接入日志。</span></div>
      </> : null}
    </Drawer>
  </>;
}
