import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Result, Select, Space, Table, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { ReleaseExecutionInput, ReleaseExecutionReceipt, ReleaseNodeSummary, ReleasePlanDetail, ReleasePlanSummary } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const strategyLabel: Readonly<Record<string, string>> = { CANARY: '灰度发布', FULL: '全量发布' };
const executionReasonLabel: Readonly<Record<ReleaseExecutionInput['reasonCode'], string>> = { INITIAL_RELEASE: '首次发布', RETRY_AFTER_FIX: '修复后重试', ROLLBACK_AFTER_FAILURE: '失败后回退' };
const executionErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少服务发布执行权限，请切换到测试发布员或联系管理员。',
  IDEMPOTENCY_KEY_REQUIRED: '请求流水号缺失，请重新打开发布计划后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '请求流水号已被其他执行申请占用，请重新打开发布计划后重试。',
  RELEASE_PLAN_NOT_FOUND: '发布计划不存在或已不在当前授权范围内。',
  RELEASE_EXECUTION_INPUT_INVALID: '执行原因无效，请重新选择发布计划。',
  RELEASE_ENTRY_GATE_BLOCKED: '联合测试尚未通过，不能启动发布执行。',
  RELEASE_OBJECT_STATE_INVALID: '当前发布计划状态不允许执行，请先核对变更窗口。',
};

function executionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return executionErrorLabel[code] ?? '发布启动失败，请稍后重试；如果问题持续，请联系发布负责人。';
}

