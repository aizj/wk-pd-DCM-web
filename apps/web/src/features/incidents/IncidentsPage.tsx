import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Result, Select, Space, Table, Timeline, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { IncidentActionInput, IncidentActionReceipt, IncidentCategory, IncidentDetail, IncidentSeverity, IncidentStatus, IncidentSummary, IncidentTimelineEntry } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const categoryLabel: Readonly<Record<IncidentCategory, string>> = { DELIVERY: '投递', RELEASE: '发布', RUNTIME: '运行', CONFIGURATION: '配置' };
const severityOptions: readonly IncidentSeverity[] = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'];
const statusOptions: readonly IncidentStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const actionLabel: Readonly<Record<IncidentActionInput['action'], string>> = { ACKNOWLEDGE: '确认已接收', ASSIGN: '转派负责人', RESOLVE: '提交恢复确认' };
const actionReasonLabel: Readonly<Record<IncidentActionInput['reasonCode'], string>> = { CONFIRM_RECEIPT: '确认影响范围', OWNER_HANDOFF: '责任人转派', RECOVERY_VERIFIED: '恢复证据已核验' };
const actionReasonByType: Readonly<Record<IncidentActionInput['action'], IncidentActionInput['reasonCode']>> = { ACKNOWLEDGE: 'CONFIRM_RECEIPT', ASSIGN: 'OWNER_HANDOFF', RESOLVE: 'RECOVERY_VERIFIED' };
const actionErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少事件处置权限，请联系运行负责人或切换到已授权身份。',
  IDEMPOTENCY_KEY_REQUIRED: '操作流水号缺失，请重新打开事件详情后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '操作流水号已被其他处置占用，请重新打开事件详情后重试。',
  INCIDENT_NOT_FOUND: '事件不存在或已不在当前授权范围内。',
  INCIDENT_ACTION_INPUT_INVALID: '处置动作、原因或说明不完整，请检查后重试。',
  INCIDENT_ACTION_OWNER_REQUIRED: '转派负责人时必须填写接收人。',
  INCIDENT_RESOLVE_EVIDENCE_REQUIRED: '当前事件没有可核验的恢复证据，不能提交恢复确认。',
  INCIDENT_ACTION_STATE_INVALID: '当前事件状态不允许执行该动作，请刷新后重试。',
  INCIDENT_ACTION_NOTE_REQUIRED: '请填写至少5个字的处置说明。',
};

function incidentActionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return actionErrorLabel[code] ?? '事件处置提交失败，请稍后重试；如果问题持续，请联系运行负责人。';
}

