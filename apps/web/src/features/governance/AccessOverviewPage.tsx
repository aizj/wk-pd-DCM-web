import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { ApartmentOutlined, ArrowRightOutlined, InfoCircleOutlined, SafetyCertificateOutlined, TeamOutlined, UserSwitchOutlined, AppstoreOutlined, AuditOutlined, HistoryOutlined } from '@ant-design/icons';
import { permissionCatalog, roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { PageHeader } from '../../shared/components/PageHeader';

const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };
const environmentShortLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒', TEST: '测试', PRODUCTION: '生产' };

const modules = [
  { key: 'roles', title: '角色管理', description: '维护角色模板、职责组、默认数据范围和角色边界。', path: '/governance/roles', permission: 'GOVERNANCE.ROLE.READ' as const, icon: <TeamOutlined /> },
  { key: 'role-permissions', title: '角色权限配置', description: '按角色维护功能权限矩阵，形成草稿并提交审批发布。', path: '/governance/role-permissions', permission: 'GOVERNANCE.ROLE.READ' as const, icon: <SafetyCertificateOutlined /> },
  { key: 'authorizations', title: '主体授权', description: '管理用户、服务账号和组织的角色授权、范围、环境和有效期。', path: '/governance/authorizations', permission: 'GOVERNANCE.ROLE.READ' as const, icon: <UserSwitchOutlined /> },
  { key: 'access-reviews', title: '访问复核', description: '按租户、环境、资源和数据分类复核访问是否仍然必要。', path: '/governance/access-reviews', permission: 'GOVERNANCE.ACCESS_REVIEW.READ' as const, icon: <HistoryOutlined /> },
  { key: 'permission-catalog', title: '权限目录', description: '查看功能、数据和操作权限码及其风险等级、业务说明。', path: '/governance/permission-catalog', permission: 'GOVERNANCE.PERMISSION.READ' as const, icon: <AppstoreOutlined /> },
  { key: 'audit', title: '审计查询', description: '检索权限决策、授权变更和关键业务操作证据。', path: '/governance/audit', permission: 'FR2.AUDIT.READ' as const, icon: <AuditOutlined /> },
  { key: 'architecture', title: '对接状态', description: '查看平台、车企、车端和审计系统的数据域接入状态。', path: '/governance/architecture', permission: 'GOVERNANCE.INTEGRATION.READ' as const, icon: <ApartmentOutlined /> },
] as const;

export function AccessOverviewPage() {
  const navigate = useNavigate();
  const { actor, authorize, effectivePermissions } = useAuth();
  const canConfigureRoles = authorize({ permission: 'GOVERNANCE.ROLE.CONFIGURE' }).allowed;
  const canRequestRoleChange = authorize({ permission: 'GOVERNANCE.ROLE.REQUEST' }).allowed;

  return <>
    <PageHeader
      eyebrow="安全与审计"
      title="访问控制总览"
      description="从总览进入角色、权限、主体授权、对接状态和审计模块；实际访问始终由服务端按租户、环境、数据范围和职责分离重新校验。"
      badges={[canConfigureRoles ? '角色配置 · 可编辑' : '角色配置 · 只读', canRequestRoleChange ? '授权申请 · 可提交' : '授权申请 · 不可用']}
    />

    <div className="data-notice"><InfoCircleOutlined /><span>角色模板决定默认权限，主体授权决定谁在什么范围和环境可用；角色权限配置、主体授权和权限申请均需审批后才可能生效。</span></div>

    <div className="configuration-overview permission-overview" aria-label="访问控制概览">
      <div><span>权限码</span><strong>{permissionCatalog.length}</strong><small>项</small></div>
      <div><span>当前有效</span><strong>{effectivePermissions.size}</strong><small>项</small></div>
      <div><span>角色模板</span><strong>{roleCatalog.length}</strong><small>个</small></div>
      <div><span>绑定角色</span><strong>{actor.roles.length}</strong><small>个</small></div>
      <div><span>当前环境</span><strong>{environmentShortLabel[actor.environment] ?? actor.environment}</strong><small>环境</small></div>
    </div>

    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card title="当前账号" extra={<Tag color="blue">{actor.actorId}</Tag>}>
        <Descriptions column={{ xs: 1, md: 2, xl: 4 }} size="small">
          <Descriptions.Item label="显示名称">{actor.displayName}</Descriptions.Item>
          <Descriptions.Item label="租户">{actor.tenantId}</Descriptions.Item>
          <Descriptions.Item label="当前环境">{environmentLabel[actor.environment] ?? actor.environment}</Descriptions.Item>
          <Descriptions.Item label="角色">{actor.roles.map((role) => roleCatalog.find((item) => item.code === role)?.label ?? role).join('、')}</Descriptions.Item>
          <Descriptions.Item label="职责分离">{actor.roles.map((role) => roleCatalog.find((item) => item.code === role)?.separationOfDutiesGroup).filter(Boolean).join('、') || '未配置'}（默认通过）</Descriptions.Item>
          <Descriptions.Item label="数据范围" span={3}>{actor.scopes.join('、')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="访问控制模块" extra={<Typography.Text type="secondary">按职责进入独立管理页面</Typography.Text>}>
        <div className="access-module-grid">
          {modules.map((module) => {
            const decision = authorize({ permission: module.permission });
            return <div className="access-module-card" key={module.key}>
              <div className="access-module-icon">{module.icon}</div>
              <div className="access-module-content"><Typography.Text strong>{module.title}</Typography.Text><Typography.Paragraph>{module.description}</Typography.Paragraph></div>
              <div className="access-module-footer"><Tag color={decision.allowed ? 'green' : 'default'}>{decision.allowed ? '可访问' : '无权访问'}</Tag><Button type="link" disabled={!decision.allowed} onClick={() => navigate(module.path)}>进入模块 <ArrowRightOutlined /></Button></div>
            </div>;
          })}
        </div>
      </Card>

      <Alert type="info" showIcon title="权限边界" description="平台管理员可以维护角色权限模板，但不能因此自动获得业务审批或车辆控制权限；生产环境权限必须绑定明确范围、有效期和职责分离校验。" />
    </Space>
  </>;
}
