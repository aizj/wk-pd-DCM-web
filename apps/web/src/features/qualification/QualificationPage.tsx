import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Input, Result, Select, Space, Table, Typography } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import type { QualificationCaseSummary, QualificationDetail, QualificationExecutionInput, QualificationExecutionReceipt, QualificationSummary } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { statusLabel } from '../../core/status/status-registry';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };
const executionReasonLabel: Readonly<Record<QualificationExecutionInput['reasonCode'], string>> = { INITIAL_RUN: '首次执行', RERUN_AFTER_CORRECTION: '补正后重跑', RERUN_AFTER_DEPENDENCY_RECOVERY: '依赖恢复后重跑' };
const executionErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少联合测试执行权限，请切换到测试发布员或联系管理员。',
  IDEMPOTENCY_KEY_REQUIRED: '请求流水号缺失，请重新打开测试任务后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '请求流水号已被其他执行申请占用，请重新打开测试任务后重试。',
  QUALIFICATION_NOT_FOUND: '测试任务不存在或已不在当前授权范围内。',
  QUALIFICATION_EXECUTION_INPUT_INVALID: '执行原因无效，请重新选择测试任务。',
  QUALIFICATION_ENTRY_GATE_BLOCKED: '当前测试任务未通过进入门禁，不能启动联合测试。',
};

function executionErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return executionErrorLabel[code] ?? '联合测试启动失败，请稍后重试；如果问题持续，请联系测试负责人。';
}