export function IncidentsPage() {
  const { actor, authorize } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<IncidentSummary | null>(null);
  const [actionType, setActionType] = useState<IncidentActionInput['action']>('ACKNOWLEDGE');
  const [actionOwner, setActionOwner] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionReceipt, setActionReceipt] = useState<IncidentActionReceipt | null>(null);
  const actionSequence = useRef(1);
  const actionIdempotencyKey = useRef('INC-ACTION-' + actor.actorId + '-' + actor.environment + '-01');
  const query = useQuery({ queryKey: ['incidents', appliedKeyword], queryFn: () => subscriptionGateway.listIncidents(appliedKeyword) });
  const detailQuery = useQuery({ queryKey: ['incident-detail', selected?.incidentId], queryFn: () => subscriptionGateway.getIncident(selected?.incidentId ?? ''), enabled: Boolean(selected) });
  const actionReceiptsQuery = useQuery({ queryKey: ['incident-action-receipts'], queryFn: () => subscriptionGateway.listIncidentActionReceipts() });
  const canUpdate = authorize({ permission: 'FR5.INCIDENT.UPDATE' }).allowed;
  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('INCIDENT_NOT_FOUND');
      if (actionNote.trim().length < 5) throw new Error('INCIDENT_ACTION_NOTE_REQUIRED');
      return subscriptionGateway.recordIncidentAction({
        incidentId: selected.incidentId,
        action: actionType,
        ...(actionType === 'ASSIGN' ? { ownerName: actionOwner } : {}),
        note: actionNote,
        reasonCode: actionReasonByType[actionType],
      }, actionIdempotencyKey.current);
    },
    onSuccess: (receipt) => {
      setActionReceipt(receipt);
      void actionReceiptsQuery.refetch();
    },
  });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) =>
    (environment === 'ALL' || item.environment === environment)
    && (category === 'ALL' || item.category === category)
    && (severity === 'ALL' || item.severity === severity)
    && (status === 'ALL' || item.status === status),
  );
  const openCount = allItems.filter((item) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(item.status)).length;
  const highRiskCount = allItems.filter((item) => ['HIGH', 'CRITICAL'].includes(item.severity)).length;
  const resolvedCount = allItems.filter((item) => ['RESOLVED', 'CLOSED'].includes(item.status)).length;

  function openIncident(record: IncidentSummary) {
    setSelected(record);
    setActionType(record.status === 'OPEN' ? 'ACKNOWLEDGE' : 'ASSIGN');
    setActionOwner('');
    setActionNote('');
    setActionReceipt(null);
    actionMutation.reset();
    actionSequence.current += 1;
    actionIdempotencyKey.current = 'INC-ACTION-' + actor.actorId + '-' + record.environment + '-' + String(actionSequence.current).padStart(2, '0');
  }

  return <>
    <PageHeader eyebrow="运行监控" title="事件与工单" description="记录投递、发布、运行和配置异常，明确严重度、处理状态与责任归属。" badges={canUpdate ? ['数据状态 · 以服务端为准', '处置权限 · 已授权'] : ['数据状态 · 以服务端为准']} />

    <div className="configuration-overview" aria-label="事件概览">
      <div><span>事件总数</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>条</small></div>
      <div><span>待处理</span><strong>{query.isPending ? '—' : openCount}</strong><small>条</small></div>
      <div><span>高风险</span><strong>{query.isPending ? '—' : highRiskCount}</strong><small>条</small></div>
      <div><span>已恢复 / 关闭</span><strong>{query.isPending ? '—' : resolvedCount}</strong><small>条</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>事件记录用于跟踪异常事实和责任归属；处理完成不等于车辆端证据已恢复，需回到证据链确认实际结果。</span></div>

    <Card className="configuration-list-card" title={<Space size={8}><span>事件列表</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="事件编号 / 订阅 / 实例 / 摘要" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="事件类别" value={category} onChange={setCategory} options={[{ value: 'ALL', label: '全部类别' }, { value: 'DELIVERY', label: '投递' }, { value: 'RELEASE', label: '发布' }, { value: 'RUNTIME', label: '运行' }, { value: 'CONFIGURATION', label: '配置' }]} />
        <Select aria-label="严重度" value={severity} onChange={setSeverity} options={[{ value: 'ALL', label: '全部严重度' }, ...severityOptions.map((value) => ({ value, label: value === 'INFO' ? '提示' : value === 'WARNING' ? '警告' : value === 'HIGH' ? '高' : '严重' }))]} />
        <Select aria-label="处理状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, ...statusOptions.map((value) => ({ value, label: value === 'OPEN' ? '待处理' : value === 'ACKNOWLEDGED' ? '已确认' : value === 'IN_PROGRESS' ? '处理中' : value === 'RESOLVED' ? '已恢复' : '已关闭' }))]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setCategory('ALL'); setSeverity('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的事件" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<IncidentSummary> rowKey="incidentId" dataSource={items} pagination={false} scroll={{ x: 1180 }} columns={[
          { title: '事件', width: 265, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.incidentId}</Typography.Text><span>{record.summary}</span><small>{environmentLabel[record.environment]}环境 · {categoryLabel[record.category]}</small></div> },
          { title: '订阅 / 实例', width: 205, render: (_, record) => <div className="configuration-cell"><Link to={`/fr2/subscriptions/${record.subscriptionId}?instanceId=${record.instanceId}`}>{record.subscriptionId}</Link><span>{record.instanceId}</span><small>{record.serviceName}</small></div> },
          { title: '严重度', width: 110, render: (_, record) => <StatusTag value={record.severity} /> },
          { title: '处理状态', width: 120, render: (_, record) => <StatusTag value={record.status} /> },
          { title: '负责人 / 时间', width: 175, render: (_, record) => <div className="configuration-cell"><span>{record.ownerName}</span><small>首次发现 {record.firstSeenAt}</small><small>更新于 {record.updatedAt}</small></div> },
          { title: '操作', width: 120, fixed: 'right', render: (_, record) => <Button type="link" onClick={() => openIncident(record)}>查看事件</Button> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.incidentId}>
          <div className="mobile-configuration-head"><div><strong>{record.incidentId}</strong><span>{record.summary}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-configuration-meta">{record.serviceName} · {environmentLabel[record.environment]}环境</div>
          <div className="mobile-configuration-meta">{record.subscriptionId} · {record.instanceId} · {categoryLabel[record.category]}</div>
          <div className="incident-severity-row"><StatusTag value={record.severity} /><span>{record.ownerName}</span></div>
          <div className="mobile-configuration-status">首次发现：{record.firstSeenAt} · 更新：{record.updatedAt}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName}</span><Button type="link" onClick={() => openIncident(record)}>查看事件</Button></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Card className="configuration-list-card" title={<Space size={8}><span>事件处置回执</span><span className="list-count">{actionReceiptsQuery.data?.items.length ?? 0}</span></Space>} extra={<Typography.Text type="secondary">仅展示当前账号提交的处置意图</Typography.Text>}>
      <StateBoundary state={actionReceiptsQuery.isPending ? 'loading' : actionReceiptsQuery.isError ? 'error' : actionReceiptsQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂没有事件处置回执" onRetry={() => void actionReceiptsQuery.refetch()}>
        <div className="desktop-configuration-table"><Table<IncidentActionReceipt> rowKey="actionId" dataSource={actionReceiptsQuery.data?.items ?? []} pagination={false} scroll={{ x: 1000 }} columns={[
          { title: '操作编号', width: 190, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.actionId}</Typography.Text><small>{record.incidentId}</small></div> },
          { title: '处置动作', width: 150, render: (_, record) => <div className="configuration-cell"><span>{actionLabel[record.action]}</span><small>{actionReasonLabel[record.reasonCode]}</small></div> },
          { title: '说明 / 负责人', width: 360, render: (_, record) => <div className="configuration-cell"><span>{record.note}</span><small>{record.ownerName ? `转派至 ${record.ownerName}` : '未变更负责人'}</small></div> },
          { title: '状态', width: 110, render: () => <StatusTag value="RECORDED" /> },
          { title: '提交时间', width: 180, dataIndex: 'submittedAt' },
        ]} /></div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `事件详情 · ${selected.incidentId}` : '事件详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={720}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.severity} /><StatusTag value={selected.status} /><Typography.Text type="secondary">{selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="事件摘要">{selected.summary}</Descriptions.Item>
          <Descriptions.Item label="事件类别 / 环境">{categoryLabel[selected.category]} · {environmentLabel[selected.environment]}环境</Descriptions.Item>
          <Descriptions.Item label="所属订阅"><Link to={`/fr2/subscriptions/${selected.subscriptionId}?instanceId=${selected.instanceId}`} onClick={() => setSelected(null)}>{selected.subscriptionId}</Link></Descriptions.Item>
          <Descriptions.Item label="目标实例">{selected.instanceId}</Descriptions.Item>
          <Descriptions.Item label="关联服务">{selected.serviceName}</Descriptions.Item>
          <Descriptions.Item label="责任人">{selected.ownerName}</Descriptions.Item>
          <Descriptions.Item label="首次发现">{selected.firstSeenAt}</Descriptions.Item>
          <Descriptions.Item label="最近更新">{selected.updatedAt}</Descriptions.Item>
        </Descriptions>
        {detailQuery.isPending ? <Typography.Paragraph type="secondary">事件处置信息加载中…</Typography.Paragraph> : detailQuery.isError ? <Alert type="error" showIcon title="事件详情加载失败" description="请稍后重试；当前事件摘要仍然可用。" /> : detailQuery.data ? <IncidentDetailView detail={detailQuery.data} /> : null}
        {actionReceipt ? <Result status="info" title="处置意图已记录" subTitle="回执仅代表平台已接收操作意图；事件状态、负责人和恢复结果仍需后续系统事实回传确认。" extra={<Button onClick={() => setActionReceipt(null)}>继续处置</Button>}>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="操作编号">{actionReceipt.actionId}</Descriptions.Item>
            <Descriptions.Item label="事件 / 动作">{actionReceipt.incidentId} · {actionLabel[actionReceipt.action]}</Descriptions.Item>
            <Descriptions.Item label="处置原因">{actionReasonLabel[actionReceipt.reasonCode]}</Descriptions.Item>
            <Descriptions.Item label="负责人">{actionReceipt.ownerName ?? '未变更'}</Descriptions.Item>
            <Descriptions.Item label="提交说明">{actionReceipt.note}</Descriptions.Item>
            <Descriptions.Item label="下一步">{actionReceipt.nextStep}</Descriptions.Item>
          </Descriptions>
        </Result> : <PermissionGate permission="FR5.INCIDENT.UPDATE" fallback={<Alert type="warning" showIcon title="当前账号不能提交处置动作" description="需要 FR5.INCIDENT.UPDATE 权限；当前页面仍可只读查看事件事实和时间线。" />}>
          <Card size="small" title="提交处置意图" style={{ marginTop: 16 }}>
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Select aria-label="处置动作" value={actionType} onChange={(value: IncidentActionInput['action']) => { setActionType(value); setActionNote(''); setActionOwner(''); actionMutation.reset(); }} options={Object.entries(actionLabel).map(([value, label]) => ({ value, label }))} style={{ width: '100%' }} />
              {actionType === 'ASSIGN' ? <Input aria-label="负责人" value={actionOwner} onChange={(event) => setActionOwner(event.target.value)} placeholder="填写接收处置的负责人或团队" maxLength={60} /> : null}
              <Input.TextArea aria-label="处置说明" value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder={actionType === 'RESOLVE' ? '说明恢复验证方式、关联证据和观察窗口' : '说明影响确认、责任转派或下一步动作'} maxLength={500} showCount rows={3} />
              <Typography.Text type="secondary">系统将按“{actionReasonLabel[actionReasonByType[actionType]]}”记录操作原因；不会直接修改事件状态。</Typography.Text>
              {actionMutation.isError ? <Alert type="error" showIcon title="处置动作提交失败" description={incidentActionErrorMessage(actionMutation.error)} /> : null}
              <Button type="primary" onClick={() => actionMutation.mutate()} loading={actionMutation.isPending} disabled={selected.status === 'CLOSED' || (actionType === 'RESOLVE' && selected.status === 'RESOLVED')}>提交处置意图</Button>
            </Space>
          </Card>
        </PermissionGate>}
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>事件状态、负责人和恢复结论只能由监控、工单及证据回传系统写入；本页面提交的仅是带幂等键的处置意图和审计回执。</span></div>
      </> : null}
    </Drawer>
  </>;
}