export function ReleasePage() {
  const { actor, authorize } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<ReleasePlanSummary | null>(null);
  const [executionReceipt, setExecutionReceipt] = useState<ReleaseExecutionReceipt | null>(null);
  const executionSequence = useRef(1);
  const executionIdempotencyKey = useRef('RELEASE-EXEC-' + actor.actorId + '-' + actor.environment + '-01');
  useEffect(() => {
    executionIdempotencyKey.current = 'RELEASE-EXEC-' + actor.actorId + '-' + actor.environment + '-' + String(executionSequence.current).padStart(2, '0');
  }, [actor.actorId, actor.environment]);
  const query = useQuery({ queryKey: ['release-plans', appliedKeyword], queryFn: () => subscriptionGateway.listReleasePlans(appliedKeyword) });
  const detailQuery = useQuery({ queryKey: ['release-plan-detail', selected?.releasePlanId], queryFn: () => subscriptionGateway.getReleasePlan(selected?.releasePlanId ?? ''), enabled: Boolean(selected) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) => (environment === 'ALL' || item.environment === environment) && (status === 'ALL' || item.status === status));
  const readyCount = allItems.filter((item) => item.status === 'READY').length;
  const executingCount = allItems.filter((item) => item.status === 'EXECUTING').length;
  const blockedCount = allItems.filter((item) => item.status === 'BLOCKED' || item.status === 'FAILED').length;
  const canExecute = authorize({ permission: 'FR4.RELEASE.EXECUTE' }).allowed;
  const executionMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('RELEASE_PLAN_NOT_FOUND');
      const reasonCode: ReleaseExecutionInput['reasonCode'] = selected.status === 'FAILED' ? 'RETRY_AFTER_FIX' : 'INITIAL_RELEASE';
      return subscriptionGateway.requestReleaseExecution({ releasePlanId: selected.releasePlanId, reasonCode }, executionIdempotencyKey.current);
    },
    onSuccess: (receipt) => setExecutionReceipt(receipt),
  });

  function openRelease(record: ReleasePlanSummary) {
    setSelected(record);
    setExecutionReceipt(null);
    executionMutation.reset();
    executionSequence.current += 1;
    executionIdempotencyKey.current = 'RELEASE-EXEC-' + actor.actorId + '-' + record.environment + '-' + String(executionSequence.current).padStart(2, '0');
  }

  return <>
    <PageHeader eyebrow="测试与发布" title="服务发布" description="根据联合测试结果管理发布计划，跟踪各节点的执行状态；启动发布前必须满足测试、变更窗口和回退门禁。" badges={canExecute ? ['数据状态 · 以服务端为准', '发布执行权限 · 已授权'] : ['数据状态 · 以服务端为准']} />

    <div className="configuration-overview" aria-label="服务发布概览">
      <div><span>发布计划</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>待排期</span><strong>{query.isPending ? '—' : readyCount}</strong><small>项</small></div>
      <div><span>执行中</span><strong>{query.isPending ? '—' : executingCount}</strong><small>项</small></div>
      <div><span>异常计划</span><strong>{query.isPending ? '—' : blockedCount}</strong><small>项</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>发布计划只记录平台侧执行状态；发布成功后仍需核验接收、展示和车辆端实际使用证据。</span></div>

    <Card className="configuration-list-card" title={<Space size={8}><span>发布计划</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="计划编号 / 测试任务 / 配置 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="发布状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, { value: 'DRAFT', label: '草稿' }, { value: 'READY', label: '待排期' }, { value: 'SCHEDULED', label: '已排期' }, { value: 'EXECUTING', label: '执行中' }, { value: 'SUCCEEDED', label: '已完成' }, { value: 'FAILED', label: '失败' }, { value: 'BLOCKED', label: '存在阻断' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的发布计划" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<ReleasePlanSummary> rowKey="releasePlanId" dataSource={items} pagination={false} scroll={{ x: 1140 }} columns={[
          { title: '发布计划', width: 195, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.releasePlanId}</Typography.Text><span>{record.serviceName}</span><small>{environmentLabel[record.environment]}环境 · {strategyLabel[record.strategy]}</small></div> },
          { title: '测试 / 配置', width: 220, render: (_, record) => <div className="configuration-cell"><Link to={`/fr4/qualifications?qualificationId=${record.qualificationId}`}>{record.qualificationId}</Link><span>{record.configurationId}</span><small>{record.instanceId}</small></div> },
          { title: '节点进度', width: 135, render: (_, record) => <div className="configuration-cell"><span>{record.completedNodeCount} / {record.nodeCount} 个节点</span><small>{record.targetTime}</small></div> },
          { title: '发布状态', width: 125, render: (_, record) => <div className="configuration-status-cell"><StatusTag value={record.status} /><small>{record.status === 'BLOCKED' ? '配置或测试未满足' : statusLabel(record.status)}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="configuration-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 180, fixed: 'right', render: (_, record) => <Space size={0}><Button type="link" onClick={() => openRelease(record)}>查看计划</Button><PermissionGate permission="FR4.RELEASE.EXECUTE" fallback={<Button type="link" disabled>查看并启动</Button>}><Button type="link" onClick={() => openRelease(record)}>查看并启动</Button></PermissionGate></Space> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.releasePlanId}>
          <div className="mobile-configuration-head"><div><strong>{record.releasePlanId}</strong><span>{record.serviceName}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-configuration-meta">{record.qualificationId} · {record.configurationId}</div>
          <div className="mobile-configuration-meta">{environmentLabel[record.environment]}环境 · {strategyLabel[record.strategy]} · {record.instanceId}</div>
          <div className="mobile-configuration-status">{record.completedNodeCount} / {record.nodeCount} 个节点 · {record.targetTime}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName} · {record.updatedAt}</span><Space size={0}><Button type="link" onClick={() => openRelease(record)}>查看计划</Button><PermissionGate permission="FR4.RELEASE.EXECUTE" fallback={<Button type="link" disabled>查看并启动</Button>}><Button type="link" onClick={() => openRelease(record)}>查看并启动</Button></PermissionGate></Space></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `发布计划 · ${selected.releasePlanId}` : '发布计划'} open={Boolean(selected)} onClose={() => setSelected(null)} width={760}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.status} /><Typography.Text type="secondary">{strategyLabel[selected.strategy]} · {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="来源测试"><Link to={`/fr4/qualifications?qualificationId=${selected.qualificationId}`} onClick={() => setSelected(null)}>{selected.qualificationId}</Link></Descriptions.Item>
          <Descriptions.Item label="目标配置">{selected.configurationId}</Descriptions.Item>
          <Descriptions.Item label="目标实例">{selected.instanceId}</Descriptions.Item>
          <Descriptions.Item label="服务名称">{selected.serviceName}</Descriptions.Item>
          <Descriptions.Item label="发布环境">{environmentLabel[selected.environment]}环境</Descriptions.Item>
          <Descriptions.Item label="发布策略">{strategyLabel[selected.strategy]}</Descriptions.Item>
          <Descriptions.Item label="目标时间">{selected.targetTime}</Descriptions.Item>
          <Descriptions.Item label="节点进度">{selected.completedNodeCount} / {selected.nodeCount} 个节点</Descriptions.Item>
          <Descriptions.Item label="负责人">{selected.ownerName}</Descriptions.Item>
        </Descriptions>
        {executionReceipt ? <Result status="info" title="发布执行已进入排队" subTitle="发布服务已接收执行意图，排队回执不代表节点已完成或车辆端已生效。" extra={<Button onClick={() => setExecutionReceipt(null)}>返回发布计划</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="执行编号">{executionReceipt.executionId}</Descriptions.Item><Descriptions.Item label="执行原因">{executionReasonLabel[executionReceipt.reasonCode]}</Descriptions.Item><Descriptions.Item label="发布版本">{executionReceipt.releaseVersion}</Descriptions.Item><Descriptions.Item label="发布策略">{strategyLabel[executionReceipt.strategy]}</Descriptions.Item><Descriptions.Item label="提交时间">{executionReceipt.submittedAt}</Descriptions.Item><Descriptions.Item label="下一步">{executionReceipt.nextStep}</Descriptions.Item></Descriptions></Result> : null}
        {executionMutation.isError ? <Alert type="error" showIcon title="发布启动失败" description={executionErrorMessage(executionMutation.error)} className="section-gap-bottom" /> : null}
        {!executionReceipt && <PermissionGate permission="FR4.RELEASE.EXECUTE" fallback={<Alert type="warning" showIcon title="当前账号不能启动发布" description="需要 FR4.RELEASE.EXECUTE 权限；发布计划仍可只读查看。" />}><Button type="primary" onClick={() => executionMutation.mutate()} loading={executionMutation.isPending} disabled={!['READY', 'SCHEDULED', 'FAILED'].includes(selected.status)}>启动发布</Button></PermissionGate>}
        {detailQuery.isPending ? <Typography.Paragraph type="secondary">发布节点加载中…</Typography.Paragraph> : detailQuery.isError ? <Alert type="error" showIcon title="发布详情加载失败" description="请稍后重试；当前计划摘要仍然可用。" /> : detailQuery.data ? <ReleaseNodeDetail detail={detailQuery.data} /> : null}
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>{selected.status === 'BLOCKED' || selected.status === 'FAILED' ? '当前计划存在异常，不允许直接重试或视为发布成功。' : '发布执行请求将进入发布服务排队；节点状态、回执和车端证据以接入系统回传为准。'}</span></div>
      </> : null}
    </Drawer>
  </>;
}

