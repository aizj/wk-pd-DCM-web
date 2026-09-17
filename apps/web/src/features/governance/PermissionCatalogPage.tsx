import { useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Table, Tag, Typography, Input } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { PermissionCode, PermissionDefinition, PermissionRisk } from '@vrc/contracts';
import { authorizationReasonLabel, permissionCatalog, roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { PageHeader } from '../../shared/components/PageHeader';

const riskLabel: Record<PermissionRisk, string> = { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '严重' };
const riskColor: Record<PermissionRisk, string> = { LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', CRITICAL: 'red' };
const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };
const scenarios = [
  { key: 'normal', label: '当前租户 · 当前环境', description: '验证当前账号在当前租户和环境下的常规访问。' },
  { key: 'tenant', label: '其他租户', description: '验证租户隔离规则。' },
  { key: 'production', label: '生产环境', description: '验证当前账号对生产环境的访问边界。' },
  { key: 'state', label: '对象状态不允许', description: '验证对象状态门禁。' },
  { key: 'sod', label: '职责分离冲突', description: '验证审批职责冲突。' },
] as const;

export function PermissionCatalogPage() {
  const navigate = useNavigate();
  const { actor, authorize, effectivePermissions } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [module, setModule] = useState('ALL');
  const [risk, setRisk] = useState<PermissionRisk | 'ALL'>('ALL');
  const [selectedPermission, setSelectedPermission] = useState<PermissionCode>('FR2.APPROVAL.DECIDE');
  const [scenario, setScenario] = useState<(typeof scenarios)[number]['key']>('normal');
  const modules = [...new Set(permissionCatalog.map((item) => item.module))];
  const filtered = permissionCatalog.filter((item) => {
    const normalized = keyword.trim().toLowerCase();
    return (module === 'ALL' || item.module === module) && (risk === 'ALL' || item.risk === risk) && (!normalized || `${item.code} ${item.label} ${item.description}`.toLowerCase().includes(normalized));
  });
  const roleCodes = useMemo(() => new Set(actor.roles.flatMap((role) => roleCatalog.find((item) => item.code === role)?.permissionCodes ?? [])), [actor.roles]);
  const selectedScenario = scenarios.find((item) => item.key === scenario) ?? scenarios[0];
  const selectedScenarioDescription = selectedScenario.key === 'normal'
    ? `验证当前账号在${actor.tenantId} / ${environmentLabel[actor.environment] ?? actor.environment}下的常规访问。`
    : selectedScenario.description;
  const simulation = authorize({ permission: selectedPermission, ...(scenario === 'tenant' ? { resource: { tenantId: 'CITY-QINGDAO' } } : {}), ...(scenario === 'production' ? { requiredEnvironment: 'PRODUCTION' as const } : {}), ...(scenario === 'state' ? { objectStateAllowed: false } : {}), ...(scenario === 'sod' ? { separationOfDutiesPassed: false } : {}) });

  return <>
    <PageHeader eyebrow="安全与审计 / 访问控制" title="权限目录" description="查看系统权限码、风险等级、动作语义和当前账号的有效来源。权限目录只读，角色模板调整请进入‘角色权限配置’。" actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/governance/permissions')}>返回访问控制总览</Button>} badges={[`${permissionCatalog.length} 项权限`, `当前有效 ${effectivePermissions.size} 项`]} />
    <Card title="权限清单" extra={<Space wrap><Input.Search allowClear placeholder="搜索权限码或说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 240 }} /><Select value={module} onChange={setModule} options={[{ value: 'ALL', label: '全部模块' }, ...modules.map((item) => ({ value: item, label: item }))]} style={{ width: 140 }} /><Select value={risk} onChange={setRisk} options={[{ value: 'ALL', label: '全部风险' }, ...Object.entries(riskLabel).map(([value, label]) => ({ value, label }))]} style={{ width: 120 }} /></Space>}>
      <Table<PermissionDefinition> rowKey="code" dataSource={filtered} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} columns={[{ title: '权限', width: 280, render: (_, item) => <div className="configuration-cell"><Typography.Text strong>{item.label}</Typography.Text><small>{item.code}</small></div> }, { title: '模块 / 动作', width: 170, render: (_, item) => `${item.module} / ${item.action}` }, { title: '风险', width: 80, render: (_, item) => <Tag color={riskColor[item.risk]}>{riskLabel[item.risk]}</Tag> }, { title: '当前账号', width: 120, render: (_, item) => effectivePermissions.has(item.code) ? <Space size={4}><Tag color="green">已授予</Tag><Typography.Text type="secondary">{roleCodes.has(item.code) ? '角色继承' : '显式授权'}</Typography.Text></Space> : <Tag>未授予</Tag> }, { title: '说明', dataIndex: 'description' }]} />
    </Card>
    <Card title="权限决策模拟" extra={<Tag color="blue">只读</Tag>}>
      <Space wrap className="permission-filter-row"><Select aria-label="模拟权限" value={selectedPermission} onChange={setSelectedPermission} options={permissionCatalog.map((item) => ({ value: item.code, label: `${item.label} · ${item.code}` }))} style={{ minWidth: 320 }} /><Select aria-label="模拟条件" value={scenario} onChange={setScenario} options={scenarios.map((item) => ({ value: item.key, label: item.label }))} style={{ minWidth: 220 }} /></Space>
      <Alert type={simulation.allowed ? 'success' : 'warning'} showIcon title={simulation.allowed ? '策略允许' : `策略拒绝：${authorizationReasonLabel(simulation.reason)}`} description={selectedScenarioDescription} style={{ marginTop: 16 }} />
      <Typography.Paragraph type="secondary">决策顺序：权限码 → 租户 → 数据范围 → 环境 → 对象状态 → 职责分离 → 自处理限制 → 审计原因。</Typography.Paragraph>
    </Card>
  </>;
}
