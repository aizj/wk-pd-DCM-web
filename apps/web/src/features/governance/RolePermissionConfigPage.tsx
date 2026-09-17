import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Descriptions, Form, Input, Result, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PermissionCode, PermissionDefinition, RolePermissionConfigChangeInput, RolePermissionConfigChangeReceipt } from '@vrc/contracts';
import { permissionCatalog, roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { subscriptionGateway } from '../../core/data/subscription-gateway';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';
import { StateBoundary } from '../../shared/components/StateBoundary';

const riskLabel = { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '严重' } as const;
const riskColor = { LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', CRITICAL: 'red' } as const;
const reasonLabel: Record<RolePermissionConfigChangeInput['reasonCode'], string> = {
  FUNCTION_CHANGE: '业务功能调整', LEAST_PRIVILEGE: '最小权限收敛', COMPLIANCE_REVIEW: '合规复核整改', EMERGENCY_RESTRICTION: '紧急权限收缩',
};
const reasonOptions = Object.entries(reasonLabel).map(([value, label]) => ({ value, label }));
type ConfigForm = Pick<RolePermissionConfigChangeInput, 'reasonCode' | 'justification'>;

function configErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return ({
    PERMISSION_DENIED: '当前账号缺少角色权限配置权限，请联系平台管理员。',
    IDEMPOTENCY_KEY_CONFLICT: '请求流水号已用于其他配置申请，请重新选择角色后重试。',
    ROLE_PERMISSION_CONFIG_CHANGE_INPUT_INVALID: '配置差异、变更原因或说明不完整，请检查后重试。',
  } as Record<string, string>)[code] ?? '角色权限配置申请提交失败，请稍后重试。';
}

export function RolePermissionConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { actor, authorize } = useAuth();
  const canConfigure = authorize({ permission: 'GOVERNANCE.ROLE.CONFIGURE' }).allowed;
  const fallbackRole = roleCatalog[0]!;
  const initialRole = roleCatalog.find((item) => item.code === searchParams.get('role')) ?? fallbackRole;
  const [roleCode, setRoleCode] = useState(initialRole.code);
  const role = roleCatalog.find((item) => item.code === roleCode) ?? fallbackRole;
  const [permissionCodes, setPermissionCodes] = useState<ReadonlySet<PermissionCode>>(new Set(role.permissionCodes));
  const [permissionKeyword, setPermissionKeyword] = useState('');
  const [permissionModule, setPermissionModule] = useState('ALL');
  const [permissionRisk, setPermissionRisk] = useState<PermissionDefinition['risk'] | 'ALL'>('ALL');
  const [receipt, setReceipt] = useState<RolePermissionConfigChangeReceipt | null>(null);
  const [form] = Form.useForm<ConfigForm>();
  const sequence = useRef(1);
  const idempotencyKey = useRef(`ROLE-CONFIG-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`);
  useEffect(() => {
    idempotencyKey.current = `ROLE-CONFIG-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
  }, [actor.actorId, actor.environment]);
  const requestsQuery = useQuery({ queryKey: ['role-permission-config-change-requests'], queryFn: () => subscriptionGateway.listRolePermissionConfigChangeRequests() });
  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      return subscriptionGateway.requestRolePermissionConfigChange({ roleCode: role.code, basePermissionCodes: role.permissionCodes, permissionCodes: [...permissionCodes], reasonCode: values.reasonCode, justification: values.justification }, idempotencyKey.current);
    },
    onSuccess: (nextReceipt) => { setReceipt(nextReceipt); void requestsQuery.refetch(); },
  });
  const added = useMemo(() => [...permissionCodes].filter((code) => !role.permissionCodes.includes(code)), [permissionCodes, role.permissionCodes]);
  const removed = useMemo(() => role.permissionCodes.filter((code) => !permissionCodes.has(code)), [permissionCodes, role.permissionCodes]);
  const permissionModules = useMemo(() => [...new Set(permissionCatalog.map((item) => item.module))], []);
  const filteredPermissions = useMemo(() => {
    const normalized = permissionKeyword.trim().toLowerCase();
    return permissionCatalog.filter((item) => (
      (permissionModule === 'ALL' || item.module === permissionModule)
      && (permissionRisk === 'ALL' || item.risk === permissionRisk)
      && (!normalized || `${item.code} ${item.label} ${item.description}`.toLowerCase().includes(normalized))
    ));
  }, [permissionKeyword, permissionModule, permissionRisk]);
  const allFilteredSelected = filteredPermissions.length > 0 && filteredPermissions.every((item) => permissionCodes.has(item.code));
  const roleRequests = (requestsQuery.data?.items ?? []).filter((item) => item.roleCode === role.code);

  function changeRole(nextRoleCode: string) {
    const nextRole = roleCatalog.find((item) => item.code === nextRoleCode) ?? fallbackRole;
    setRoleCode(nextRole.code); setPermissionCodes(new Set(nextRole.permissionCodes)); setReceipt(null); mutation.reset(); form.resetFields();
    sequence.current += 1; idempotencyKey.current = `ROLE-CONFIG-${actor.actorId}-${actor.environment}-${String(sequence.current).padStart(2, '0')}`;
  }

  return <>
    <PageHeader eyebrow="安全与审计 / 访问控制" title="角色权限配置" description="按角色维护功能权限映射。配置提交后只生成待审批草稿，审批、发布完成前不改变角色模板和当前有效权限。" actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/governance/permissions')}>返回访问控制总览</Button>} badges={[canConfigure ? '当前账号可提交配置申请' : '当前账号只读', `当前角色：${role.label}`]} />
    <div className="data-notice"><InfoCircleOutlined /><span>数据范围、环境、对象状态和职责分离不是角色权限矩阵字段，仍由运行时授权策略逐项校验。</span></div>
    <Card title="配置对象" extra={<Tag color={canConfigure ? 'green' : 'default'}>{canConfigure ? '可编辑草稿' : '只读查看'}</Tag>}>
      <Space wrap>
        <Typography.Text strong>角色</Typography.Text>
        <Select value={role.code} onChange={changeRole} options={roleCatalog.map((item) => ({ value: item.code, label: `${item.label} · ${item.code}` }))} style={{ minWidth: 300 }} />
        <Typography.Text type="secondary">职责组：{role.separationOfDutiesGroup ?? '未配置'} · 默认范围：{role.defaultScopes.join('、')}</Typography.Text>
      </Space>
    </Card>
    <Card title="功能权限矩阵" extra={<Typography.Text type="secondary">草稿 {permissionCodes.size} / {permissionCatalog.length} 项</Typography.Text>}>
      <Space wrap className="permission-config-toolbar">
        <Input.Search allowClear placeholder="搜索权限码、名称或说明" value={permissionKeyword} onChange={(event) => setPermissionKeyword(event.target.value)} />
        <Select aria-label="权限模块" value={permissionModule} onChange={setPermissionModule} options={[{ value: 'ALL', label: '全部模块' }, ...permissionModules.map((item) => ({ value: item, label: item }))]} />
        <Select aria-label="权限风险" value={permissionRisk} onChange={setPermissionRisk} options={[{ value: 'ALL', label: '全部风险' }, ...Object.entries(riskLabel).map(([value, label]) => ({ value, label }))]} />
        <Button disabled={!canConfigure || filteredPermissions.length === 0} onClick={() => setPermissionCodes((old) => {
          const next = new Set(old);
          filteredPermissions.forEach((item) => next.add(item.code));
          return next;
        })}>启用当前筛选</Button>
        <Button disabled={!canConfigure || filteredPermissions.length === 0} onClick={() => setPermissionCodes((old) => {
          const next = new Set(old);
          filteredPermissions.forEach((item) => next.delete(item.code));
          return next;
        })}>移除当前筛选</Button>
        <Typography.Text type="secondary">当前筛选 {filteredPermissions.length} 项 · 已选 {filteredPermissions.filter((item) => permissionCodes.has(item.code)).length} 项</Typography.Text>
      </Space>
      <Table<PermissionDefinition> rowKey="code" dataSource={filteredPermissions} pagination={false} size="small" scroll={{ x: 1040, y: 500 }} locale={{ emptyText: '暂无匹配的权限' }} columns={[
        { title: <Checkbox checked={allFilteredSelected} indeterminate={!allFilteredSelected && filteredPermissions.some((item) => permissionCodes.has(item.code))} disabled={!canConfigure || filteredPermissions.length === 0} onChange={(event) => setPermissionCodes((old) => { const next = new Set(old); filteredPermissions.forEach((item) => event.target.checked ? next.add(item.code) : next.delete(item.code)); return next; })}>启用</Checkbox>, width: 82, render: (_, item) => <Checkbox aria-label={`启用${item.label}`} checked={permissionCodes.has(item.code)} disabled={!canConfigure} onChange={(event) => setPermissionCodes((old) => { const next = new Set(old); event.target.checked ? next.add(item.code) : next.delete(item.code); return next; })} /> },
        { title: '权限', width: 270, render: (_, item) => <div className="configuration-cell"><Typography.Text>{item.label}</Typography.Text><small>{item.code}</small></div> },
        { title: '模块 / 动作', width: 160, render: (_, item) => `${item.module} / ${item.action}` },
        { title: '风险', width: 80, render: (_, item) => <Tag color={riskColor[item.risk]}>{riskLabel[item.risk]}</Tag> },
        { title: '说明', dataIndex: 'description' },
      ]} />
    </Card>
    {!canConfigure ? <Form form={form} component={false} /> : null}
    <PermissionGate permission="GOVERNANCE.ROLE.CONFIGURE" fallback={<Alert type="warning" showIcon title="当前账号无角色权限配置权限" description="你可以查看矩阵和历史申请，但不能提交配置变更。请联系平台管理员处理。" />}>
      {receipt ? <Card title="申请回执"><Result status="info" title="配置申请已进入待审批" subTitle="审批和发布完成前不会修改有效权限。" extra={<Button onClick={() => setReceipt(null)}>继续配置</Button>}><Descriptions bordered column={1} size="small"><Descriptions.Item label="申请编号">{receipt.configRequestId}</Descriptions.Item><Descriptions.Item label="角色">{role.label} · {receipt.roleCode}</Descriptions.Item><Descriptions.Item label="权限差异">新增 {receipt.addedPermissionCodes.length} 项，移除 {receipt.removedPermissionCodes.length} 项</Descriptions.Item><Descriptions.Item label="原因">{reasonLabel[receipt.reasonCode]}</Descriptions.Item><Descriptions.Item label="说明">{receipt.justification}</Descriptions.Item><Descriptions.Item label="下一步">{receipt.nextStep}</Descriptions.Item></Descriptions></Result></Card> : <Card title="提交配置申请"><Form form={form} layout="vertical" onFinish={() => mutation.mutate()} initialValues={{ reasonCode: 'FUNCTION_CHANGE' }}>
        {mutation.isError ? <Alert type="error" showIcon title="配置申请提交失败" description={configErrorMessage(mutation.error)} className="section-gap-bottom" /> : null}
        <Space size={16} style={{ display: 'flex' }}><Form.Item name="reasonCode" label="变更原因" rules={[{ required: true, message: '请选择变更原因' }]} style={{ flex: 1 }}><Select options={reasonOptions} /></Form.Item><Form.Item label="本次差异" style={{ flex: 1 }}><Typography.Text type="secondary">新增 {added.length} 项 · 移除 {removed.length} 项</Typography.Text></Form.Item></Space>
        <Form.Item name="justification" label="变更说明" rules={[{ required: true, min: 10, message: '请填写不少于10个字的变更说明' }]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="说明业务目的、影响范围、风险控制和审批依据" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={permissionCodes.size === 0 || (added.length === 0 && removed.length === 0)}>提交配置申请</Button>
      </Form></Card>}
    </PermissionGate>
    <Card title="配置申请历史" extra={<Typography.Text type="secondary">仅展示申请记录，不代表已生效</Typography.Text>}>
      <StateBoundary state={requestsQuery.isPending ? 'loading' : requestsQuery.isError ? 'error' : roleRequests.length ? 'ready' : 'empty'} emptyTitle="暂无配置申请" onRetry={() => void requestsQuery.refetch()}>
        <Table rowKey="configRequestId" dataSource={roleRequests} pagination={{ pageSize: 5 }} scroll={{ x: 920 }} columns={[{ title: '申请编号', dataIndex: 'configRequestId' }, { title: '角色', render: () => role.label }, { title: '状态', render: () => <Tag color="blue">待审批</Tag> }, { title: '差异', render: (_, item) => `新增 ${item.addedPermissionCodes.length} / 移除 ${item.removedPermissionCodes.length}` }, { title: '提交时间', dataIndex: 'submittedAt' }, { title: '原因', render: (_, item) => reasonLabel[item.reasonCode] }]} />
      </StateBoundary>
    </Card>
  </>;
}
