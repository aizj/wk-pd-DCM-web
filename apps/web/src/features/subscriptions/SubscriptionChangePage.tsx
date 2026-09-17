import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Input, Radio, Result, Space, Steps, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import type { EntitlementSummary, SubscriptionChangeInput, SubscriptionChangeReceipt, SubscriptionDetail, SubscriptionRevisionSummary } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';
import { StatusTag } from '../../shared/components/StatusTag';

type ChangeType = SubscriptionChangeInput['changeType'];

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };

interface ChangeData {
  detail: SubscriptionDetail;
  revisions: readonly SubscriptionRevisionSummary[];
  entitlement: EntitlementSummary | undefined;
}

const changeTypeLabel: Readonly<Record<ChangeType, string>> = {
  RENEWAL: '续期',
  SCOPE_NARROWING: '收窄服务范围',
  SERVICE_ADJUSTMENT: '调整服务参数',
};
const changeReasonLabel: Readonly<Record<SubscriptionChangeInput['reasonCode'], string>> = { VALIDITY_EXTENSION: '服务期限延长', SCOPE_REDUCTION: '服务范围收窄', SERVICE_REQUIREMENT_UPDATE: '服务要求调整' };
const changeErrorLabel: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '当前账号缺少订阅变更权限，请联系订阅负责人或切换到已授权身份。',
  IDEMPOTENCY_KEY_REQUIRED: '请求流水号缺失，请重新打开变更页面后重试。',
  IDEMPOTENCY_KEY_CONFLICT: '请求流水号已被其他变更占用，请重新打开页面后重试。',
  SUBSCRIPTION_CHANGE_INPUT_INVALID: '订阅、基线版本、变更原因或说明不完整。',
  SUBSCRIPTION_CHANGE_VALIDITY_INVALID: '目标截止日期必须晚于当前服务截止日期且格式有效。',
  SUBSCRIPTION_CHANGE_ENTITLEMENT_BLOCKED: '目标日期超出企业权益有效期，不能提交变更。',
  SUBSCRIPTION_CHANGE_SCOPE_INVALID: '目标服务范围必须填写，且不能与当前范围相同。',
};

function changeErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return changeErrorLabel[code] ?? '变更申请提交失败，请稍后重试；如果问题持续，请联系订阅负责人。';
}

function validToOf(period: string): string {
  return period.split('至').at(-1)?.trim().slice(0, 10) ?? '';
}

