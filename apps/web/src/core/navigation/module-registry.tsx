import type { ReactNode } from 'react';
import type { PermissionCode } from '@vrc/contracts';
import { matchPath } from 'react-router-dom';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  CloudServerOutlined,
  ControlOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';

export interface NavigationItem {
  key: string;
  label: string;
  path: string;
  permission?: PermissionCode;
  deliveryId?: string;
  visible?: boolean;
  enabled?: boolean;
  parentKey?: string;
  routePattern?: string;
  slice: 'SHELL' | 'S1' | 'S1-F' | 'S2' | 'S3' | 'P1';
}

export interface NavigationGroup {
  key: string;
  label: string;
  icon: ReactNode;
  visible?: boolean;
  items: readonly NavigationItem[];
}

export const navigationGroups: readonly NavigationGroup[] = [
  {
    key: 'workbench',
    label: '运营工作台',
    icon: <DashboardOutlined />,
    items: [
      { key: 'workbench-home', label: '我的工作台', path: '/workbench', permission: 'FR2.WORKBENCH.READ', deliveryId: 'FR2-P15', slice: 'S1' },
    ],
  },
  {
    key: 'fr1',
    label: '服务与授权',
    icon: <AppstoreOutlined />,
    items: [
      { key: 'catalog', label: '服务目录', path: '/fr1/catalog', permission: 'FR1.CATALOG.READ', deliveryId: 'FR1-CATALOG', slice: 'S1' },
      { key: 'entitlements', label: '权益与授权', path: '/fr1/entitlements', permission: 'FR1.ENTITLEMENT.READ', deliveryId: 'FR1-ENTITLEMENT', slice: 'S1' },
      { key: 'partner-onboarding', label: '租户与接入', path: '/fr1/partners', permission: 'FR6.PARTNER.READ', deliveryId: 'FR6-PG07', slice: 'S1' },
      { key: 'endpoint-credentials', label: '端点与凭证', path: '/fr1/endpoints', permission: 'FR6.PARTNER.READ', deliveryId: 'FR6-PG07-C', slice: 'S1' },
    ],
  },
  {
    key: 'fr2-request',
    label: '订阅申请',
    icon: <FileSearchOutlined />,
    items: [
      { key: 'fr2-p01', label: '申请管理', path: '/fr2/requests', permission: 'FR2.REQUEST.READ', deliveryId: 'FR2-P01', slice: 'S1' },
      { key: 'fr2-p02', label: '申请信息', path: '/fr2/requests/new', permission: 'FR2.REQUEST.CREATE', deliveryId: 'FR2-P02', visible: false, parentKey: 'fr2-p01', slice: 'S1' },
      { key: 'fr2-p03', label: '提交申请', path: '/fr2/requests/REQ-240916-003/submit', routePattern: '/fr2/requests/:requestId/submit', permission: 'FR2.REQUEST.SUBMIT', deliveryId: 'FR2-P03', visible: false, parentKey: 'fr2-p01', slice: 'S1' },
      { key: 'fr2-p04', label: '准入检查', path: '/fr2/prechecks/PCR-240916-001', routePattern: '/fr2/prechecks/:runId', permission: 'FR2.PRECHECK.READ', deliveryId: 'FR2-P04', visible: false, parentKey: 'fr2-p01', slice: 'S1' },
      { key: 'fr2-p05', label: '检查项详情', path: '/fr2/findings/FND-240916-001', routePattern: '/fr2/findings/:findingId', permission: 'FR2.PRECHECK.READ', deliveryId: 'FR2-P05', visible: false, parentKey: 'fr2-p01', slice: 'S1' },
      { key: 'fr2-p06', label: '补正任务', path: '/fr2/remediations/REM-240916-001', routePattern: '/fr2/remediations/:caseId', permission: 'FR2.PRECHECK.READ', deliveryId: 'FR2-P06', visible: false, parentKey: 'fr2-p01', slice: 'S1' },
      { key: 'fr2-p07-queue', label: '审批队列', path: '/fr2/approvals', permission: 'FR2.APPROVAL.READ', deliveryId: 'FR2-P07-QUEUE', slice: 'S1' },
      { key: 'fr2-p07', label: '审批处理', path: '/fr2/approvals/APR-240916-001', routePattern: '/fr2/approvals/:caseId', permission: 'FR2.APPROVAL.READ', deliveryId: 'FR2-P07', visible: false, parentKey: 'fr2-p07-queue', slice: 'S1' },
      { key: 'fr2-p08', label: '填写审批意见', path: '/fr2/approvals/APR-240916-001/decision', routePattern: '/fr2/approvals/:caseId/decision', permission: 'FR2.APPROVAL.READ', deliveryId: 'FR2-P08', visible: false, parentKey: 'fr2-p07-queue', slice: 'S1' },
    ],
  },
  {
    key: 'fr2-ops',
    label: '订阅运营',
    icon: <DeploymentUnitOutlined />,
    items: [
      { key: 'fr2-p09', label: '订阅实例', path: '/fr2/subscriptions', permission: 'FR2.SUBSCRIPTION.READ', deliveryId: 'FR2-P09', slice: 'S1' },
      { key: 'fr2-p10', label: '订阅详情', path: '/fr2/subscriptions/SUB-JN-0001', routePattern: '/fr2/subscriptions/:subscriptionId', permission: 'FR2.SUBSCRIPTION.READ', deliveryId: 'FR2-P10', visible: false, parentKey: 'fr2-p09', slice: 'S1' },
      { key: 'fr2-p11', label: '版本比较', path: '/fr2/revisions/compare', permission: 'FR2.SUBSCRIPTION.READ', deliveryId: 'FR2-P11', slice: 'S2' },
      { key: 'fr2-p12', label: '变更与续期', path: '/fr2/subscriptions/SUB-JN-0001/change', routePattern: '/fr2/subscriptions/:subscriptionId/change', permission: 'FR2.SUBSCRIPTION.CHANGE', deliveryId: 'FR2-P12', visible: false, parentKey: 'fr2-p09', slice: 'S2' },
      { key: 'fr2-p13', label: '控制与退出', path: '/fr2/subscriptions/SUB-JN-0001/control', routePattern: '/fr2/subscriptions/:subscriptionId/control', permission: 'FR2.CONTROL.PLAN', deliveryId: 'FR2-P13', visible: false, parentKey: 'fr2-p09', slice: 'S2' },
      { key: 'fr2-p14', label: '运行诊断', path: '/fr2/subscriptions/SUB-JN-0001/diagnosis', routePattern: '/fr2/subscriptions/:subscriptionId/diagnosis', permission: 'FR2.DIAGNOSIS.READ', deliveryId: 'FR2-P14', visible: false, parentKey: 'fr2-p09', slice: 'S1-F' },
    ],
  },
  {
    key: 'fr3',
    label: '参数配置',
    icon: <SettingOutlined />,
    items: [
      { key: 'configs', label: '配置管理', path: '/fr3/configurations', permission: 'FR3.CONFIGURATION.READ', deliveryId: 'FR3-CONFIG', slice: 'S1' },
    ],
  },
  {
    key: 'fr4',
    label: '测试与发布',
    icon: <CloudServerOutlined />,
    items: [
      { key: 'qualification', label: '联合测试', path: '/fr4/qualifications', permission: 'FR4.QUALIFICATION.READ', deliveryId: 'FR4-QUALIFICATION', slice: 'S1' },
      { key: 'release', label: '服务发布', path: '/fr4/releases', permission: 'FR4.RELEASE.READ', deliveryId: 'FR4-RELEASE', slice: 'S1' },
    ],
  },
  {
    key: 'fr5',
    label: '运行监控',
    icon: <ControlOutlined />,
    items: [
      { key: 'evidence', label: '运行与交付证据', path: '/fr5/evidence', permission: 'FR5.EVIDENCE.READ', deliveryId: 'FR5-EVIDENCE', slice: 'S1' },
      { key: 'incidents', label: '事件与工单', path: '/fr5/incidents', permission: 'FR5.INCIDENT.READ', deliveryId: 'FR5-INCIDENT', slice: 'S1' },
    ],
  },
  {
    key: 'governance',
    label: '安全与审计',
    icon: <SafetyCertificateOutlined />,
    items: [
      { key: 'access-overview', label: '访问控制总览', path: '/governance/permissions', permission: 'GOVERNANCE.PERMISSION.READ', deliveryId: 'GOV-ACCESS-OVERVIEW', slice: 'S1' },
      { key: 'admin-access-alias', label: '访问控制总览', path: '/admin/access', permission: 'GOVERNANCE.PERMISSION.READ', visible: false, parentKey: 'access-overview', slice: 'S1' },
      { key: 'roles', label: '角色管理', path: '/governance/roles', permission: 'GOVERNANCE.ROLE.READ', deliveryId: 'GOV-ROLE', slice: 'S1' },
      { key: 'role-permissions', label: '角色权限配置', path: '/governance/role-permissions', permission: 'GOVERNANCE.ROLE.READ', deliveryId: 'GOV-ROLE-PERMISSION', slice: 'S1' },
      { key: 'authorizations', label: '主体授权', path: '/governance/authorizations', permission: 'GOVERNANCE.ROLE.READ', deliveryId: 'GOV-AUTHORIZATION', slice: 'S1' },
      { key: 'access-reviews', label: '访问复核', path: '/governance/access-reviews', permission: 'GOVERNANCE.ACCESS_REVIEW.READ', deliveryId: 'GOV-ACCESS-REVIEW', slice: 'S1' },
      { key: 'permission-catalog', label: '权限目录', path: '/governance/permission-catalog', permission: 'GOVERNANCE.PERMISSION.READ', deliveryId: 'GOV-PERMISSION-CATALOG', slice: 'S1' },
      { key: 'audit', label: '审计查询', path: '/governance/audit', permission: 'FR2.AUDIT.READ', deliveryId: 'GOV-AUDIT', slice: 'S1' },
      { key: 'architecture', label: '对接状态', path: '/governance/architecture', permission: 'GOVERNANCE.INTEGRATION.READ', deliveryId: 'GOV-ARCHITECTURE', slice: 'S1' },
    ],
  },
] as const;

export const allNavigationItems = navigationGroups.flatMap((group) => group.items);

export function findNavigationItem(pathname: string): NavigationItem | undefined {
  return [...allNavigationItems]
    .sort((a, b) => (b.routePattern ?? b.path).length - (a.routePattern ?? a.path).length)
    .find((item) => Boolean(matchPath({ path: item.routePattern ?? item.path, end: true }, pathname)));
}

export const moduleIcons = {
  architecture: <ApartmentOutlined />,
  audit: <AuditOutlined />,
};
