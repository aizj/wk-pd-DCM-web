import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { RoleAssignmentChangeInput, RoleAssignmentChangeReceipt, RoleAssignmentStatus, RoleAssignmentSubjectType, RoleCode } from '@vrc/contracts';
import { roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';

const statusLabel: Record<RoleAssignmentStatus, string> = { ACTIVE: '生效中', PENDING_APPROVAL: '待审批', EXPIRING: '即将到期', REVOKED: '已撤销' };
const statusColor: Record<RoleAssignmentStatus, string> = { ACTIVE: 'green', PENDING_APPROVAL: 'blue', EXPIRING: 'orange', REVOKED: 'default' };
const subjectLabel: Record<RoleAssignmentSubjectType, string> = { USER: '用户', SERVICE_ACCOUNT: '服务账号', ORGANIZATION: '组织' };
const environmentLabel = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' } as const;
const changeLabel = { GRANT: '新增授权', ADJUST: '调整授权', REVOKE: '撤销授权' } as const;
type RequestForm = RoleAssignmentChangeInput;
type Assignment = Awaited<ReturnType<typeof subscriptionGateway.listRoleAssignments>>['items'][number];

function requestErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号缺少授权变更申请权限，请联系平台管理员。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他授权申请，请重新打开表单后重试。',
    ROLE_ASSIGNMENT_CHANGE_INPUT_INVALID: '主体、角色、租户、环境、有效期或申请说明不完整，请检查后重试。',
    ROLE_ASSIGNMENT_CHANGE_SCOPE_INVALID: '目标租户或环境超出当前账号授权范围，请收窄范围或联系平台管理员。',
    ROLE_ASSIGNMENT_NOT_FOUND: '未找到可调整或撤销的有效授权实例，请刷新列表后重试。',
    ROLE_ASSIGNMENT_DUPLICATE: '该主体已存在相同角色的有效或待审批授权，无需重复申请。',
    ROLE_ASSIGNMENT_CHANGE_DATES_INVALID: '生效时间和到期时间格式无效，且到期时间必须晚于生效时间。',
    ROLE_ASSIGNMENT_CHANGE_REASON_INVALID: '申请原因与变更类型不匹配，请重新选择。',
  } as Record<string, string>)[code] ?? '授权变更申请提交失败，请稍后重试。';
}

