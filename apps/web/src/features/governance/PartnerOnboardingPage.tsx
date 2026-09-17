import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { ApartmentOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type {
  ApplicationClientSummary,
  PartnerLifecycleStatus,
  PartnerOnboardingInput,
  PartnerOnboardingReceipt,
  PartnerSummary,
  PartnerType,
  PartnerLifecycleAction,
  ApplicationAccessAction,
  ApplicationAccessActionReceipt,
  PartnerLifecycleChangeReceipt,
} from '@vrc/contracts';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';

const environmentLabel = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' } as const;
const partnerTypeLabel: Record<PartnerType, string> = { CITY_OPERATOR: '城市运营方', OEM_TSP: '车企 / TSP', DATA_PROVIDER: '数据提供方', SUPPLIER: '平台供应商' };
const statusLabel: Record<PartnerLifecycleStatus, string> = { PENDING: '待准入', ACTIVE: '生效中', FROZEN: '已冻结', EXPIRED: '已过期', EXITING: '退出中', CLOSED: '已关闭' };
const statusColor: Record<PartnerLifecycleStatus, string> = { PENDING: 'blue', ACTIVE: 'green', FROZEN: 'orange', EXPIRED: 'red', EXITING: 'gold', CLOSED: 'default' };
const reasonLabel = { NEW_PARTNER: '新合作方', NEW_APPLICATION: '新增应用', ENVIRONMENT_EXPANSION: '扩展环境', PARTNER_RECOVERY: '冻结恢复' } as const;
const lifecycleActionLabel = { FREEZE: '冻结', RESTORE: '恢复', START_EXIT: '发起退出' } as const;
const applicationActionLabel = { CONNECT_TEST: '连接测试', ROTATE_CREDENTIAL: '轮换凭证', REVOKE_CREDENTIAL: '吊销凭证' } as const;

function onboardingErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号没有接入申请权限，请联系平台管理员。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他接入申请，请重新打开表单后重试。',
    PARTNER_ONBOARDING_INPUT_INVALID: '合作方、ApplicationClient、协议、环境、联系人或申请说明不完整，请检查后重试。',
    PARTNER_ONBOARDING_SCOPE_INVALID: '目标租户或环境超出当前账号授权范围，请切换租户/环境或联系平台管理员。',
    PARTNER_ALREADY_EXISTS: '该租户或合作方已存在，请改为申请新增应用或扩展环境。',
    APPLICATION_CLIENT_ALREADY_EXISTS: 'ApplicationClient 编号已存在，请使用新的全局唯一编号。',
  } as Record<string, string>)[code] ?? '接入申请提交失败，请稍后重试。';
}

function operationErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号没有租户与应用管理权限。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他操作，请重新打开操作面板后重试。',
    PARTNER_NOT_FOUND: '合作方不存在或已被移出当前数据范围。',
    PARTNER_OUT_OF_SCOPE: '合作方不在当前租户或环境范围内。',
    APPLICATION_CLIENT_NOT_FOUND: 'ApplicationClient 不存在或已被移出当前数据范围。',
    APPLICATION_CLIENT_OUT_OF_SCOPE: 'ApplicationClient 不在当前租户或环境范围内。',
    PARTNER_LIFECYCLE_CHANGE_INVALID: '当前状态不允许该操作，或申请原因/说明不完整。',
    APPLICATION_ACCESS_ACTION_INVALID: '端点/凭证引用不完整，或操作说明不完整。',
  } as Record<string, string>)[code] ?? '操作提交失败，请稍后重试。';
}

type OnboardingForm = PartnerOnboardingInput;
type OperationForm = { reasonCode: string; justification: string };
type OperationTarget =
  | { kind: 'PARTNER'; partner: PartnerSummary; action: PartnerLifecycleAction }
  | { kind: 'APPLICATION'; application: ApplicationClientSummary; action: ApplicationAccessAction };