function ReleaseNodeDetail({ detail }: { detail: ReleasePlanDetail }) {
  const succeededCount = detail.nodes.filter((item) => item.status === 'SUCCEEDED').length;
  const blockedCount = detail.nodes.filter((item) => ['BLOCKED', 'FAILED', 'ROLLBACK_REQUIRED'].includes(item.status)).length;
  return <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
    <Card size="small" title="发布门禁与策略">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="发布版本">{detail.releaseVersion}</Descriptions.Item>
        <Descriptions.Item label="进入门禁">{detail.entryGate}</Descriptions.Item>
        <Descriptions.Item label="变更窗口">{detail.changeWindow}</Descriptions.Item>
        <Descriptions.Item label="前置条件">{detail.prerequisiteSummary}</Descriptions.Item>
        <Descriptions.Item label="回退计划">{detail.rollbackPlan}</Descriptions.Item>
        <Descriptions.Item label="节点概览">{succeededCount} 个已完成{blockedCount ? ` · ${blockedCount} 个需关注` : ''}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card size="small" title={<Space size={8}><span>发布节点</span><span className="list-count">{detail.nodes.length}</span></Space>}>
      <Table<ReleaseNodeSummary> rowKey="nodeId" size="small" pagination={false} dataSource={detail.nodes} scroll={{ x: 760 }} columns={[
        { title: '节点', width: 180, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.nodeName}</Typography.Text><small>{record.nodeId} · {record.targetScope}</small></div> },
        { title: '状态', width: 115, render: (_, record) => <StatusTag value={record.status} /> },
        { title: '回执', width: 220, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.receiptSummary}</Typography.Text><small>{record.observedAt}</small></div> },
        { title: '阻断原因', width: 260, dataIndex: 'blockerReason' },
      ]} />
    </Card>
  </Space>;
}
