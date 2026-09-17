import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { ApiOutlined, ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ApplicationAccessAction, ApplicationAccessActionReceipt, CredentialLifecycleStatus, EndpointCredentialSummary, EndpointVerificationCheckStatus, EndpointVerificationCheckSummary, IntegrationStatus, TrustDecision } from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';

const environmentLabel = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' } as const;
const endpointStatusLabel: Record<IntegrationStatus, string> = { CONNECTED: '已连接', PARTIAL: '部分可用', DEGRADED: '降级', PENDING: '待验证', NOT_CONNECTED: '未连接' };
const endpointStatusColor: Record<IntegrationStatus, string> = { CONNECTED: 'green', PARTIAL: 'gold', DEGRADED: 'orange', PENDING: 'blue', NOT_CONNECTED: 'red' };
const credentialStatusLabel: Record<CredentialLifecycleStatus, string> = { VALID: '有效', EXPIRING: '临期', REVOKED: '已撤销', UNKNOWN: '未知' };
const credentialStatusColor: Record<CredentialLifecycleStatus, string> = { VALID: 'green', EXPIRING: 'orange', REVOKED: 'red', UNKNOWN: 'default' };
const trustLabel: Record<TrustDecision, string> = { TRUSTED: '可信', PARTIAL: '部分通过', BLOCKED: '阻断', UNKNOWN: '未核验' };
const trustColor: Record<TrustDecision, string> = { TRUSTED: 'green', PARTIAL: 'orange', BLOCKED: 'red', UNKNOWN: 'default' };
const verificationStatusLabel: Record<EndpointVerificationCheckStatus, string> = { PASS: '通过', PARTIAL: '部分通过', FAIL: '失败', PENDING: '待核验', UNKNOWN: '未知' };
const verificationStatusColor: Record<EndpointVerificationCheckStatus, string> = { PASS: 'green', PARTIAL: 'orange', FAIL: 'red', PENDING: 'blue', UNKNOWN: 'default' };
const actionLabel: Record<ApplicationAccessAction, string> = { CONNECT_TEST: '连接测试', ROTATE_CREDENTIAL: '轮换凭证', REVOKE_CREDENTIAL: '吊销凭证' };
const reasonLabel = { CONNECTIVITY_VALIDATION: '连通性验证', CREDENTIAL_EXPIRING: '凭证临期', CREDENTIAL_REVOKED: '凭证撤销', SECURITY_RISK: '安全风险处置' } as const;

function endpointErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号没有端点与凭证管理权限。',
    ENDPOINT_CREDENTIAL_NOT_FOUND: '端点不存在或已被移出当前数据范围。',
    ENDPOINT_CREDENTIAL_OUT_OF_SCOPE: '端点不在当前租户或环境范围内。',
    APPLICATION_CLIENT_OUT_OF_SCOPE: '所属 ApplicationClient 不在当前租户或环境范围内。',
    APPLICATION_ACCESS_ACTION_INVALID: '目标状态不允许该操作，或操作说明不完整。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他操作，请重新打开操作面板后重试。',
  } as Record<string, string>)[code] ?? '端点操作提交失败，请稍后重试。';
}

type OperationForm = { reasonCode: string; justification: string };