export function PartnerOnboardingPage() {
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const canRequest = authorize({ permission: 'FR6.PARTNER.REQUEST' }).allowed;
  const canManage = authorize({ permission: 'FR6.PARTNER.MANAGE' }).allowed;
  const [keyword, setKeyword] = useState('');
  const [partnerType, setPartnerType] = useState<PartnerType | 'ALL'>('ALL');
  const [status, setStatus] = useState<PartnerLifecycleStatus | 'ALL'>('ALL');
  const [environment, setEnvironment] = useState<keyof typeof environmentLabel | 'ALL'>('ALL');
  const [selectedPartner, setSelectedPartner] = useState<PartnerSummary | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationClientSummary | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [receipt, setReceipt] = useState<PartnerOnboardingReceipt | null>(null);
  const [operationTarget, setOperationTarget] = useState<OperationTarget | null>(null);
  const [operationReceipt, setOperationReceipt] = useState<PartnerLifecycleChangeReceipt | ApplicationAccessActionReceipt | null>(null);
  const [form] = Form.useForm<OnboardingForm>();
  const [operationForm] = Form.useForm<OperationForm>();
  const sequence = useRef(1);

  const partnersQuery = useQuery({ queryKey: ['partners', keyword], queryFn: () => subscriptionGateway.listPartners(keyword) });
  const applicationsQuery = useQuery({ queryKey: ['application-clients', keyword], queryFn: () => subscriptionGateway.listApplicationClients(keyword) });
  const requestsQuery = useQuery({ queryKey: ['partner-onboarding-requests'], queryFn: () => subscriptionGateway.listPartnerOnboardingRequests() });
  const lifecycleRequestsQuery = useQuery({ queryKey: ['partner-lifecycle-change-requests'], queryFn: () => subscriptionGateway.listPartnerLifecycleChangeRequests() });
  const accessActionRequestsQuery = useQuery({ queryKey: ['application-access-action-requests'], queryFn: () => subscriptionGateway.listApplicationAccessActionRequests() });

  const partners = useMemo(() => (partnersQuery.data?.items ?? []).filter((item) => (
    (partnerType === 'ALL' || item.partnerType === partnerType)
    && (status === 'ALL' || item.status === status)
    && (environment === 'ALL' || item.environments.includes(environment))
  )), [partnersQuery.data?.items, partnerType, status, environment]);
  const applications = useMemo(() => (applicationsQuery.data?.items ?? []).filter((item) => environment === 'ALL' || item.environments.includes(environment)), [applicationsQuery.data?.items, environment]);
  const onboardingRequests = requestsQuery.data?.items ?? [];
  const partnerById = useMemo(() => new Map((partnersQuery.data?.items ?? []).map((item) => [item.partnerId, item])), [partnersQuery.data?.items]);
  const expiringCredentials = (applicationsQuery.data?.items ?? []).filter((item) => item.credentialStatus === 'EXPIRING').length;

  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      sequence.current += 1;
      const key = `PARTNER-REQUEST-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
      return subscriptionGateway.requestPartnerOnboarding(values, key);
    },
    onSuccess: (nextReceipt) => {
      setReceipt(nextReceipt);
      void requestsQuery.refetch();
      void partnersQuery.refetch();
      void applicationsQuery.refetch();
    },
  });
  const operationMutation = useMutation({
    mutationFn: async () => {
      if (!operationTarget) throw new Error('APPLICATION_ACCESS_ACTION_INVALID');
      const values = await operationForm.validateFields();
      sequence.current += 1;
      const key = `PARTNER-ACTION-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
      if (operationTarget.kind === 'PARTNER') return subscriptionGateway.requestPartnerLifecycleChange({ partnerId: operationTarget.partner.partnerId, action: operationTarget.action, ...values }, key);
      return subscriptionGateway.requestApplicationAccessAction({ applicationClientId: operationTarget.application.applicationClientId, action: operationTarget.action, ...values }, key);
    },
    onSuccess: (nextReceipt) => {
      setOperationReceipt(nextReceipt);
      void lifecycleRequestsQuery.refetch();
      void accessActionRequestsQuery.refetch();
    },
  });

  function openRequest() {
    mutation.reset();
    setReceipt(null);
    form.resetFields();
    form.setFieldsValue({
      partnerType: actor.tenantId.startsWith('OEM-') ? 'OEM_TSP' : 'CITY_OPERATOR',
      tenantId: actor.tenantId,
      environments: [actor.environment],
      ownerName: actor.displayName,
      networkAllowlist: [],
      authMethod: 'mTLS + OAuth2 Client Credentials',
      reasonCode: 'NEW_PARTNER',
      protocolExpiresAt: '2027-12-31',
    });
    setRequestOpen(true);
  }

  function openOperation(target: OperationTarget) {
    operationMutation.reset();
    setOperationReceipt(null);
    operationForm.resetFields();
    operationForm.setFieldsValue({ reasonCode: target.kind === 'PARTNER' ? (target.action === 'FREEZE' ? 'COMPLIANCE_RISK' : target.action === 'RESTORE' ? 'RECOVERY_COMPLETED' : 'PARTNER_OFFBOARDING') : target.action === 'CONNECT_TEST' ? 'CONNECTIVITY_VALIDATION' : target.action === 'ROTATE_CREDENTIAL' ? 'CREDENTIAL_EXPIRING' : 'CREDENTIAL_REVOKED', justification: '' });
    setOperationTarget(target);
  }

  const operationTitle = operationTarget ? (operationTarget.kind === 'PARTNER' ? ({ FREEZE: '申请冻结合作方', RESTORE: '申请恢复合作方', START_EXIT: '发起合作方退出' } as const)[operationTarget.action] : ({ CONNECT_TEST: '发起连接测试', ROTATE_CREDENTIAL: '申请轮换凭证', REVOKE_CREDENTIAL: '申请吊销凭证' } as const)[operationTarget.action]) : '提交操作';

  const partnerColumns = [
    { title: '合作方 / 租户', width: 250, render: (_: unknown, item: PartnerSummary) => <div className="configuration-cell"><Typography.Text strong>{item.partnerName}</Typography.Text><small>{item.partnerId} · {item.tenantId}</small></div> },
    { title: '主体类型', width: 120, render: (_: unknown, item: PartnerSummary) => partnerTypeLabel[item.partnerType] },
    { title: '协议有效期', width: 190, render: (_: unknown, item: PartnerSummary) => <div className="configuration-cell"><Typography.Text>{item.protocolVersion}</Typography.Text><small>截至 {item.protocolExpiresAt}</small></div> },
    { title: '环境', width: 150, render: (_: unknown, item: PartnerSummary) => <Space wrap size={[4, 4]}>{item.environments.map((value) => <Tag key={value}>{environmentLabel[value]}</Tag>)}</Space> },
    { title: '数据范围', dataIndex: 'scopeSummary', width: 250 },
    { title: '状态', width: 100, render: (_: unknown, item: PartnerSummary) => <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag> },
    { title: '应用 / 端点', width: 110, render: (_: unknown, item: PartnerSummary) => `${item.applicationCount} / ${item.endpointCount}` },
    { title: '责任人', width: 150, render: (_: unknown, item: PartnerSummary) => <div className="configuration-cell"><Typography.Text>{item.ownerName}</Typography.Text><small>{item.contactName} · {item.updatedAt}</small></div> },
    { title: '操作', width: 90, fixed: 'right' as const, render: (_: unknown, item: PartnerSummary) => <Button type="link" onClick={() => setSelectedPartner(item)}>详情</Button> },
  ];
  const applicationColumns = [
    { title: 'ApplicationClient', width: 240, render: (_: unknown, item: ApplicationClientSummary) => <div className="configuration-cell"><Typography.Text strong>{item.applicationName}</Typography.Text><small>{item.applicationClientId}</small></div> },
    { title: '所属合作方', width: 210, render: (_: unknown, item: ApplicationClientSummary) => <div className="configuration-cell"><Typography.Text>{partnerById.get(item.partnerId)?.partnerName ?? item.partnerId}</Typography.Text><small>{item.tenantId}</small></div> },
    { title: '用途', dataIndex: 'purpose', width: 260 },
    { title: '环境', width: 150, render: (_: unknown, item: ApplicationClientSummary) => item.environments.map((value) => environmentLabel[value]).join('、') },
    { title: '端点状态', width: 110, render: (_: unknown, item: ApplicationClientSummary) => <Tag color={item.endpointStatus === 'CONNECTED' ? 'green' : item.endpointStatus === 'DEGRADED' ? 'orange' : 'blue'}>{item.endpointStatus === 'CONNECTED' ? '已连接' : item.endpointStatus === 'DEGRADED' ? '降级' : '待接入'}</Tag> },
    { title: '凭证状态', width: 110, render: (_: unknown, item: ApplicationClientSummary) => <Tag color={item.credentialStatus === 'VALID' ? 'green' : item.credentialStatus === 'EXPIRING' ? 'orange' : 'red'}>{item.credentialStatus === 'VALID' ? '有效' : item.credentialStatus === 'EXPIRING' ? '临期' : item.credentialStatus === 'REVOKED' ? '已撤销' : '未知'}</Tag> },
    { title: '配额', width: 130, dataIndex: 'quota' },
    { title: '状态', width: 100, render: (_: unknown, item: ApplicationClientSummary) => <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag> },
    { title: '操作', width: 90, fixed: 'right' as const, render: (_: unknown, item: ApplicationClientSummary) => <Button type="link" onClick={() => setSelectedApplication(item)}>详情</Button> },
  ];

  return <>
    <PageHeader
      eyebrow="服务与授权 / 平台治理"
      title="租户与接入"
      description="统一管理合作方、租户、ApplicationClient 及其环境准入。协议、端点、凭证和配额只展示治理引用，不在页面保存私钥或直接开通生产身份。"
      actions={<PermissionGate permission="FR6.PARTNER.REQUEST" fallback={<Button disabled icon={<PlusOutlined />}>申请接入</Button>}><Button type="primary" icon={<PlusOutlined />} onClick={openRequest}>申请接入</Button></PermissionGate>}
      badges={[canManage ? '租户与应用 · 可管理' : '租户与应用 · 只读', canRequest ? '可提交准入申请' : '不可提交申请', `当前租户 ${actor.tenantId}`, `当前环境 ${environmentLabel[actor.environment]}`]}
    />
    <div className="data-notice"><SafetyCertificateOutlined />当前会话仅显示当前租户、当前环境且落在账号数据范围内的记录；“主体授权”页面负责用户/服务账号/组织的角色绑定，本页面不替代角色授权。</div>
    <div className="configuration-overview partner-overview">
      <div><span>合作方 / 租户</span><strong>{partnersQuery.data?.total ?? 0}</strong><small>当前范围</small></div>
      <div><span>ApplicationClient</span><strong>{applicationsQuery.data?.total ?? 0}</strong><small>已登记应用</small></div>
      <div><span>待准入 / 冻结</span><strong>{onboardingRequests.length + (partnersQuery.data?.items ?? []).filter((item) => item.status === 'FROZEN' || item.status === 'PENDING').length}</strong><small>需治理关注</small></div>
      <div><span>临期凭证</span><strong>{expiringCredentials}</strong><small>需轮换</small></div>
    </div>
    <Card className="configuration-list-card" title="合作方与应用登记" extra={<Typography.Text type="secondary">数据更新时间：{partnersQuery.data?.dataTime ?? '—'}</Typography.Text>}>
      <div className="configuration-filter-row partner-filter-row">
        <Input.Search allowClear placeholder="搜索合作方、租户、应用、协议或端点" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Select aria-label="合作方类型" value={partnerType} onChange={setPartnerType} options={[{ value: 'ALL', label: '全部主体类型' }, ...Object.entries(partnerTypeLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="准入状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部准入状态' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="接入环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, ...Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))]} />
        <Button onClick={() => { setKeyword(''); setPartnerType('ALL'); setStatus('ALL'); setEnvironment('ALL'); }}>重置</Button>
      </div>
      <Tabs items={[
        { key: 'partners', label: `合作方与租户（${partners.length}）`, children: <StateBoundary state={partnersQuery.isPending ? 'loading' : partnersQuery.isError ? 'error' : partners.length ? 'ready' : 'empty'} emptyTitle="暂无符合条件的合作方或租户" onRetry={() => void partnersQuery.refetch()}><Table rowKey="partnerId" dataSource={partners} columns={partnerColumns} pagination={{ pageSize: 8 }} scroll={{ x: 1380 }} /></StateBoundary> },
        { key: 'applications', label: `应用与环境（${applications.length}）`, children: <StateBoundary state={applicationsQuery.isPending ? 'loading' : applicationsQuery.isError ? 'error' : applications.length ? 'ready' : 'empty'} emptyTitle="暂无符合条件的 ApplicationClient" onRetry={() => void applicationsQuery.refetch()}><Table rowKey="applicationClientId" dataSource={applications} columns={applicationColumns} pagination={{ pageSize: 8 }} scroll={{ x: 1320 }} /></StateBoundary> },
      ]} />
    </Card>
    <Card className="section-gap" title="准入申请记录" extra={<Typography.Text type="secondary">申请与生效事实分离</Typography.Text>}>
      <StateBoundary state={requestsQuery.isPending ? 'loading' : requestsQuery.isError ? 'error' : onboardingRequests.length ? 'ready' : 'empty'} emptyTitle="暂无租户与接入申请" onRetry={() => void requestsQuery.refetch()}>
        <Table rowKey="requestId" dataSource={onboardingRequests} pagination={{ pageSize: 5 }} scroll={{ x: 1000 }} columns={[{ title: '申请编号', dataIndex: 'requestId' }, { title: '合作方 / 租户', render: (_: unknown, item: PartnerOnboardingReceipt) => <div className="configuration-cell"><Typography.Text>{item.partnerName}</Typography.Text><small>{item.tenantId}</small></div> }, { title: 'ApplicationClient', render: (_: unknown, item: PartnerOnboardingReceipt) => `${item.applicationName} · ${item.applicationClientId}` }, { title: '申请原因', render: (_: unknown, item: PartnerOnboardingReceipt) => reasonLabel[item.reasonCode] }, { title: '环境', render: (_: unknown, item: PartnerOnboardingReceipt) => item.environments.map((value) => environmentLabel[value]).join('、') }, { title: '状态', render: () => <Tag color="blue">待审核</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }]} />
      </StateBoundary>
    </Card>
    <Card className="section-gap" title="接入治理操作记录" extra={<Typography.Text type="secondary">冻结、连接测试与凭证操作均保留独立回执</Typography.Text>}>
      <Tabs items={[
        { key: 'lifecycle', label: `主体生命周期（${lifecycleRequestsQuery.data?.total ?? 0}）`, children: <StateBoundary state={lifecycleRequestsQuery.isPending ? 'loading' : lifecycleRequestsQuery.isError ? 'error' : lifecycleRequestsQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂无主体生命周期操作" onRetry={() => void lifecycleRequestsQuery.refetch()}><Table rowKey="requestId" dataSource={lifecycleRequestsQuery.data?.items ?? []} pagination={{ pageSize: 5 }} scroll={{ x: 760 }} columns={[{ title: '请求编号', dataIndex: 'requestId' }, { title: '合作方', render: (_: unknown, item: PartnerLifecycleChangeReceipt) => partnerById.get(item.partnerId)?.partnerName ?? item.partnerId }, { title: '操作', render: (_: unknown, item: PartnerLifecycleChangeReceipt) => lifecycleActionLabel[item.action] }, { title: '状态', render: () => <Tag color="blue">待审核</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }]} /></StateBoundary> },
        { key: 'application', label: `应用接入操作（${accessActionRequestsQuery.data?.total ?? 0}）`, children: <StateBoundary state={accessActionRequestsQuery.isPending ? 'loading' : accessActionRequestsQuery.isError ? 'error' : accessActionRequestsQuery.data?.items.length ? 'ready' : 'empty'} emptyTitle="暂无应用接入操作" onRetry={() => void accessActionRequestsQuery.refetch()}><Table rowKey="requestId" dataSource={accessActionRequestsQuery.data?.items ?? []} pagination={{ pageSize: 5 }} scroll={{ x: 900 }} columns={[{ title: '请求编号', dataIndex: 'requestId' }, { title: 'ApplicationClient', render: (_: unknown, item: ApplicationAccessActionReceipt) => item.applicationClientId }, { title: '操作', render: (_: unknown, item: ApplicationAccessActionReceipt) => applicationActionLabel[item.action] }, { title: '状态', render: (_: unknown, item: ApplicationAccessActionReceipt) => <Tag color={item.status === 'PENDING_EXECUTION' ? 'blue' : 'orange'}>{item.status === 'PENDING_EXECUTION' ? '待执行' : '待审核'}</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }]} /></StateBoundary> },
      ]} />
    </Card>
    <Drawer title={selectedPartner ? `合作方详情 · ${selectedPartner.partnerId}` : '合作方详情'} open={Boolean(selectedPartner)} onClose={() => setSelectedPartner(null)} width={680}>
      {selectedPartner ? <>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="合作方 / 租户">{selectedPartner.partnerName} · {selectedPartner.tenantId}</Descriptions.Item>
          <Descriptions.Item label="主体类型">{partnerTypeLabel[selectedPartner.partnerType]}</Descriptions.Item>
          <Descriptions.Item label="法定主体">{selectedPartner.legalName}</Descriptions.Item>
          <Descriptions.Item label="协议版本 / 有效期">{selectedPartner.protocolVersion} · 截至 {selectedPartner.protocolExpiresAt}</Descriptions.Item>
          <Descriptions.Item label="准入环境">{selectedPartner.environments.map((value) => environmentLabel[value]).join('、')}</Descriptions.Item>
          <Descriptions.Item label="数据范围">{selectedPartner.scopeSummary}</Descriptions.Item>
          <Descriptions.Item label="责任人 / 联系人">{selectedPartner.ownerName} · {selectedPartner.contactName}（{selectedPartner.contactEmail}）</Descriptions.Item>
          <Descriptions.Item label="数据处理角色">{selectedPartner.dataProcessingRole}</Descriptions.Item>
          <Descriptions.Item label="紧急值班">{selectedPartner.onCallContact}</Descriptions.Item>
          <Descriptions.Item label="当前状态"><Tag color={statusColor[selectedPartner.status]}>{statusLabel[selectedPartner.status]}</Tag></Descriptions.Item>
        </Descriptions>
        <Space wrap style={{ marginTop: 16 }}>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>冻结</Button>}><Button danger disabled={!['ACTIVE', 'PENDING'].includes(selectedPartner.status)} onClick={() => openOperation({ kind: 'PARTNER', partner: selectedPartner, action: 'FREEZE' })}>冻结</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>恢复</Button>}><Button disabled={selectedPartner.status !== 'FROZEN'} onClick={() => openOperation({ kind: 'PARTNER', partner: selectedPartner, action: 'RESTORE' })}>恢复</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>发起退出</Button>}><Button disabled={!['ACTIVE', 'FROZEN', 'EXPIRED'].includes(selectedPartner.status)} onClick={() => openOperation({ kind: 'PARTNER', partner: selectedPartner, action: 'START_EXIT' })}>发起退出</Button></PermissionGate>
        </Space>
        <Typography.Title level={5} style={{ marginTop: 20 }}>已登记应用</Typography.Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          {(applicationsQuery.data?.items ?? []).filter((item) => item.partnerId === selectedPartner.partnerId).map((item) => <Card key={item.applicationClientId} size="small" hoverable onClick={() => setSelectedApplication(item)}><Space><ApartmentOutlined /><Typography.Text strong>{item.applicationName}</Typography.Text><Typography.Text type="secondary">{item.applicationClientId}</Typography.Text><Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag></Space></Card>)}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>端点和凭证仅以引用方式管理；实际密钥由接入网关、证书中心或 KMS 托管，页面不展示私钥。</Typography.Paragraph>
      </> : null}
    </Drawer>
    <Drawer title={selectedApplication ? `ApplicationClient 详情 · ${selectedApplication.applicationClientId}` : 'ApplicationClient 详情'} open={Boolean(selectedApplication)} onClose={() => setSelectedApplication(null)} width={640}>
      {selectedApplication ? <>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="应用名称">{selectedApplication.applicationName}</Descriptions.Item>
          <Descriptions.Item label="所属合作方 / 租户">{partnerById.get(selectedApplication.partnerId)?.partnerName ?? selectedApplication.partnerId} · {selectedApplication.tenantId}</Descriptions.Item>
          <Descriptions.Item label="业务用途">{selectedApplication.purpose}</Descriptions.Item>
          <Descriptions.Item label="数据范围">{selectedApplication.scopeSummary}</Descriptions.Item>
          <Descriptions.Item label="环境">{selectedApplication.environments.map((value) => environmentLabel[value]).join('、')}</Descriptions.Item>
          <Descriptions.Item label="端点引用">{selectedApplication.endpointRefs.join('、')}</Descriptions.Item>
          <Descriptions.Item label="凭证引用">{selectedApplication.credentialRefs.join('、')}</Descriptions.Item>
          <Descriptions.Item label="网络白名单">{selectedApplication.networkAllowlist.join('、')}</Descriptions.Item>
          <Descriptions.Item label="认证方式">{selectedApplication.authMethod}</Descriptions.Item>
          <Descriptions.Item label="端点 / 凭证状态">{selectedApplication.endpointStatus} / {selectedApplication.credentialStatus}</Descriptions.Item>
          <Descriptions.Item label="配额">{selectedApplication.quota}</Descriptions.Item>
          <Descriptions.Item label="责任人 / 更新时间">{selectedApplication.ownerName} · {selectedApplication.updatedAt}</Descriptions.Item>
        </Descriptions>
        <Space wrap style={{ marginTop: 16 }}>
          <Button onClick={() => navigate('/fr1/endpoints')}>查看端点与凭证</Button>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>连接测试</Button>}><Button onClick={() => openOperation({ kind: 'APPLICATION', application: selectedApplication, action: 'CONNECT_TEST' })}>连接测试</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>轮换凭证</Button>}><Button onClick={() => openOperation({ kind: 'APPLICATION', application: selectedApplication, action: 'ROTATE_CREDENTIAL' })}>轮换凭证</Button></PermissionGate>
          <PermissionGate permission="FR6.PARTNER.MANAGE" fallback={<Button disabled>吊销凭证</Button>}><Button danger onClick={() => openOperation({ kind: 'APPLICATION', application: selectedApplication, action: 'REVOKE_CREDENTIAL' })}>吊销凭证</Button></PermissionGate>
        </Space>
        <Alert type="info" showIcon style={{ marginTop: 16 }} title="生产开通前置条件" description="必须完成协议校验、端点连通性验证、凭证轮换策略、环境准入和服务端权限复核；本页只提交申请，不直接改变生产身份。" />
      </> : null}
    </Drawer>
    <Drawer title="申请租户与接入" open={requestOpen} onClose={() => { if (!mutation.isPending) setRequestOpen(false); }} width={680}>
      {receipt ? <Alert type="success" showIcon title="接入申请已提交" description={<Space direction="vertical"><span>申请编号：{receipt.requestId}，当前状态：待审核。</span><span>{receipt.nextStep}</span></Space>} /> : <>
        <Alert type="info" showIcon className="section-gap-bottom" title="申请不等于开通" description="提交后由平台治理审核合作协议、ApplicationClient、端点、凭证引用、配额和环境范围；审核通过前不创建生产身份。" />
        {mutation.isError ? <Alert type="error" showIcon className="section-gap-bottom" title="申请提交失败" description={onboardingErrorMessage(mutation.error)} /> : null}
        <Form form={form} layout="vertical" onFinish={() => mutation.mutate()}>
          <Space style={{ display: 'flex' }} size={12}><Form.Item name="partnerType" label="主体类型" rules={[{ required: true }]} style={{ flex: 1 }}><Select options={Object.entries(partnerTypeLabel).map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item name="tenantId" label="租户编码" rules={[{ required: true, message: '请输入租户编码' }]} style={{ flex: 1 }}><Input placeholder="例如 OEM-QILU" /></Form.Item></Space>
          <Space style={{ display: 'flex' }} size={12}><Form.Item name="partnerName" label="合作方名称" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item name="legalName" label="法定主体名称" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item></Space>
          <Space style={{ display: 'flex' }} size={12}><Form.Item name="protocolVersion" label="协议 / Profile 版本" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="例如 OEM-UUA-PROFILE-2.3" /></Form.Item><Form.Item name="protocolExpiresAt" label="协议有效期至" rules={[{ required: true }]} style={{ flex: 1 }}><Input type="date" /></Form.Item></Space>
          <Space style={{ display: 'flex' }} size={12}><Form.Item name="applicationClientId" label="ApplicationClient 编号" rules={[{ required: true }]} style={{ flex: 1 }}><Input placeholder="必须全局唯一" /></Form.Item><Form.Item name="applicationName" label="应用名称" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item></Space>
          <Form.Item name="purpose" label="应用用途" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="说明消费的数据服务、V2X 场景及车端用途" /></Form.Item>
          <Form.Item name="environments" label="申请环境" rules={[{ required: true, message: '至少选择一个环境' }]}><Select mode="multiple" options={Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="scopeSummary" label="数据范围" rules={[{ required: true }]}><Input placeholder="例如 济南市 · 经十路示范走廊" /></Form.Item>
          <Form.Item name="networkAllowlist" label="网络白名单" rules={[{ required: true, message: '至少登记一个网络来源' }]}><Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入 CIDR、专线或证书组后回车" /></Form.Item>
          <Form.Item name="authMethod" label="认证方式" rules={[{ required: true }]}><Select options={[{ value: 'mTLS + OAuth2 Client Credentials', label: 'mTLS + OAuth2 Client Credentials' }, { value: '国密双向认证', label: '国密双向认证' }, { value: '专线 + mTLS', label: '专线 + mTLS' }]} /></Form.Item>
          <Space style={{ display: 'flex' }} size={12}><Form.Item name="ownerName" label="平台责任人" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item name="contactName" label="合作方联系人" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item></Space>
          <Form.Item name="contactEmail" label="联系人邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="reasonCode" label="申请原因" rules={[{ required: true }]}><Select options={Object.entries(reasonLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="justification" label="申请说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字' }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={!canRequest}>提交准入申请</Button>
        </Form>
      </>}
    </Drawer>
    <Drawer title={operationTitle} open={Boolean(operationTarget)} onClose={() => { if (!operationMutation.isPending) setOperationTarget(null); }} width={560}>
      {operationReceipt ? <Alert type="success" showIcon title="操作已提交" description={<Space direction="vertical"><span>请求编号：{operationReceipt.requestId}，当前状态：{operationReceipt.status === 'PENDING_EXECUTION' ? '待执行' : '待审核'}。</span><span>{operationReceipt.nextStep}</span></Space>} /> : <>
        <Alert type="warning" showIcon className="section-gap-bottom" title="操作不会立即改变生产事实" description="提交后由对应的网关、证书中心或治理审批链执行；结果以逐目标回执和审计事件为准。" />
        {operationMutation.isError ? <Alert type="error" showIcon className="section-gap-bottom" title="操作提交失败" description={operationErrorMessage(operationMutation.error)} /> : null}
        <Form form={operationForm} layout="vertical" onFinish={() => operationMutation.mutate()}>
          <Form.Item name="reasonCode" label="操作原因" rules={[{ required: true, message: '请输入操作原因' }]}><Input /></Form.Item>
          <Form.Item name="justification" label="操作说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字' }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="说明影响范围、回滚或验证要求" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={operationMutation.isPending} disabled={!canManage}>提交操作</Button>
        </Form>
      </>}
    </Drawer>
  </>;
}
