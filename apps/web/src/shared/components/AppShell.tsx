import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Breadcrumb, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../core/auth/AuthProvider';
import { roleCatalog } from '../../core/auth/permissions';
import { allNavigationItems, findNavigationItem, navigationGroups } from '../../core/navigation/module-registry';

const { Header, Sider, Content } = Layout;
const environmentLabel: Readonly<Record<string, string>> = { SANDBOX: '沙盒环境', TEST: '测试环境', PRODUCTION: '生产环境' };
const roleEntryPath: Readonly<Record<string, string>> = {
  PLATFORM_ADMIN: '/governance/permissions',
  SUBSCRIPTION_OPERATOR: '/workbench',
  APPROVER: '/fr2/approvals',
  OEM_INTEGRATION: '/fr2/requests',
  TEST_OPERATOR: '/fr4/qualifications',
  AUDITOR: '/governance/audit',
};

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [actorMenuOpen, setActorMenuOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const compact = !screens.lg;
  const location = useLocation();
  const navigate = useNavigate();
  const current = findNavigationItem(location.pathname);
  const parent = current?.parentKey ? allNavigationItems.find((item) => item.key === current.parentKey) : undefined;
  const currentGroup = navigationGroups.find((group) => group.items.some((item) => item.key === current?.key));
  const currentGroupKey = currentGroup?.key;
  const [openKeys, setOpenKeys] = useState<string[]>(() => currentGroupKey ? [currentGroupKey] : []);
  const { actor, authorize, availableActors, switchActor, availableEnvironments, switchEnvironment } = useAuth();

  const menuItems = useMemo(() => navigationGroups.filter((group) => group.visible !== false).map((group) => ({
    key: group.key,
    icon: group.icon,
    label: group.label,
    children: group.items
      .filter((item) => item.visible !== false)
      .filter((item) => !item.permission || authorize({ permission: item.permission }).allowed)
      .map((item) => ({
        key: item.key,
        disabled: item.enabled === false,
        label: (
          <span className="menu-label">
            <span>{item.label}</span>
            {item.enabled === false ? <em>建设中</em> : null}
          </span>
        ),
      })),
  })).filter((group) => group.children.length > 0), [actor, authorize]);

  useEffect(() => {
    if (currentGroupKey) setOpenKeys([currentGroupKey]);
  }, [currentGroupKey]);

  const pathByKey = useMemo(() => new Map(
    navigationGroups.flatMap((group) => group.items).map((item) => [item.key, item.path]),
  ), []);

  const selectMenuItem = (key: string) => {
    const path = pathByKey.get(key);
    if (path) navigate(path);
    setMobileMenuOpen(false);
  };

  const selectActor = (actorId: string) => {
    const nextActor = availableActors.find((item) => item.actorId === actorId);
    if (!nextActor || nextActor.actorId === actor.actorId) return;
    switchActor(actorId);
    const nextRole = nextActor.roles[0];
    navigate(nextRole ? roleEntryPath[nextRole] ?? '/workbench' : '/workbench');
  };

  const selectEnvironment = (environment: string) => {
    if (availableEnvironments.includes(environment as typeof actor.environment)) switchEnvironment(environment as typeof actor.environment);
  };

  const actorMenuItems = [
    { key: 'actor-title', type: 'group' as const, label: '切换工作身份', children: availableActors.map((item) => ({
      key: `actor:${item.actorId}`,
      disabled: item.actorId === actor.actorId,
      label: <span className="actor-menu-item"><span><strong>{item.displayName}</strong><small>{item.roles.map((role) => roleCatalog.find((definition) => definition.code === role)?.label ?? role).join('、')}</small></span><em>{environmentLabel[item.environment] ?? item.environment}</em></span>,
    })) },
    { type: 'divider' as const },
    { key: 'environment-title', type: 'group' as const, label: '切换工作环境', children: availableEnvironments.map((environment) => ({
      key: `environment:${environment}`,
      disabled: environment === actor.environment,
      label: <span className="actor-menu-item"><span><strong>{environmentLabel[environment] ?? environment}</strong><small>沿用当前身份权限与数据范围</small></span>{environment === actor.environment ? <em>当前</em> : null}</span>,
    })) },
    { type: 'divider' as const },
    { key: 'actor-context', label: `租户：${actor.tenantId}`, disabled: true },
    { key: 'actor-scope', label: `数据范围：${actor.scopes.filter((scope) => !scope.startsWith('ENV:')).slice(0, 2).join('、') || '按策略计算'}`, disabled: true },
  ];

  const brand = (showCopy: boolean) => <Link className="brand" to="/workbench" aria-label="返回工作台" onClick={() => setMobileMenuOpen(false)}>
    <span className="brand-mark">路</span>
    {showCopy ? <span className="brand-copy"><strong>车路云服务平台</strong><small>济南 · 数据上车运营</small></span> : null}
  </Link>;

  return (
    <Layout className="app-layout">
      {!compact ? <Sider className="app-sider" width={224} collapsedWidth={64} collapsed={collapsed} trigger={null}>
        {brand(!collapsed)}
        <Menu
          mode="inline"
          theme="light"
          items={menuItems}
          selectedKeys={current ? [parent?.key ?? current.key] : []}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          onClick={({ key }) => selectMenuItem(key)}
        />
        {!collapsed ? <div className="sider-version">平台版本 · V0.1</div> : null}
      </Sider> : null}
      <Drawer className="mobile-nav-drawer" placement="left" width={248} open={compact && mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} closable={false} styles={{ body: { padding: 0 } }}>
        {brand(true)}
        <Menu
          mode="inline"
          theme="light"
          items={menuItems}
          selectedKeys={current ? [parent?.key ?? current.key] : []}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          onClick={({ key }) => selectMenuItem(key)}
        />
        <div className="sider-version">平台版本 · V0.1</div>
      </Drawer>
      <Layout>
        <Header className="app-header">
          <Button
            type="text"
            icon={compact || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => compact ? setMobileMenuOpen(true) : setCollapsed((value) => !value)}
            aria-label={compact ? '打开导航' : collapsed ? '展开导航' : '收起导航'}
          />
          <div className="header-context">
            <Breadcrumb
              items={[
                { title: '数据上车服务' },
                ...(currentGroup ? [{ title: currentGroup.label }] : []),
                ...(parent && parent.label !== current?.label ? [{ title: parent.label }] : []),
                { title: current?.label ?? '未知页面' },
              ]}
            />
          </div>
          <Space size={16} className="header-actions">
            <Tag
              className={`environment-tag environment-${actor.environment.toLowerCase()}`}
              title="当前操作环境；高风险操作仍需服务端再次校验"
            >
              {environmentLabel[actor.environment] ?? actor.environment}
            </Tag>
            <Dropdown
              trigger={['click']}
              open={actorMenuOpen}
              onOpenChange={setActorMenuOpen}
              menu={{
                items: actorMenuItems,
                onClick: ({ key }) => {
                  if (key.startsWith('actor:')) selectActor(key.slice('actor:'.length));
                  if (key.startsWith('environment:')) selectEnvironment(key.slice('environment:'.length));
                  setActorMenuOpen(false);
                },
              }}
            >
              <Button
                type="text"
                className="actor-chip"
                aria-label={`切换工作身份，当前为${actor.displayName}，${environmentLabel[actor.environment] ?? actor.environment}`}
              >
                <Avatar size="small" icon={<UserOutlined />} />
                <span><strong>{actor.displayName}</strong><small>{actor.roles.map((role) => roleCatalog.find((definition) => definition.code === role)?.label ?? role).join('、')} · {actor.tenantId}</small></span>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="app-content">
          <div className="content-inner">
            <Outlet />
          </div>
          <footer className="app-footer">
            <Typography.Text type="secondary">数据状态以各业务系统回传为准；平台不在前端推断未确认的订阅或车辆服务结果。</Typography.Text>
          </footer>
        </Content>
      </Layout>
    </Layout>
  );
}
