import { useState } from 'react';
import { Button, Card, Descriptions, Drawer, Space, Table, Tag, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { RoleDefinition } from '@vrc/contracts';
import { permissionCatalog, roleCatalog } from '../../core/auth/permissions';
import { useAuth } from '../../core/auth/AuthProvider';
import { PageHeader } from '../../shared/components/PageHeader';
import { PermissionGate } from '../../shared/components/PermissionGate';

export function RoleManagementPage() {
  const navigate = useNavigate();
  const { actor } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);

  return <>
    <PageHeader
      eyebrow="安全与审计 / 访问控制"
      title="角色管理"
      description="维护平台内置角色的职责边界和默认权限数量。角色模板是权限配置的基线，主体授权需要在‘主体授权’模块单独办理。"
      badges={[`${roleCatalog.length} 个内置角色`, `当前账号：${actor.displayName}`]}
    />
    <Card title="角色目录" extra={<Typography.Text type="secondary">角色模板不等于用户授权</Typography.Text>}>
      <Table<RoleDefinition>
        rowKey="code"
        dataSource={roleCatalog}
        pagination={false}
        scroll={{ x: 980 }}
        columns={[
          { title: '角色名称', width: 180, render: (_, role) => <div className="configuration-cell"><Typography.Text strong>{role.label}</Typography.Text><small>{role.code}</small></div> },
          { title: '职责说明', dataIndex: 'description', width: 350 },
          { title: '默认权限', width: 110, render: (_, role) => `${role.permissionCodes.length} 项` },
          { title: '默认范围', width: 250, render: (_, role) => <Typography.Text type="secondary">{role.defaultScopes.join('、')}</Typography.Text> },
          { title: '职责分离组', width: 130, render: (_, role) => <Tag>{role.separationOfDutiesGroup ?? '未配置'}</Tag> },
          {
            title: '操作', width: 190, fixed: 'right', render: (_, role) => <Space size={0}>
              <Button type="link" onClick={() => setSelectedRole(role)}>查看详情</Button>
              <PermissionGate permission="GOVERNANCE.ROLE.CONFIGURE" fallback={<Button type="link" disabled>配置权限</Button>}>
                <Button type="link" icon={<SettingOutlined />} onClick={() => navigate(`/governance/role-permissions?role=${role.code}`)}>配置权限</Button>
              </PermissionGate>
            </Space>,
          },
        ]}
      />
    </Card>
    <Drawer title={selectedRole ? `角色详情 · ${selectedRole.label}` : '角色详情'} open={Boolean(selectedRole)} onClose={() => setSelectedRole(null)} width={620}>
      {selectedRole ? <>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="角色编码">{selectedRole.code}</Descriptions.Item>
          <Descriptions.Item label="职责说明">{selectedRole.description}</Descriptions.Item>
          <Descriptions.Item label="默认范围">{selectedRole.defaultScopes.join('、')}</Descriptions.Item>
          <Descriptions.Item label="职责分离组">{selectedRole.separationOfDutiesGroup ?? '未配置'}</Descriptions.Item>
          <Descriptions.Item label="默认权限数量">{selectedRole.permissionCodes.length} 项</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5}>默认权限</Typography.Title>
        <div className="permission-drawer-list">{selectedRole.permissionCodes.map((code) => {
          const definition = permissionCatalog.find((item) => item.code === code);
          return <div key={code}><span>{definition?.label ?? code}</span><Typography.Text type="secondary">{code}</Typography.Text></div>;
        })}</div>
        <PermissionGate permission="GOVERNANCE.ROLE.CONFIGURE" fallback={<Button block disabled style={{ marginTop: 16 }}>当前账号无配置权限</Button>}>
          <Button block type="primary" style={{ marginTop: 16 }} onClick={() => { setSelectedRole(null); navigate(`/governance/role-permissions?role=${selectedRole.code}`); }}>进入权限配置</Button>
        </PermissionGate>
      </> : null}
    </Drawer>
  </>;
}