export function SubscriptionChangePage() {
  const { subscriptionId = '' } = useParams();
  const { actor, authorize } = useAuth();
  const [changeType, setChangeType] = useState<ChangeType>('RENEWAL');
  const [targetValidTo, setTargetValidTo] = useState('2026-12-31');
  const [targetScope, setTargetScope] = useState('经十路示范走廊 · 38路口');
  const [serviceAdjustmentSummary, setServiceAdjustmentSummary] = useState('');
  const [justification, setJustification] = useState('');
  const [changeReceipt, setChangeReceipt] = useState<SubscriptionChangeReceipt | null>(null);
  const changeSequence = useRef(1);
  const changeIdempotencyKey = useRef('SUB-CHANGE-' + actor.actorId + '-' + actor.environment + '-01');
  useEffect(() => {
    changeIdempotencyKey.current = 'SUB-CHANGE-' + actor.actorId + '-' + actor.environment + '-01';
  }, [actor.actorId, actor.environment]);
  const query = useQuery<ChangeData>({
    queryKey: ['subscription-change', subscriptionId],
    enabled: Boolean(subscriptionId),
    queryFn: async () => {
      const [detail, revisions, entitlements] = await Promise.all([
        subscriptionGateway.getSubscription(subscriptionId),
        subscriptionGateway.listSubscriptionRevisions(subscriptionId),
        subscriptionGateway.listEntitlements(),
      ]);
      return {
        detail,
        revisions: revisions.items,
        entitlement: entitlements.items.find((item) => item.serviceName === detail.summary.serviceName && item.environment === detail.summary.environment),
      };
    },
  });
  const data = query.data;
  const currentRevision = data?.revisions.find((item) => item.revisionId === data.detail.approvedRevisionId) ?? data?.revisions.find((item) => item.status === 'APPROVED');
  const currentValidTo = currentRevision ? validToOf(currentRevision.validPeriod) : '';
  const entitlementValidTo = data?.entitlement?.validTo.slice(0, 10) ?? '';
  const impact = useMemo(() => {
    if (!data || !currentRevision) return { status: 'HAS_UNKNOWN' as const, blockers: ['当前订阅版本尚未形成可比较的变更基线'], nextStage: '补齐版本基线' };
    if (changeType === 'RENEWAL') {
      if (!targetValidTo) return { status: 'HAS_UNKNOWN' as const, blockers: ['请选择新的服务截止日期'], nextStage: '补充变更信息' };
      if (targetValidTo <= currentValidTo) return { status: 'BLOCKED' as const, blockers: ['续期日期必须晚于当前版本截止日期'], nextStage: '调整服务截止日期' };
      if (entitlementValidTo && targetValidTo > entitlementValidTo) return { status: 'BLOCKED' as const, blockers: [`企业权益有效期至 ${entitlementValidTo}，不足以覆盖目标日期`], nextStage: '先续期或更新企业权益' };
      return { status: 'EXECUTABLE' as const, blockers: [], nextStage: '进入影响评估与审批' };
    }
    if (changeType === 'SCOPE_NARROWING') {
      if (!targetScope.trim() || targetScope === currentRevision.scopeSummary) return { status: 'HAS_UNKNOWN' as const, blockers: ['请填写与当前范围不同的目标服务范围'], nextStage: '补充目标服务范围' };
      return { status: 'HAS_UNKNOWN' as const, blockers: ['收窄后的服务范围尚未完成实例级影响计算'], nextStage: '完成影响计算并重新核验' };
    }
    return { status: 'HAS_UNKNOWN' as const, blockers: ['服务参数调整需要新的参数快照和联合测试配置'], nextStage: '补充参数快照并重新测试' };
  }, [changeType, currentRevision, data, entitlementValidTo, targetScope, targetValidTo, currentValidTo]);
  const loading = query.isPending;
  const state = loading ? 'loading' : query.isError ? query.error instanceof Error && query.error.message === 'SUBSCRIPTION_NOT_FOUND' ? 'empty' : 'error' : data ? 'ready' : 'empty';
  const canRequestChange = authorize({ permission: 'FR2.SUBSCRIPTION.CHANGE' }).allowed;
  const changeRequestsQuery = useQuery({ queryKey: ['subscription-change-requests'], queryFn: () => subscriptionGateway.listSubscriptionChangeRequests(), enabled: canRequestChange });
  const changeMutation = useMutation({
    mutationFn: async () => {
      if (!data || !currentRevision) throw new Error('SUBSCRIPTION_CHANGE_INPUT_INVALID');
      const summary = changeType === 'RENEWAL' ? `申请续期至 ${targetValidTo}` : changeType === 'SCOPE_NARROWING' ? `申请收窄服务范围至 ${targetScope}` : serviceAdjustmentSummary;
      return subscriptionGateway.requestSubscriptionChange({
        subscriptionId: data.detail.summary.subscriptionId,
        baseRevision: currentRevision.revision,
        changeType,
        ...(changeType === 'RENEWAL' ? { targetValidTo } : {}),
        ...(changeType === 'SCOPE_NARROWING' ? { targetScope } : {}),
        changeSummary: summary,
        reasonCode: changeType === 'RENEWAL' ? 'VALIDITY_EXTENSION' : changeType === 'SCOPE_NARROWING' ? 'SCOPE_REDUCTION' : 'SERVICE_REQUIREMENT_UPDATE',
        justification,
      }, changeIdempotencyKey.current);
    },
    onSuccess: (receipt) => {
      setChangeReceipt(receipt);
      void changeRequestsQuery.refetch();
    },
  });

  function resetChangeDraft() {
    setChangeReceipt(null);
    setJustification('');
    setServiceAdjustmentSummary('');
    changeMutation.reset();
    changeSequence.current += 1;
    changeIdempotencyKey.current = 'SUB-CHANGE-' + actor.actorId + '-' + (data?.detail.summary.environment ?? actor.environment) + '-' + String(changeSequence.current).padStart(2, '0');
  }

  return <>
    <PageHeader eyebrow="订阅运营" title="变更与续期" description="准备订阅变更意图，核对影响范围和前置门禁；提交后仍需重新审批、配置、测试和发布。" badges={canRequestChange ? ['数据状态 · 以服务端为准', '变更权限 · 已授权'] : ['数据状态 · 以服务端为准']} actions={<Link className="ant-btn ant-btn-default" to={`/fr2/subscriptions/${subscriptionId}`}><ArrowLeftOutlined /> 返回订阅详情</Link>} />
    <StateBoundary state={state} emptyTitle="未找到该订阅" onRetry={() => void query.refetch()}>
      {data && currentRevision ? <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="data-notice detail-notice"><InfoCircleOutlined /><span>本页面先完成变更影响评估；提交后仅生成待审批变更申请，不会直接修改当前订阅或生成新版本。</span></div>

        <Card title="1. 选择变更类型">
          <Radio.Group value={changeType} onChange={(event) => setChangeType(event.target.value)} optionType="button" buttonStyle="solid" options={Object.entries(changeTypeLabel).map(([value, label]) => ({ value, label }))} />
          <div className="change-plan-form">
            {changeType === 'RENEWAL' ? <label><span>目标服务截止日期</span><Input type="date" value={targetValidTo} onChange={(event) => setTargetValidTo(event.target.value)} /></label> : null}
            {changeType === 'SCOPE_NARROWING' ? <label><span>目标服务范围</span><Input value={targetScope} onChange={(event) => setTargetScope(event.target.value)} /></label> : null}
            {changeType === 'SERVICE_ADJUSTMENT' ? <label><span>变更说明</span><Input value={serviceAdjustmentSummary} onChange={(event) => setServiceAdjustmentSummary(event.target.value)} placeholder="填写需要调整的服务参数或质量要求" maxLength={120} /></label> : null}
            <label><span>申请说明</span><Input.TextArea rows={3} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="说明变更背景、影响范围、验证方式和回退依据（不少于10个字）" maxLength={500} showCount /></label>
          </div>
        </Card>

        <Card className="subscription-detail-card" title="当前订阅基线" extra={<StatusTag value={data.detail.summary.lifecycle} />}>
          <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
            <Descriptions.Item label="订阅编号">{data.detail.summary.subscriptionId}</Descriptions.Item>
            <Descriptions.Item label="当前版本">{currentRevision.revisionId} · V{currentRevision.revision}</Descriptions.Item>
            <Descriptions.Item label="服务 / 环境">{currentRevision.serviceName} · {environmentLabel[currentRevision.environment] ?? currentRevision.environment}</Descriptions.Item>
            <Descriptions.Item label="企业权益有效期">{data.entitlement?.validTo ?? '未找到匹配权益'}</Descriptions.Item>
            <Descriptions.Item label="当前服务范围" span={2}>{currentRevision.scopeSummary}</Descriptions.Item>
            <Descriptions.Item label="当前有效期" span={2}>{currentRevision.validPeriod}</Descriptions.Item>
            <Descriptions.Item label="影响实例">{data.detail.instances.length} 个原子实例</Descriptions.Item>
            <Descriptions.Item label="当前配置 / 测试">变更后需重新核验</Descriptions.Item>
          </Descriptions>
        </Card>

        <div className="configuration-overview" aria-label="变更影响概览">
          <div><span>变更类型</span><strong>{changeTypeLabel[changeType]}</strong><small>意图</small></div>
          <div><span>影响实例</span><strong>{data.detail.instances.length}</strong><small>个</small></div>
          <div><span>影响评估</span><strong><StatusTag value={impact.status} /></strong><small>状态</small></div>
          <div><span>下一阶段</span><strong className="change-overview-next">{impact.nextStage}</strong><small>建议</small></div>
        </div>

        <Card title="2. 影响评估与前置门禁">
          <div className="change-check-list">
            <div className="change-check"><StatusTag value={data.entitlement ? 'SATISFIED' : 'UNKNOWN'} /><div><strong>企业权益</strong><span>{data.entitlement ? `已找到 ${data.entitlement.entitlementId}，有效期至 ${data.entitlement.validTo}` : '未找到匹配的企业权益，不能继续评估'}</span></div></div>
            <div className="change-check"><StatusTag value={currentRevision ? 'SATISFIED' : 'UNKNOWN'} /><div><strong>当前版本基线</strong><span>{currentRevision.revisionId} 已登记，当前订阅仍以该版本为获批基线</span></div></div>
            <div className="change-check"><StatusTag value={impact.status} /><div><strong>本次变更影响</strong><span>{impact.blockers.length ? impact.blockers.join('；') : '当前输入满足基础影响评估条件'}</span></div></div>
            <div className="change-check"><StatusTag value="PENDING_VERIFY" /><div><strong>后续配置、测试与发布</strong><span>变更审批通过后，必须生成新版本并重新完成配置校验、联合测试和发布</span></div></div>
          </div>
        </Card>

        <Card title="3. 办理路径">
          <Steps current={0} items={[{ title: '变更预览', description: '核对意图与影响范围' }, { title: '影响评估', description: '校验权益、配置和测试影响' }, { title: '重新审批', description: '生成新的订阅版本' }, { title: '重新交付', description: '配置、测试、发布并核验证据' }]} />
          <Alert className="section-gap-top" type={impact.status === 'BLOCKED' ? 'error' : 'info'} showIcon title={impact.status === 'BLOCKED' ? '当前输入存在硬阻断' : '当前页面尚未提交申请'} description={`${impact.nextStage}。${impact.status === 'EXECUTABLE' ? '评估可执行后仍需提交待审批申请，订阅不会立即变更。' : '请补齐前置条件后再提交待审批申请。'}`} />
          {changeReceipt ? <Result status="info" title="变更申请已进入待审批" subTitle="审批通过前不会修改当前订阅或生成新版本；后续仍需重新交付。" extra={<Button onClick={resetChangeDraft}>继续准备变更</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="申请编号">{changeReceipt.requestId}</Descriptions.Item><Descriptions.Item label="订阅 / 基线">{changeReceipt.subscriptionId} · V{changeReceipt.baseRevision}</Descriptions.Item><Descriptions.Item label="变更类型">{changeTypeLabel[changeReceipt.changeType]}</Descriptions.Item><Descriptions.Item label="变更原因">{changeReasonLabel[changeReceipt.reasonCode]}</Descriptions.Item><Descriptions.Item label="下一步">{changeReceipt.nextStep}</Descriptions.Item></Descriptions></Result> : <>
            {changeMutation.isError ? <Alert className="section-gap-top" type="error" showIcon title="变更申请提交失败" description={changeErrorMessage(changeMutation.error)} /> : null}
            <div className="change-actions"><PermissionGate permission="FR2.SUBSCRIPTION.CHANGE" fallback={<Button type="primary" disabled>提交变更申请</Button>}><Tooltip title={impact.status !== 'EXECUTABLE' ? '影响评估未完成或存在阻断，暂不能提交' : !justification.trim() ? '请先填写申请说明' : ''}><Button type="primary" onClick={() => changeMutation.mutate()} loading={changeMutation.isPending} disabled={impact.status !== 'EXECUTABLE' || justification.trim().length < 10}>{'提交变更申请'}</Button></Tooltip></PermissionGate><Link className="ant-btn ant-btn-default" to={`/fr2/revisions/compare?subscriptionId=${subscriptionId}`}>查看版本比较</Link></div>
          </>}
        </Card>
        <PermissionGate permission="FR2.SUBSCRIPTION.CHANGE" fallback={null}><Card title={<Space size={8}><span>变更申请记录</span><span className="list-count">{changeRequestsQuery.data?.items.filter((item) => item.subscriptionId === subscriptionId).length ?? 0}</span></Space>} extra={<Typography.Text type="secondary">当前订阅的申请记录</Typography.Text>}><StateBoundary state={changeRequestsQuery.isPending ? 'loading' : changeRequestsQuery.isError ? 'error' : changeRequestsQuery.data?.items.filter((item) => item.subscriptionId === subscriptionId).length ? 'ready' : 'empty'} emptyTitle="暂没有该订阅的变更申请" onRetry={() => void changeRequestsQuery.refetch()}><Space orientation="vertical" size={8} style={{ width: '100%' }}>{(changeRequestsQuery.data?.items ?? []).filter((item) => item.subscriptionId === subscriptionId).map((item) => <Card size="small" key={item.requestId}><Space direction="vertical" size={2}><Typography.Text strong>{item.requestId} · {changeTypeLabel[item.changeType]}</Typography.Text><Typography.Text type="secondary">基线 V{item.baseRevision} · {item.changeSummary} · 待审批</Typography.Text><Typography.Text type="secondary">提交于 {item.submittedAt}</Typography.Text></Space></Card>)}</Space></StateBoundary></Card></PermissionGate>
      </Space> : null}
    </StateBoundary>
  </>;
}