function IncidentDetailView({ detail }: { detail: IncidentDetail }) {
  return <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
    <Card size="small" title="影响与处置边界">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="根因摘要">{detail.rootCause}</Descriptions.Item>
        <Descriptions.Item label="影响范围">{detail.impactScope}</Descriptions.Item>
        <Descriptions.Item label="响应时限">{detail.responseSla}</Descriptions.Item>
        <Descriptions.Item label="恢复证据">{detail.recoveryEvidence}</Descriptions.Item>
        <Descriptions.Item label="下一步">{detail.nextAction}</Descriptions.Item>
        <Descriptions.Item label="关联证据">{detail.relatedEvidenceIds.length ? detail.relatedEvidenceIds.join('、') : '无'}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card size="small" title="事件时间线">
      <Timeline items={detail.timeline.map((entry) => ({ color: ['RESOLVED', 'CLOSED'].includes(entry.status) ? 'green' : entry.status === 'OPEN' ? 'red' : 'blue', children: <IncidentTimelineEntryView entry={entry} /> }))} />
    </Card>
  </Space>;
}

function IncidentTimelineEntryView({ entry }: { entry: IncidentTimelineEntry }) {
  return <div className="configuration-cell"><Typography.Text strong>{entry.action} · {entry.actor}</Typography.Text><span>{entry.time}</span><small>{entry.detail}</small></div>;
}