export function EndpointCredentialPage() {
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const canManage = authorize({ permission: 'FR6.PARTNER.MANAGE' }).allowed;
  const [keyword, setKeyword] = useState('');
  const [environment, setEnvironment] = useState<keyof typeof environmentLabel | 'ALL'>('ALL');
  const [endpointStatus, setEndpointStatus] = useState<IntegrationStatus | 'ALL'>('ALL');
  const [credentialStatus, setCredentialStatus] = useState<CredentialLifecycleStatus | 'ALL'>('ALL');
  const [trustDecision, setTrustDecision] = useState<TrustDecision | 'ALL'>('ALL');
  const [selected, setSelected] = useState<EndpointCredentialSummary | null>(null);
  const [operationTarget, setOperationTarget] = useState<EndpointCredentialSummary | null>(null);
  const [operationAction, setOperationAction] = useState<ApplicationAccessAction>('CONNECT_TEST');
  const [receipt, setReceipt] = useState<ApplicationAccessActionReceipt | null>(null);
  const [form] = Form.useForm<OperationForm>();
  const sequence = useRef(1);

  const endpointsQuery = useQuery({ queryKey: ['endpoint-credentials', keyword], queryFn: () => subscriptionGateway.listEndpointCredentials(keyword) });
  const verificationSummaryQuery = useQuery({ queryKey: ['endpoint-verification-checks'], queryFn: () => subscriptionGateway.listEndpointVerificationChecks() });
  const verificationChecksQuery = useQuery({ queryKey: ['endpoint-verification-checks', selected?.endpointId ?? null], queryFn: () => subscriptionGateway.listEndpointVerificationChecks(selected?.endpointId), enabled: Boolean(selected) });
  const actionRequestsQuery = useQuery({ queryKey: ['application-access-action-requests'], queryFn: () => subscriptionGateway.listApplicationAccessActionRequests() });
  const items = useMemo(() => (endpointsQuery.data?.items ?? []).filter((item) => (
    (environment === 'ALL' || item.environment === environment)
    && (endpointStatus === 'ALL' || item.endpointStatus === endpointStatus)
    && (credentialStatus === 'ALL' || item.credentialStatus === credentialStatus)
    && (trustDecision === 'ALL' || item.trustDecision === trustDecision)
  )), [endpointsQuery.data?.items, environment, endpointStatus, credentialStatus, trustDecision]);
  const trustedCount = (endpointsQuery.data?.items ?? []).filter((item) => item.trustDecision === 'TRUSTED').length;
  const attentionCount = (endpointsQuery.data?.items ?? []).filter((item) => item.endpointStatus === 'DEGRADED' || item.endpointStatus === 'PARTIAL' || item.trustDecision === 'BLOCKED').length;
  const expiringCount = (endpointsQuery.data?.items ?? []).filter((item) => item.credentialStatus === 'EXPIRING' || item.credentialStatus === 'REVOKED').length;
  const verificationAttentionCount = (verificationSummaryQuery.data?.items ?? []).filter((item) => item.status !== 'PASS').length;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!operationTarget) throw new Error('ENDPOINT_CREDENTIAL_NOT_FOUND');
      const values = await form.validateFields();
      sequence.current += 1;
      return subscriptionGateway.requestApplicationAccessAction({ applicationClientId: operationTarget.applicationClientId, endpointId: operationTarget.endpointId, environment: operationTarget.environment, action: operationAction, ...values }, `ENDPOINT-ACTION-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`);
    },
    onSuccess: (nextReceipt) => {
      setReceipt(nextReceipt);
      void actionRequestsQuery.refetch();
    },
  });

  function openOperation(item: EndpointCredentialSummary, action: ApplicationAccessAction) {
    mutation.reset();
    setReceipt(null);
    setOperationTarget(item);
    setOperationAction(action);
    form.resetFields();
    form.setFieldsValue({ reasonCode: action === 'CONNECT_TEST' ? 'CONNECTIVITY_VALIDATION' : action === 'ROTATE_CREDENTIAL' ? 'CREDENTIAL_EXPIRING' : 'CREDENTIAL_REVOKED', justification: '' });
  }

  const columns = [
    { title: '端点 / 应用', width: 245, render: (_: unknown, item: EndpointCredentialSummary) => <div className="configuration-cell"><Typography.Text strong><ApiOutlined /> {item.endpointId}</Typography.Text><small>{item.applicationClientId}</small></div> },
    { title: '租户 / 环境', width: 150, render: (_: unknown, item: EndpointCredentialSummary) => <div className="configuration-cell"><Typography.Text>{item.tenantId}</Typography.Text><small>{environmentLabel[item.environment]}</small></div> },
    { title: '端点地址 / 网络区', width: 285, render: (_: unknown, item: EndpointCredentialSummary) => <div className="configuration-cell"><Typography.Text copyable={{ text: item.endpointAddressMasked }}>{item.endpointAddressMasked}</Typography.Text><small>{item.networkZone}</small></div> },
    { title: '认证方式', dataIndex: 'authMethod', width: 215 },
    { title: '凭证', width: 190, render: (_: unknown, item: EndpointCredentialSummary) => <div className="configuration-cell"><Typography.Text>{item.credentialRef}</Typography.Text><small>{item.credentialIssuer} · {item.credentialExpiresAt}</small></div> },
    { title: '凭证状态', width: 105, render: (_: unknown, item: EndpointCredentialSummary) => <Tag color={credentialStatusColor[item.credentialStatus]}>{credentialStatusLabel[item.credentialStatus]}</Tag> },
    { title: '端点状态', width: 105, render: (_: unknown, item: EndpointCredentialSummary) => <Tag color={endpointStatusColor[item.endpointStatus]}>{endpointStatusLabel[item.endpointStatus]}</Tag> },
    { title: '信任判断', width: 115, render: (_: unknown, item: EndpointCredentialSummary) => <Tag color={trustColor[item.trustDecision]}>{trustLabel[item.trustDecision]}</Tag> },
    { title: '最近核验', width: 160, dataIndex: 'lastVerifiedAt' },
    { title: '操作', width: 90, fixed: 'right' as const, render: (_: unknown, item: EndpointCredentialSummary) => <Button type="link" onClick={() => setSelected(item)}>详情</Button> },
  ];

  return <>
    <PageHeader eyebrow="服务与授权 / 平台治理" title="端点与凭证" description="按租户和环境治理 ApplicationClient 的实际接入端点、网络区、认证方式与凭证生命周期；页面只展示脱敏地址和引用，不保存私钥或 Token。" actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/fr1/partners')}>返回租户与接入</Button>} badges={[canManage ? '端点治理 · 可管理' : '端点治理 · 只读', `当前租户 ${actor.tenantId}`, `当前环境 ${environmentLabel[actor.environment]}`]} />
    <div className="data-notice"><SafetyCertificateOutlined /><span>端点记录必须同时满足当前租户与当前环境范围；连接测试、凭证轮换和吊销均提交到服务端审批/执行链，页面不直接改变生产身份。</span></div>
    <div className="configuration-overview partner-overview endpoint-overview">
      <div><span>端点总数</span><strong>{endpointsQuery.data?.total ?? 0}</strong><small>当前范围</small></div>
      <div><span>可信端点</span><strong>{trustedCount}</strong><small>完成信任核验</small></div>
      <div><span>部分可用 / 降级</span><strong>{attentionCount}</strong><small>需治理关注</small></div>
      <div><span>临期 / 已撤销凭证</span><strong>{expiringCount}</strong><small>需轮换或处置</small></div>
      <div><span>核验异常项</span><strong>{verificationAttentionCount}</strong><small>来自接入网关记录</small></div>
      <div><span>待处理操作</span><strong>{actionRequestsQuery.data?.total ?? 0}</strong><small>申请与执行回执</small></div>
    </div>
    <Card className="configuration-list-card" title="端点与凭证清单" extra={<Typography.Text type="secondary">数据更新时间：{endpointsQuery.data?.dataTime ?? '—'}</Typography.Text>}>
      <div className="configuration-filter-row endpoint-filter-row">
        <Input.Search allowClear placeholder="搜索端点、ApplicationClient、地址、凭证引用或网络区" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Select aria-label="环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, ...Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="端点状态" value={endpointStatus} onChange={setEndpointStatus} options={[{ value: 'ALL', label: '全部端点状态' }, ...Object.entries(endpointStatusLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="凭证状态" value={credentialStatus} onChange={setCredentialStatus} options={[{ value: 'ALL', label: '全部凭证状态' }, ...Object.entries(credentialStatusLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="信任判断" value={trustDecision} onChange={setTrustDecision} options={[{ value: 'ALL', label: '全部信任判断' }, ...Object.entries(trustLabel).map(([value, label]) => ({ value, label }))]} />
        <Button onClick={() => { setKeyword(''); setEnvironment('ALL'); setEndpointStatus('ALL'); setCredentialStatus('ALL'); setTrustDecision('ALL'); }}>重置</Button>
      </div>
      <StateBoundary state={endpointsQuery.isPending ? 'loading' : endpointsQuery.isError ? 'error' : items.length ? 'ready' : 'empty'} emptyTitle="暂无符合条件的端点与凭证" onRetry={() => void endpointsQuery.refetch()}><Table rowKey="endpointId" dataSource={items} columns={columns} pagination={{ pageSize: 8 }} scroll={{ x: 1780 }} /></StateBoundary>
    </Card>
    <Card className="section-gap" title="端点操作回执" extra={<Typography.Text type="secondary">操作申请与运行事实分离</Typography.Text>}>
      <StateBoundary state={actionRequestsQuery.isPending ? 'loading' : actionRequestsQuery.isError ? 'error' : actionRequestsQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂无端点操作回执" onRetry={() => void actionRequestsQuery.refetch()}><Table rowKey="requestId" dataSource={actionRequestsQuery.data?.items ?? []} pagination={{ pageSize: 5 }} scroll={{ x: 1080 }} columns={[{ title: '请求编号', dataIndex: 'requestId' }, { title: '目标端点', render: (_: unknown, item: ApplicationAccessActionReceipt) => <div className="configuration-cell"><Typography.Text>{item.endpointId ?? '应用级操作'}</Typography.Text><small>{item.environment ? environmentLabel[item.environment] : '按应用范围'}</small></div> }, { title: 'ApplicationClient', dataIndex: 'applicationClientId' }, { title: '操作', render: (_: unknown, item: ApplicationAccessActionReceipt) => actionLabel[item.action] }, { title: '状态', render: (_: unknown, item: ApplicationAccessActionReceipt) => <Tag color={item.status === 'PENDING_EXECUTION' ? 'blue' : 'orange'}>{item.status === 'PENDING_EXECUTION' ? '待执行' : '待审核'}</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }, { title: '下一步', dataIndex: 'nextStep' }]} /></StateBoundary>
    </Card>
    <Drawer title={selected ? `端点详情 · ${selected.endpointId}` : '端点详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={700}>
      {selected ? <>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="端点 / ApplicationClient">{selected.endpointId} · {selected.applicationClientId}</Descriptions.Item>
          <Descriptions.Item label="租户 / 环境">{selected.tenantId} · {environmentLabel[selected.environment]}</Descriptions.Item>
          <Descriptions.Item label="端点地址（脱敏）">{selected.endpointAddressMasked}</Descriptions.Item>
          <Descriptions.Item label="网络区 / 白名单">{selected.networkZone}</Descriptions.Item>
          <Descriptions.Item label="认证方式">{selected.authMethod}</Descriptions.Item>
          <Descriptions.Item label="凭证引用 / 签发方">{selected.credentialRef} · {selected.credentialIssuer}</Descriptions.Item>
          <Descriptions.Item label="凭证有效期 / 状态">{selected.credentialExpiresAt} · <Tag color={credentialStatusColor[selected.credentialStatus]}>{credentialStatusLabel[selected.credentialStatus]}</Tag></Descriptions.Item>
          <Descriptions.Item label="端点状态 / 信任判断"><Tag color={endpointStatusColor[selected.endpointStatus]}>{endpointStatusLabel[selected.endpointStatus]}</Tag> <Tag color={trustColor[selected.trustDecision]}>{trustLabel[selected.trustDecision]}</Tag></Descriptions.Item>
          <Descriptions.Item label="最近核验 / 责任人">{selected.lastVerifiedAt} · {selected.ownerName}</Descriptions.Item>
        </Descriptions>
        <Card size="small" title="验证结果分解" style={{ marginTop: 16 }}>
          <Typography.Paragraph type="secondary">以下结果来自接入网关逐项核验记录；生产环境应以 traceId、时间和原始回执继续追溯，页面不凭客户端状态推断连通性。</Typography.Paragraph>
          <StateBoundary state={verificationChecksQuery.isPending ? 'loading' : verificationChecksQuery.isError ? 'error' : verificationChecksQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂无端点核验记录" onRetry={() => void verificationChecksQuery.refetch()}>
            <Space direction="vertical" style={{ width: '100%' }}>{(verificationChecksQuery.data?.items ?? []).map((row: EndpointVerificationCheckSummary) => <div key={row.checkId} style={{ display: 'grid', gridTemplateColumns: '150px 90px 1fr', gap: 8, alignItems: 'center' }}><Typography.Text>{row.label}</Typography.Text><Tag color={verificationStatusColor[row.status]}>{verificationStatusLabel[row.status]}</Tag><Typography.Text type="secondary" title={row.traceId}>{row.message} · {row.observedAt}</Typography.Text></div>)}</Space>
          </StateBoundary>
        </Card>
        <Space wrap style={{ marginTop: 16 }}>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>连接测试</Button>}><Button onClick={() => openOperation(selected, 'CONNECT_TEST')}>连接测试</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>轮换凭证</Button>}><Button onClick={() => openOperation(selected, 'ROTATE_CREDENTIAL')} disabled={selected.credentialStatus === 'REVOKED'}>轮换凭证</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>吊销凭证</Button>}><Button danger onClick={() => openOperation(selected, 'REVOKE_CREDENTIAL')} disabled={selected.credentialStatus === 'REVOKED'}>吊销凭证</Button></PermissionGate>
        </Space>
      </> : null}
    </Drawer>
    <Drawer title={operationTarget ? `${actionLabel[operationAction]} · ${operationTarget.endpointId}` : '端点操作'} open={Boolean(operationTarget)} onClose={() => { if (!mutation.isPending) setOperationTarget(null); }} width={560}>
      {receipt ? <Alert type="success" showIcon title="端点操作已提交" description={<Space direction="vertical"><span>请求编号：{receipt.requestId}，当前状态：{receipt.status === 'PENDING_EXECUTION' ? '待执行' : '待审核'}。</span><span>{receipt.nextStep}</span></Space>} /> : <>
        <Alert type="warning" showIcon className="section-gap-bottom" title="操作不会立即改变生产事实" description="平台将按租户、环境、网络区和凭证策略执行；请在说明中写清验证窗口、影响范围和回滚要求。" />
        {mutation.isError ? <Alert type="error" showIcon className="section-gap-bottom" title="操作提交失败" description={endpointErrorMessage(mutation.error)} /> : null}
        <Form form={form} layout="vertical" onFinish={() => mutation.mutate()}>
          <Form.Item name="reasonCode" label="操作原因" rules={[{ required: true }]}><Select options={Object.entries(reasonLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="justification" label="操作说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字' }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="说明验证窗口、影响范围、回滚或安全依据" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={!canManage}>提交操作</Button>
        </Form>
      </>}
    </Drawer>
  </>;
}
