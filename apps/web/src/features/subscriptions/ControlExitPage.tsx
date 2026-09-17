import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Input, Radio, Result, Select, Space, Steps, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { ControlPlanInput, ControlPlanReceipt, DeliveryEvidenceSummary, IncidentSummary, SubscriptionDetail } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

type ControlAction = 'PAUSE' | 'RESUME' | 'TERMINATE';

interface ControlData {
  detail: SubscriptionDetail;
  evidence: readonly DeliveryEvidenceSummary[];
  incidents: readonly IncidentSummary[];
}

const actionLabel: Readonly<Record<ControlAction, string>> = { PAUSE: '暂停订阅', RESUME: '恢复订阅', TERMINATE: '终止订阅' };
const controlStatusLabel: Readonly<Record<string, string>> = { ENABLED: '正常', PAUSE_REQUESTED: '暂停处理中', PAUSED: '已暂停', RESUME_REQUESTED: '恢复处理中', STOP_REQUESTED: '终止处理中', STOPPED: '已终止' };
const controlReasonLabel: Readonly<Record<ControlPlanInput['reasonCode'], string>> = { RUNTIME_RISK: '运行风险', OEM_REQUEST: '车企申请', SERVICE_RETIREMENT: '服务退出' };
const controlErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少控制计划权限，请联系订阅负责人或切换到已授权身份。',
  IDEMPOTENCY_KEY_REQUIRED: '控制流水号缺失，请重新打开控制页面后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '控制流水号已被其他计划占用，请重新打开页面后重试。',
  CONTROL_PLAN_INPUT_INVALID: '控制范围、基线版本、原因或说明不完整。',
  CONTROL_PLAN_STATE_INVALID: '当前实例状态不允许执行该控制动作，请刷新后重试。',
};

function controlErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return controlErrorLabel[code] ?? '控制计划提交失败，请稍后重试；如果问题持续，请联系订阅负责人。';
}