export function QualificationPage() {
  const { actor, authorize } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQualificationId = searchParams.get('qualificationId') ?? '';
  const [keyword, setKeyword] = useState(initialQualificationId);
  const [appliedKeyword, setAppliedKeyword] = useState(initialQualificationId);
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<QualificationSummary | null>(null);
  const [executionReceipt, setExecutionReceipt] = useState<QualificationExecutionReceipt | null>(null);
  const executionSequence = useRef(1);
  const executionIdempotencyKey = useRef('QUAL-EXEC-' + actor.actorId + '-' + actor.environment + '-01');
  useEffect(() => {
    executionIdempotencyKey.current = 'QUAL-EXEC-' + actor.actorId + '-' + actor.environment + '-' + String(executionSequence.current).padStart(2, '0');
  }, [actor.actorId, actor.environment]);
  const query = useQuery({ queryKey: ['qualifications', appliedKeyword], queryFn: () => subscriptionGateway.listQualifications(appliedKeyword) });
  const detailQuery = useQuery({ queryKey: ['qualification-detail', selected?.qualificationId], queryFn: () => subscriptionGateway.getQualification(selected?.qualificationId ?? ''), enabled: Boolean(selected) });
  const allItems = query.data?.items ?? [];
  const items = allItems.filter((item) => (environment === 'ALL' || item.environment === environment) && (status === 'ALL' || item.status === status));
  const readyCount = allItems.filter((item) => item.status === 'READY').length;
  const blockedCount = allItems.filter((item) => item.status === 'BLOCKED').length;
  const passedCases = allItems.reduce((sum, item) => sum + item.passedCount, 0);
  const canExecute = authorize({ permission: 'FR4.QUALIFICATION.EXECUTE' }).allowed;
  const executionMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('QUALIFICATION_NOT_FOUND');
      return subscriptionGateway.requestQualificationExecution({ qualificationId: selected.qualificationId, reasonCode: selected.status === 'FAILED' ? 'RERUN_AFTER_CORRECTION' : 'INITIAL_RUN' }, executionIdempotencyKey.current);
    },
    onSuccess: (receipt) => setExecutionReceipt(receipt),
  });

  function openQualification(record: QualificationSummary) {
    setSelected(record);
    setExecutionReceipt(null);
    executionMutation.reset();
    executionSequence.current += 1;
    executionIdempotencyKey.current = 'QUAL-EXEC-' + actor.actorId + '-' + record.environment + '-' + String(executionSequence.current).padStart(2, '0');
  }

  return <>
    <PageHeader eyebrow="测试与发布" title="联合测试" description="验证配置版本与车企接入链路，形成可追溯的测试结果；启动测试前必须满足配置、测试配置和依赖门禁。" badges={canExecute ? ['数据状态 · 以服务端为准', '测试执行权限 · 已授权'] : ['数据状态 · 以服务端为准']} />

    <div className="configuration-overview" aria-label="联合测试概览">
      <div><span>测试任务</span><strong>{query.isPending ? '—' : allItems.length}</strong><small>项</small></div>
      <div><span>可开始</span><strong>{query.isPending ? '—' : readyCount}</strong><small>项</small></div>
      <div><span>已通过用例</span><strong>{query.isPending ? '—' : passedCases}</strong><small>项</small></div>
      <div><span>存在阻断</span><strong>{query.isPending ? '—' : blockedCount}</strong><small>项</small></div>
    </div>

    <div className="data-notice"><InfoCircleOutlined /><span>联合测试只验证当前配置和接入链路；测试通过后仍需生成发布计划，不能直接推断车辆端已生效。</span></div>

    <Card className="configuration-list-card" title={<Space size={8}><span>测试任务</span><span className="list-count">{items.length}</span></Space>} extra={<Typography.Text type="secondary">数据时间：{query.data?.dataTime ?? '加载中'}</Typography.Text>}>
      <div className="configuration-filter-row">
        <Input prefix={<SearchOutlined />} allowClear placeholder="任务编号 / 配置 / 订阅 / 服务" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={() => setAppliedKeyword(keyword)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, { value: 'SANDBOX', label: '沙盒环境' }, { value: 'TEST', label: '测试环境' }, { value: 'PRODUCTION', label: '生产环境' }]} />
        <Select aria-label="测试状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, { value: 'NOT_STARTED', label: '未开始' }, { value: 'READY', label: '可开始' }, { value: 'RUNNING', label: '测试中' }, { value: 'PASSED', label: '测试通过' }, { value: 'FAILED', label: '测试失败' }, { value: 'BLOCKED', label: '存在阻断' }]} />
        <Button type="primary" onClick={() => setAppliedKeyword(keyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setAppliedKeyword(''); setEnvironment('ALL'); setStatus('ALL'); void query.refetch(); }}>重置</Button>
      </div>
      <StateBoundary state={query.isPending ? 'loading' : query.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="没有符合条件的测试任务" onRetry={() => void query.refetch()}>
        <div className="desktop-configuration-table"><Table<QualificationSummary> rowKey="qualificationId" dataSource={items} pagination={false} scroll={{ x: 1080 }} columns={[
          { title: '测试任务', width: 190, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.qualificationId}</Typography.Text><span>{record.serviceName}</span><small>{record.testProfile}</small></div> },
          { title: '配置 / 实例', width: 220, render: (_, record) => <div className="configuration-cell"><Link to={`/fr3/configurations?configurationId=${record.configurationId}`}>{record.configurationId}</Link><span>{record.instanceId}</span><small>{environmentLabel[record.environment]}环境</small></div> },
          { title: '用例结果', width: 150, render: (_, record) => <div className="configuration-cell"><span>{record.passedCount} / {record.caseCount} 已通过</span><small>{record.failedCount ? `${record.failedCount} 项失败` : '暂无失败用例'}</small></div> },
          { title: '任务状态', width: 130, render: (_, record) => <div className="configuration-status-cell"><StatusTag value={record.status} /><small>{record.status === 'BLOCKED' ? '需先处理配置阻断' : statusLabel(record.status)}</small></div> },
          { title: '负责人 / 更新', width: 145, render: (_, record) => <div className="configuration-cell"><span>{record.ownerName}</span><small>{record.updatedAt}</small></div> },
          { title: '操作', width: 180, fixed: 'right', render: (_, record) => <Space size={0}><Button type="link" onClick={() => openQualification(record)}>查看测试项</Button><PermissionGate permission="FR4.QUALIFICATION.EXECUTE" fallback={<Button type="link" disabled>查看并启动</Button>}><Button type="link" onClick={() => openQualification(record)}>查看并启动</Button></PermissionGate></Space> },
        ]} /></div>
        <div className="mobile-configuration-list">{items.map((record) => <div className="mobile-configuration-card" key={record.qualificationId}>
          <div className="mobile-configuration-head"><div><strong>{record.qualificationId}</strong><span>{record.serviceName}</span></div><StatusTag value={record.status} /></div>
          <div className="mobile-configuration-meta">{record.configurationId} · {record.instanceId}</div>
          <div className="mobile-configuration-meta">{environmentLabel[record.environment]}环境 · {record.testProfile}</div>
          <div className="mobile-configuration-status">{record.passedCount} / {record.caseCount} 已通过{record.failedCount ? ` · ${record.failedCount} 项失败` : ''}</div>
          <div className="mobile-configuration-footer"><span>{record.ownerName} · {record.updatedAt}</span><Space size={0}><Button type="link" onClick={() => openQualification(record)}>查看测试项</Button><PermissionGate permission="FR4.QUALIFICATION.EXECUTE" fallback={<Button type="link" disabled>查看并启动</Button>}><Button type="link" onClick={() => openQualification(record)}>查看并启动</Button></PermissionGate></Space></div>
        </div>)}</div>
      </StateBoundary>
    </Card>

    <Drawer title={selected ? `测试任务 · ${selected.qualificationId}` : '测试任务'} open={Boolean(selected)} onClose={() => setSelected(null)} width={760}>
      {selected ? <>
        <div className="drawer-status-line"><StatusTag value={selected.status} /><Typography.Text type="secondary">{selected.testProfile} · {selected.updatedAt}</Typography.Text></div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="所属配置"><Link to={`/fr3/configurations?configurationId=${selected.configurationId}`} onClick={() => setSelected(null)}>{selected.configurationId}</Link></Descriptions.Item>
          <Descriptions.Item label="目标实例">{selected.instanceId}</Descriptions.Item>
          <Descriptions.Item label="服务名称">{selected.serviceName}</Descriptions.Item>
          <Descriptions.Item label="测试环境">{environmentLabel[selected.environment]}环境</Descriptions.Item>
          <Descriptions.Item label="测试配置">{selected.testProfile}</Descriptions.Item>
          <Descriptions.Item label="用例进度">{selected.passedCount} / {selected.caseCount} 已通过</Descriptions.Item>
          <Descriptions.Item label="失败用例">{selected.failedCount ? `${selected.failedCount} 项` : '无'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{selected.ownerName}</Descriptions.Item>
        </Descriptions>
        {executionReceipt ? <Result status="info" title="联合测试已进入排队" subTitle="测试服务已接收执行意图，排队回执不代表测试已通过或发布已完成。" extra={<Button onClick={() => setExecutionReceipt(null)}>返回测试任务</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="执行编号">{executionReceipt.executionId}</Descriptions.Item><Descriptions.Item label="执行原因">{executionReasonLabel[executionReceipt.reasonCode]}</Descriptions.Item><Descriptions.Item label="配置版本">{executionReceipt.configurationId}</Descriptions.Item><Descriptions.Item label="测试配置版本">{executionReceipt.profileVersion}</Descriptions.Item><Descriptions.Item label="提交时间">{executionReceipt.submittedAt}</Descriptions.Item><Descriptions.Item label="下一步">{executionReceipt.nextStep}</Descriptions.Item></Descriptions></Result> : null}
        {executionMutation.isError ? <Alert type="error" showIcon title="联合测试启动失败" description={executionErrorMessage(executionMutation.error)} className="section-gap-bottom" /> : null}
        {!executionReceipt && <PermissionGate permission="FR4.QUALIFICATION.EXECUTE" fallback={<Alert type="warning" showIcon title="当前账号不能启动联合测试" description="需要 FR4.QUALIFICATION.EXECUTE 权限；测试任务仍可只读查看。" />}><Button type="primary" onClick={() => executionMutation.mutate()} loading={executionMutation.isPending} disabled={selected.status !== 'READY'}>启动联合测试</Button></PermissionGate>}
        {detailQuery.isPending ? <Typography.Paragraph type="secondary">测试项加载中…</Typography.Paragraph> : detailQuery.isError ? <Alert type="error" showIcon title="测试项加载失败" description="请稍后重试；当前任务摘要仍然可用。" /> : detailQuery.data ? <QualificationCaseDetail detail={detailQuery.data} /> : null}
        <div className="data-notice configuration-drawer-notice"><InfoCircleOutlined /><span>{selected.status === 'BLOCKED' ? '当前任务不能开始，请先修复配置阻断项并重新生成测试任务。' : '测试启动请求将进入测试服务排队；任务状态和结果以测试服务回传为准。'}</span></div>
      </> : null}
    </Drawer>
  </>;
}

function QualificationCaseDetail({ detail }: { detail: QualificationDetail }) {
  const blockedCount = detail.testCases.filter((item) => item.status === 'BLOCKED').length;
  const failedCount = detail.testCases.filter((item) => item.status === 'FAILED').length;
  return <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 16 }}>
    <Card size="small" title="测试门禁与输入">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="测试配置版本">{detail.profileVersion}</Descriptions.Item>
        <Descriptions.Item label="进入门禁">{detail.entryGate}</Descriptions.Item>
        <Descriptions.Item label="输入快照"><Typography.Text copyable>{detail.inputSnapshot}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="执行方">{detail.executor}</Descriptions.Item>
        <Descriptions.Item label="当前阻断">{blockedCount ? `${blockedCount} 项` : '无'}{failedCount ? ` · ${failedCount} 项失败` : ''}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card size="small" title={<Space size={8}><span>测试项</span><span className="list-count">{detail.testCases.length}</span></Space>}>
      <Table<QualificationCaseSummary> rowKey="caseId" size="small" pagination={false} dataSource={detail.testCases} scroll={{ x: 820 }} columns={[
        { title: '测试项', width: 180, render: (_, record) => <div className="configuration-cell"><Typography.Text strong>{record.caseName}</Typography.Text><small>{record.caseId} · {record.category}</small></div> },
        { title: '要求', width: 240, dataIndex: 'requirement' },
        { title: '结果 / 状态', width: 150, render: (_, record) => <div className="configuration-status-cell"><Space size={4} wrap><StatusTag value={record.status} /><StatusTag value={record.evidenceGrade} /></Space><small>{record.resultSummary}</small></div> },
        { title: '阻断原因 / 观测', width: 260, render: (_, record) => <div className="configuration-cell"><Typography.Text>{record.blockerReason}</Typography.Text><small>{record.lastObservedAt}</small></div> },
      ]} />
    </Card>
  </Space>;
}