export function SubjectAuthorizationPage() {
  const navigate = useNavigate();
  const { actor, authorize } = useAuth();
  const canRequest = authorize({ permission: 'GOVERNANCE.ROLE.REQUEST' }).allowed;
  const canManage = authorize({ permission: 'GOVERNANCE.ROLE.MANAGE' }).allowed;
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<RoleAssignmentStatus | 'ALL'>('ALL');
  const [subjectType, setSubjectType] = useState<RoleAssignmentSubjectType | 'ALL'>('ALL');
  const [roleCode, setRoleCode] = useState<RoleCode | 'ALL'>('ALL');
  const [environment, setEnvironment] = useState<keyof typeof environmentLabel | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(false);
  const [requestMode, setRequestMode] = useState<'GRANT' | 'REVOKE'>('GRANT');
  const [receipt, setReceipt] = useState<RoleAssignmentChangeReceipt | null>(null);
  const [targetTenantId, setTargetTenantId] = useState(actor.tenantId);
  const [organizationName, setOrganizationName] = useState(actor.tenantId.startsWith('CITY-') ? '济南市交通运输局' : '齐鲁智行汽车');
  const [form] = Form.useForm<RequestForm>();
  const sequence = useRef(1);
  const idempotencyKey = useRef(`ROLE-REQUEST-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`);
  useEffect(() => {
    idempotencyKey.current = `ROLE-REQUEST-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
  }, [actor.actorId, actor.environment]);
  const assignmentsQuery = useQuery({ queryKey: ['role-assignments', keyword], queryFn: () => subscriptionGateway.listRoleAssignments(keyword) });
  const requestsQuery = useQuery({ queryKey: ['role-assignment-change-requests'], queryFn: () => subscriptionGateway.listRoleAssignmentChangeRequests() });
  const mutation = useMutation({ mutationFn: async () => {
    const values = await form.validateFields();
    if (!targetTenantId.trim() || !organizationName.trim()) throw new Error('ROLE_ASSIGNMENT_CHANGE_INPUT_INVALID');
    return subscriptionGateway.requestRoleAssignmentChange({ ...values, tenantId: targetTenantId.trim(), organizationName: organizationName.trim() }, idempotencyKey.current);
  }, onSuccess: (nextReceipt) => { setReceipt(nextReceipt); void requestsQuery.refetch(); } });
  const assignments = (assignmentsQuery.data?.items ?? []).filter((item) => (
    (status === 'ALL' || item.status === status)
    && (subjectType === 'ALL' || item.subjectType === subjectType)
    && (roleCode === 'ALL' || item.roleCode === roleCode)
    && (environment === 'ALL' || item.environments.includes(environment))
  ));
  const requestItems = requestsQuery.data?.items ?? [];

  function openRequest() { sequence.current += 1; idempotencyKey.current = `ROLE-REQUEST-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`; setRequestMode('GRANT'); setReceipt(null); mutation.reset(); form.resetFields(); setTargetTenantId(actor.tenantId); setOrganizationName(actor.tenantId.startsWith('CITY-') ? '济南市交通运输局' : '齐鲁智行汽车'); form.setFieldsValue({ changeType: 'GRANT', subjectType: 'USER', roleCode: 'TEST_OPERATOR', environments: [actor.environment], effectiveFrom: '2026-09-20', expiresAt: '2026-12-31' }); setOpen(true); }
  function openRevokeRequest(item: Assignment) {
    sequence.current += 1;
    idempotencyKey.current = `ROLE-REQUEST-${actor.actorId}-REVOKE-${String(sequence.current).padStart(2, '0')}`;
    setRequestMode('REVOKE');
    setReceipt(null);
    mutation.reset();
    form.resetFields();
    form.setFieldsValue({
      changeType: 'REVOKE', subjectType: item.subjectType, subjectId: item.subjectId, subjectName: item.subjectName,
      roleCode: item.roleCode, scopeSummary: item.scopeSummary, environments: item.environments,
      effectiveFrom: item.effectiveFrom, expiresAt: item.expiresAt, reasonCode: 'SCOPE_CHANGE',
    });
    setTargetTenantId(item.tenantId);
    setOrganizationName(item.organizationName);
    setSelected(null);
    setOpen(true);
  }

  return <>
    <PageHeader eyebrow="安全与审计 / 访问控制" title="主体授权" description="将角色模板授权给用户、服务账号或组织，按租户、数据范围、环境和有效期形成授权实例。所有变更先进入审批队列。" actions={<Space><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/governance/permissions')}>返回总览</Button><PermissionGate permission="GOVERNANCE.ROLE.REQUEST" fallback={<Button disabled icon={<PlusOutlined />}>申请授权</Button>}><Button type="primary" icon={<PlusOutlined />} onClick={openRequest}>申请授权</Button></PermissionGate></Space>} badges={[canManage ? '授权管理 · 可操作' : '授权管理 · 只读', canRequest ? '可提交变更申请' : '不可提交申请']} />
    <Card title="授权实例" extra={<Space wrap><Input.Search allowClear placeholder="搜索主体、角色、租户" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 230 }} /><Select aria-label="主体类型" value={subjectType} onChange={setSubjectType} options={[{ value: 'ALL', label: '全部主体类型' }, ...Object.entries(subjectLabel).map(([value, label]) => ({ value, label }))]} style={{ width: 140 }} /><Select aria-label="角色" value={roleCode} onChange={setRoleCode} options={[{ value: 'ALL', label: '全部角色' }, ...roleCatalog.map((role) => ({ value: role.code, label: role.label }))]} style={{ width: 150 }} /><Select aria-label="授权环境" value={environment} onChange={setEnvironment} options={[{ value: 'ALL', label: '全部环境' }, ...Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))]} style={{ width: 130 }} /><Select aria-label="授权状态" value={status} onChange={setStatus} options={[{ value: 'ALL', label: '全部状态' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} style={{ width: 130 }} /></Space>}>
      <StateBoundary state={assignmentsQuery.isPending ? 'loading' : assignmentsQuery.isError ? 'error' : assignments.length ? 'ready' : 'empty'} emptyTitle="暂无符合条件的授权实例" onRetry={() => void assignmentsQuery.refetch()}>
        <Table rowKey="assignmentId" dataSource={assignments} pagination={{ pageSize: 8 }} scroll={{ x: 1100 }} columns={[{ title: '授权主体', width: 220, render: (_, item) => <div className="configuration-cell"><Typography.Text strong>{item.subjectName}</Typography.Text><small>{subjectLabel[item.subjectType]} · {item.subjectId}</small></div> }, { title: '角色', width: 160, render: (_, item) => roleCatalog.find((role) => role.code === item.roleCode)?.label ?? item.roleCode }, { title: '数据范围', dataIndex: 'scopeSummary', width: 240 }, { title: '环境', width: 160, render: (_, item) => item.environments.map((value) => environmentLabel[value]).join('、') }, { title: '有效期', width: 220, render: (_, item) => `${item.effectiveFrom} 至 ${item.expiresAt}` }, { title: '状态', width: 100, render: (_, item) => <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag> }, { title: '操作', width: 100, fixed: 'right', render: (_, item) => <Button type="link" onClick={() => setSelected(item)}>查看详情</Button> }]} />
      </StateBoundary>
    </Card>
    <Card title="授权变更申请历史" extra={<Typography.Text type="secondary">申请记录与授权事实分离展示</Typography.Text>}>
      <StateBoundary state={requestsQuery.isPending ? 'loading' : requestsQuery.isError ? 'error' : requestItems.length ? 'ready' : 'empty'} emptyTitle="暂无授权变更申请" onRetry={() => void requestsQuery.refetch()}>
        <Table rowKey="requestId" dataSource={requestItems} pagination={{ pageSize: 5 }} scroll={{ x: 1160 }} columns={[{ title: '申请编号', dataIndex: 'requestId' }, { title: '变更类型', render: (_, item) => changeLabel[item.changeType] }, { title: '主体', dataIndex: 'subjectName' }, { title: '目标租户 / 组织', width: 210, render: (_, item) => <div className="configuration-cell"><Typography.Text>{item.tenantId}</Typography.Text><small>{item.organizationName}</small></div> }, { title: '角色', render: (_, item) => roleCatalog.find((role) => role.code === item.roleCode)?.label ?? item.roleCode }, { title: '状态', render: () => <Tag color="blue">待审批</Tag> }, { title: '提交时间', dataIndex: 'submittedAt' }]} />
      </StateBoundary>
    </Card>
    <Drawer title={selected ? `授权详情 · ${selected.assignmentId}` : '授权详情'} open={Boolean(selected)} onClose={() => setSelected(null)} width={600}>
      {selected ? <><Descriptions bordered column={1} size="small"><Descriptions.Item label="授权编号">{selected.assignmentId}</Descriptions.Item><Descriptions.Item label="主体">{selected.subjectName}（{subjectLabel[selected.subjectType]} · {selected.subjectId}）</Descriptions.Item><Descriptions.Item label="所属组织 / 租户">{selected.organizationName} · {selected.tenantId}</Descriptions.Item><Descriptions.Item label="角色">{roleCatalog.find((role) => role.code === selected.roleCode)?.label ?? selected.roleCode} · {selected.roleCode}</Descriptions.Item><Descriptions.Item label="数据范围">{selected.scopeSummary}</Descriptions.Item><Descriptions.Item label="环境">{selected.environments.map((value) => environmentLabel[value]).join('、')}</Descriptions.Item><Descriptions.Item label="有效期">{selected.effectiveFrom} 至 {selected.expiresAt}</Descriptions.Item><Descriptions.Item label="授权人 / 更新时间">{selected.grantedBy} · {selected.updatedAt}</Descriptions.Item></Descriptions><Button danger disabled={selected.status === 'REVOKED' || !canRequest} style={{ marginTop: 16 }} onClick={() => openRevokeRequest(selected)}>{selected.status === 'REVOKED' ? '授权已撤销' : canRequest ? '申请撤销授权' : '无撤销申请权限'}</Button><Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>撤销授权需提交变更申请，审批通过后生效；此处不会直接改变授权事实。</Typography.Paragraph></> : null}
    </Drawer>
    <Drawer title={requestMode === 'REVOKE' ? '申请撤销授权' : '申请主体授权'} open={open} onClose={() => { if (!mutation.isPending) setOpen(false); }} width={650}>
      {!receipt ? <Card size="small" title="授权边界" className="section-gap-bottom"><Space style={{ display: 'flex', width: '100%' }} size={12}><div style={{ flex: 1 }}><Typography.Text strong>目标租户</Typography.Text><Input value={targetTenantId} onChange={(event) => setTargetTenantId(event.target.value)} placeholder="例如 CITY-JINAN" style={{ marginTop: 8 }} /></div><div style={{ flex: 1 }}><Typography.Text strong>所属组织</Typography.Text><Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例如 济南市交通运输局" style={{ marginTop: 8 }} /></div></Space><Typography.Text type="secondary">目标租户和环境必须落在当前账号授权范围内，服务端会再次校验。</Typography.Text></Card> : null}
      {receipt ? <Alert type="success" showIcon title={requestMode === 'REVOKE' ? '撤销申请已提交' : '授权申请已提交'} description={`申请编号 ${receipt.requestId}，当前状态为待审批；审批通过前不会改变当前有效授权。`} /> : <><Alert type="info" showIcon title={requestMode === 'REVOKE' ? '撤销不会立即生效' : '申请不会直接授予权限'} description="提交后由平台管理员审批，并校验租户、范围、环境、有效期和职责分离。" className="section-gap-bottom" />{mutation.isError ? <Alert type="error" showIcon title="授权申请提交失败" description={requestErrorMessage(mutation.error)} className="section-gap-bottom" /> : null}<Form form={form} layout="vertical" onFinish={() => mutation.mutate()}><Space style={{ display: 'flex' }} size={12}><Form.Item name="changeType" label="变更类型" rules={[{ required: true }]} style={{ flex: 1 }}><Select options={Object.entries(changeLabel).map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item name="subjectType" label="主体类型" rules={[{ required: true }]} style={{ flex: 1 }}><Select options={Object.entries(subjectLabel).map(([value, label]) => ({ value, label }))} /></Form.Item></Space><Space style={{ display: 'flex' }} size={12}><Form.Item name="subjectId" label="主体编号" rules={[{ required: true, message: '请输入主体编号' }]} style={{ flex: 1 }}><Input placeholder="例如 U-TEST-001" /></Form.Item><Form.Item name="subjectName" label="主体名称" rules={[{ required: true, message: '请输入主体名称' }]} style={{ flex: 1 }}><Input /></Form.Item></Space><Form.Item name="roleCode" label="申请角色" rules={[{ required: true }]}><Select options={roleCatalog.map((role) => ({ value: role.code, label: `${role.label} · ${role.code}` }))} /></Form.Item><Form.Item name="scopeSummary" label="数据范围" rules={[{ required: true }]}><Input placeholder="例如：济南市 · 经十路示范走廊" /></Form.Item><Form.Item name="environments" label="可用环境" rules={[{ required: true }]}><Select mode="multiple" options={Object.entries(environmentLabel).map(([value, label]) => ({ value, label }))} /></Form.Item><Space style={{ display: 'flex' }} size={12}><Form.Item name="effectiveFrom" label="生效时间" rules={[{ required: true }]} style={{ flex: 1 }}><Input type="date" /></Form.Item><Form.Item name="expiresAt" label="到期时间" rules={[{ required: true }]} style={{ flex: 1 }}><Input type="date" /></Form.Item></Space><Form.Item name="reasonCode" label="申请原因" rules={[{ required: true }]}><Select options={[{ value: 'ROLE_ASSIGNMENT_REQUIRED', label: '岗位职责需要' }, { value: 'TEMPORARY_ACCESS', label: '临时访问需求' }, { value: 'SCOPE_CHANGE', label: '业务范围变化' }]} /></Form.Item><Form.Item name="justification" label="申请说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字' }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item><Button type="primary" htmlType="submit" loading={mutation.isPending}>{requestMode === 'REVOKE' ? '提交撤销申请' : '提交变更申请'}</Button></Form></>}
    </Drawer>
  </>;
}