export function ControlExitPage() {
  const { subscriptionId = '' } = useParams();
  const { actor, authorize } = useAuth();
  const [action, setAction] = useState<ControlAction>('PAUSE');
  const [targetInstanceId, setTargetInstanceId] = useState('ALL');
  const [reason, setReason] = useState('');
  const [controlReceipt, setControlReceipt] = useState<ControlPlanReceipt | null>(null);
  const controlSequence = useRef(1);
  const controlIdempotencyKey = useRef('CTRL-PLAN-' + actor.actorId + '-' + actor.environment + '-01');
  useEffect(() => {
    controlIdempotencyKey.current = 'CTRL-PLAN-' + actor.actorId + '-' + actor.environment + '-01';
  }, [actor.actorId, actor.environment]);
  const query = useQuery<ControlData>({
    queryKey: ['subscription-control', subscriptionId],
    enabled: Boolean(subscriptionId),
    queryFn: async () => {
      const [detail, evidence, incidents] = await Promise.all([
        subscriptionGateway.getSubscription(subscriptionId),
        subscriptionGateway.listEvidence(),
        subscriptionGateway.listIncidents(),
      ]);
      return {
        detail,
        evidence: evidence.items.filter((item) => item.subscriptionId === subscriptionId),
        incidents: incidents.items.filter((item) => item.subscriptionId === subscriptionId),
      };
    },
  });
  const data = query.data;
  const targetInstances = data?.detail.instances.filter((item) => targetInstanceId === 'ALL' || item.instanceId === targetInstanceId) ?? [];
  const openIncidentCount = data?.incidents.filter((item) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(item.status)).length ?? 0;
  const unknownEvidenceCount = data?.evidence.filter((item) => [item.receiveGrade, item.displayGrade, item.interactionGrade].includes('UNKNOWN')).length ?? 0;
  const plan = useMemo(() => {
    if (!data || !targetInstances.length) return { status: 'BLOCKED' as const, blockers: ['请选择有效的目标实例'], nextStage: '补充控制范围' };
    const lifecycle = targetInstances.some((item) => ['EXPIRED', 'REVOKED', 'TERMINATED'].includes(item.lifecycle));
    if (action === 'PAUSE' && targetInstances.some((item) => item.controlStatus !== 'ENABLED')) return { status: 'BLOCKED' as const, blockers: ['目标实例存在未完成的控制请求或已不处于可暂停状态'], nextStage: '先核对当前控制状态' };
    if (action === 'RESUME' && targetInstances.some((item) => item.controlStatus !== 'PAUSED')) return { status: 'BLOCKED' as const, blockers: ['只有已暂停实例才能创建恢复计划'], nextStage: '核对暂停回执' };
    if (action === 'TERMINATE' && lifecycle) return { status: 'BLOCKED' as const, blockers: ['目标实例已过期、撤销或终止，无需重复创建终止计划'], nextStage: '查看现有退出记录' };
    if (action === 'TERMINATE') return { status: 'HAS_UNKNOWN' as const, blockers: ['终止前仍需核对未完成投递、接收和退出证据'], nextStage: '完成退出清单并进行独立核验' };
    if (openIncidentCount > 0 || unknownEvidenceCount > 0) return { status: 'HAS_UNKNOWN' as const, blockers: ['存在待处理事件或未知证据，控制影响需要服务端进一步评估'], nextStage: '补齐运行事实后再核验' };
    return { status: 'EXECUTABLE' as const, blockers: [], nextStage: '进入控制计划核验' };
  }, [action, data, openIncidentCount, targetInstances, unknownEvidenceCount]);
  const exitItems = [
    { label: '停止新增投递', status: 'PENDING_VERIFY', detail: '需要平台投递服务回执' },
    { label: '关闭进行中会话', status: unknownEvidenceCount ? 'UNKNOWN' : 'PENDING_VERIFY', detail: '需要运行会话服务回执' },
    { label: '完成OEM侧下线确认', status: 'UNKNOWN', detail: '需要车企云或车端适配方确认' },
    { label: '归档最终交付证据', status: 'PENDING_VERIFY', detail: '需要形成退出前后的证据链' },
  ];
  const loading = query.isPending;
  const state = loading ? 'loading' : query.isError ? query.error instanceof Error && query.error.message === 'SUBSCRIPTION_NOT_FOUND' ? 'empty' : 'error' : data ? 'ready' : 'empty';
  const canCreatePlan = authorize({ permission: 'FR2.CONTROL.PLAN' }).allowed;
  const controlRequestsQuery = useQuery({ queryKey: ['control-plan-requests'], queryFn: () => subscriptionGateway.listControlPlanRequests(), enabled: canCreatePlan });
  const controlMutation = useMutation({
    mutationFn: async () => {
      if (!data || !targetInstances.length || reason.trim().length < 10) throw new Error('CONTROL_PLAN_INPUT_INVALID');
      return subscriptionGateway.requestControlPlan({
        subscriptionId: data.detail.summary.subscriptionId,
        baseRevision: data.detail.summary.currentRevision,
        action,
        instanceIds: targetInstances.map((item) => item.instanceId),
        reasonCode: action === 'PAUSE' ? 'RUNTIME_RISK' : action === 'RESUME' ? 'OEM_REQUEST' : 'SERVICE_RETIREMENT',
        justification: reason,
      }, controlIdempotencyKey.current);
    },
    onSuccess: (receipt) => {
      setControlReceipt(receipt);
      void controlRequestsQuery.refetch();
    },
  });

  function resetControlDraft() {
    setControlReceipt(null);
    setReason('');
    controlMutation.reset();
    controlSequence.current += 1;
    controlIdempotencyKey.current = 'CTRL-PLAN-' + actor.actorId + '-' + (data?.detail.summary.environment ?? actor.environment) + '-' + String(controlSequence.current).padStart(2, '0');
  }

  return <>
    <PageHeader eyebrow="订阅运营" title="控制与退出" description="准备暂停、恢复或终止订阅的高风险控制意图，核对范围、职责和退出证据要求。" badges={canCreatePlan ? ['数据状态 · 以服务端为准', '控制计划权限 · 已授权'] : ['数据状态 · 以服务端为准']} actions={<Link className="ant-btn ant-btn-default" to={`/fr2/subscriptions/${subscriptionId}`}><ArrowLeftOutlined /> 返回订阅详情</Link>} />
    <StateBoundary state={state} emptyTitle="未找到该订阅" onRetry={() => void query.refetch()}>
      {data ? <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="data-notice detail-notice"><InfoCircleOutlined /><span>控制动作属于高风险操作；提交后仅生成待独立核验的控制计划，不会直接暂停、恢复或终止真实订阅。</span></div>

        <Card title="1. 控制意图">
          <Radio.Group value={action} onChange={(event) => setAction(event.target.value)} optionType="button" buttonStyle="solid" options={Object.entries(actionLabel).map(([value, label]) => ({ value, label }))} />
          <div className="control-plan-form">
            <label><span>控制范围</span><Select value={targetInstanceId} onChange={setTargetInstanceId} options={[{ value: 'ALL', label: `全部实例（${data.detail.instances.length}个）` }, ...data.detail.instances.map((item) => ({ value: item.instanceId, label: `${item.instanceId} · ${item.coverageSummary}` }))]} /></label>
            <label><span>控制原因</span><Input.TextArea rows={3} maxLength={300} showCount value={reason} onChange={(event) => setReason(event.target.value)} placeholder="填写触发控制的事实依据；真实提交时为必填" /></label>
          </div>
        </Card>

        <Card className="subscription-detail-card" title="当前状态基线" extra={<Typography.Text type="secondary">控制状态以实例为准</Typography.Text>}>
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
            <Descriptions.Item label="订阅编号">{data.detail.summary.subscriptionId}</Descriptions.Item>
            <Descriptions.Item label="订阅生命周期"><StatusTag value={data.detail.summary.lifecycle} /></Descriptions.Item>
            <Descriptions.Item label="控制范围">{targetInstances.length} 个实例</Descriptions.Item>
            <Descriptions.Item label="待处理事件">{openIncidentCount} 条</Descriptions.Item>
            {targetInstances.slice(0, 4).map((item) => <Descriptions.Item key={item.instanceId} label={item.instanceId}>{controlStatusLabel[item.controlStatus] ?? item.controlStatus}</Descriptions.Item>)}
          </Descriptions>
        </Card>

        <div className="configuration-overview" aria-label="控制计划概览">
          <div><span>控制动作</span><strong>{actionLabel[action]}</strong><small>意图</small></div>
          <div><span>目标实例</span><strong>{targetInstances.length}</strong><small>个</small></div>
          <div><span>计划评估</span><strong><StatusTag value={plan.status} /></strong><small>状态</small></div>
          <div><span>下一阶段</span><strong className="change-overview-next">{plan.nextStage}</strong><small>建议</small></div>
        </div>

        <Card title="2. 控制门禁">
          <div className="change-check-list">
            <div className="change-check"><StatusTag value="SATISFIED" /><div><strong>控制计划权限</strong><span>当前页面已通过 FR2.CONTROL.PLAN 查看权限；真实执行仍需服务端再次鉴权。</span></div></div>
            <div className="change-check"><StatusTag value={targetInstances.length ? 'SATISFIED' : 'BLOCKED'} /><div><strong>对象范围</strong><span>{targetInstances.length ? `已选择 ${targetInstances.length} 个原子实例，范围不会自动扩大` : '没有可用的目标实例'}</span></div></div>
            <div className="change-check"><StatusTag value={plan.status} /><div><strong>控制状态与运行事实</strong><span>{plan.blockers.length ? plan.blockers.join('；') : '当前输入满足基础控制计划条件'}</span></div></div>
            <div className="change-check"><StatusTag value="UNKNOWN" /><div><strong>职责分离与二次确认</strong><span>暂停、恢复、终止均需要服务端校验职责分离、操作原因、ETag和幂等键。</span></div></div>
          </div>
        </Card>

        {action === 'TERMINATE' ? <Card title="3. 退出清单" extra={<Typography.Text type="secondary">完成后才能判断退出闭环</Typography.Text>}>
          <div className="change-check-list">{exitItems.map((item) => <div className="change-check" key={item.label}><StatusTag value={item.status} /><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}</div>
        </Card> : null}

        <Card title={action === 'TERMINATE' ? '4. 办理路径' : '3. 办理路径'}>
          <Steps current={0} items={[{ title: '控制预览', description: '核对动作、范围和原因' }, { title: '独立核验', description: '校验权限、职责和对象状态' }, { title: '执行计划', description: '由控制服务执行并回传' }, { title: '结果核验', description: '确认控制回执和交付影响' }]} />
          <Alert className="section-gap-top" type={plan.status === 'BLOCKED' ? 'error' : 'info'} showIcon title={plan.status === 'BLOCKED' ? '当前控制意图存在阻断' : '提交后进入独立核验'} description={`${plan.nextStage}。${action === 'TERMINATE' ? '终止不等于退出清单已完成。' : '控制计划回执也不等于实例已经完成状态切换。'}`} />
          {controlReceipt ? <Result status="info" title="控制计划已进入待核验" subTitle="平台已记录控制意图；审批和控制服务回执完成前，不会改变订阅或实例状态。" extra={<Button onClick={resetControlDraft}>继续准备控制计划</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="计划编号">{controlReceipt.planId}</Descriptions.Item><Descriptions.Item label="订阅 / 基线">{controlReceipt.subscriptionId} · V{controlReceipt.baseRevision}</Descriptions.Item><Descriptions.Item label="控制动作">{actionLabel[controlReceipt.action]}</Descriptions.Item><Descriptions.Item label="目标实例">{controlReceipt.instanceIds.join('、')}</Descriptions.Item><Descriptions.Item label="控制原因">{controlReasonLabel[controlReceipt.reasonCode]}</Descriptions.Item><Descriptions.Item label="下一步">{controlReceipt.nextStep}</Descriptions.Item></Descriptions></Result> : <>
            {controlMutation.isError ? <Alert className="section-gap-top" type="error" showIcon title="控制计划提交失败" description={controlErrorMessage(controlMutation.error)} /> : null}
            <PermissionGate permission="FR2.CONTROL.PLAN" fallback={<Button type="primary" danger={action === 'TERMINATE'} disabled>创建控制计划</Button>}><Tooltip title={plan.status === 'BLOCKED' ? '当前控制门禁存在阻断' : reason.trim().length < 10 ? '请先填写不少于10个字的控制依据' : ''}><Button type="primary" danger={action === 'TERMINATE'} onClick={() => controlMutation.mutate()} loading={controlMutation.isPending} disabled={plan.status === 'BLOCKED' || reason.trim().length < 10}>创建控制计划</Button></Tooltip></PermissionGate>
          </>}
          <Link className="ant-btn ant-btn-default" to={`/fr2/subscriptions/${subscriptionId}/diagnosis`}>查看运行诊断</Link>
        </Card>
        <PermissionGate permission="FR2.CONTROL.PLAN" fallback={null}>
          <Card
            title={<Space size={8}><span>控制计划记录</span><span className="list-count">{controlRequestsQuery.data?.items.filter((item) => item.subscriptionId === subscriptionId).length ?? 0}</span></Space>}
            extra={<Typography.Text type="secondary">当前订阅的控制计划</Typography.Text>}
          >
            <StateBoundary
              state={controlRequestsQuery.isPending ? 'loading' : controlRequestsQuery.isError ? 'error' : controlRequestsQuery.data?.items.filter((item) => item.subscriptionId === subscriptionId).length ? 'ready' : 'empty'}
              emptyTitle="暂没有该订阅的控制计划"
              onRetry={() => void controlRequestsQuery.refetch()}
            >
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {(controlRequestsQuery.data?.items ?? [])
                  .filter((item) => item.subscriptionId === subscriptionId)
                  .map((item) => (
                    <Card size="small" key={item.planId}>
                      <Space orientation="vertical" size={2}>
                        <Typography.Text strong>{item.planId} · {actionLabel[item.action]}</Typography.Text>
                        <Typography.Text type="secondary">{item.instanceIds.length} 个实例 · {controlReasonLabel[item.reasonCode]} · 待核验</Typography.Text>
                        <Typography.Text type="secondary">提交于 {item.submittedAt}</Typography.Text>
                      </Space>
                    </Card>
                  ))}
              </Space>
            </StateBoundary>
          </Card>
        </PermissionGate>
      </Space> : null}
    </StateBoundary>
  </>;
}
