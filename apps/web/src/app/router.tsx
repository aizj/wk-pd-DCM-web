import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate, Link } from 'react-router-dom';
import type { PermissionCode } from '@vrc/contracts';
import { Result } from 'antd';
import { authorizationReasonLabel } from '../core/auth/permissions';
import { useAuth } from '../core/auth/AuthProvider';
import { AppShell } from '../shared/components/AppShell';
import { WorkbenchPage } from '../features/workbench/WorkbenchPage';
import { RequestWizardPage } from '../features/subscriptions/RequestWizardPage';
import { SubscriptionListPage } from '../features/subscriptions/SubscriptionListPage';
import { SubmissionConfirmPage } from '../features/subscriptions/SubmissionConfirmPage';
import { PrecheckWorkbenchPage } from '../features/subscriptions/PrecheckWorkbenchPage';
import { FindingDetailPage } from '../features/subscriptions/FindingDetailPage';
import { RemediationCasePage } from '../features/subscriptions/RemediationCasePage';
import { ApprovalWorkbenchPage } from '../features/subscriptions/ApprovalWorkbenchPage';
import { ApprovalQueuePage } from '../features/subscriptions/ApprovalQueuePage';
import { ApprovalDecisionPage } from '../features/subscriptions/ApprovalDecisionPage';
import { SubscriptionInstancesPage } from '../features/subscriptions/SubscriptionInstancesPage';
import { SubscriptionDetailPage } from '../features/subscriptions/SubscriptionDetailPage';
import { ConfigurationPage } from '../features/configuration/ConfigurationPage';
import { QualificationPage } from '../features/qualification/QualificationPage';
import { ReleasePage } from '../features/release/ReleasePage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { EntitlementsPage } from '../features/entitlements/EntitlementsPage';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
import { DiagnosisPage } from '../features/diagnosis/DiagnosisPage';
import { RevisionComparePage } from '../features/subscriptions/RevisionComparePage';
import { SubscriptionChangePage } from '../features/subscriptions/SubscriptionChangePage';
import { ControlExitPage } from '../features/subscriptions/ControlExitPage';
import { AccessOverviewPage } from '../features/governance/AccessOverviewPage';
import { RoleManagementPage } from '../features/governance/RoleManagementPage';
import { RolePermissionConfigPage } from '../features/governance/RolePermissionConfigPage';
import { SubjectAuthorizationPage } from '../features/governance/SubjectAuthorizationPage';
import { AccessReviewPage } from '../features/governance/AccessReviewPage';
import { PermissionCatalogPage } from '../features/governance/PermissionCatalogPage';
import { AuditPage } from '../features/governance/AuditPage';
import { ArchitecturePage } from '../features/governance/ArchitecturePage';
import { PartnerOnboardingPage } from '../features/governance/PartnerOnboardingPage';
import { EndpointCredentialPage } from '../features/governance/EndpointCredentialPage';
import { ScaffoldPage, type ScaffoldPageProps } from '../features/scaffold/ScaffoldPage';

function Guarded({ permission, children }: { permission: PermissionCode | undefined; children: ReactElement }) {
  const { authorize } = useAuth();
  if (!permission) return children;
  const decision = authorize({ permission });
  if (decision.allowed) return children;
  return (
    <Result
      status="403"
      title="无权访问"
      subTitle={`当前账号${authorizationReasonLabel(decision.reason)}（${permission}）。前端提示不替代服务端鉴权。`}
      extra={<Link className="ant-btn ant-btn-primary" to="/workbench">返回工作台</Link>}
    />
  );
}

function scaffold(props: ScaffoldPageProps, permission?: PermissionCode) {
  return <Guarded permission={permission}><ScaffoldPage {...props} /></Guarded>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/workbench" replace />,
  },
  {
    element: <AppShell />,
    errorElement: <Result status="500" title="页面加载失败" subTitle="请刷新页面重试；若问题持续，请联系平台管理员。" />,
    children: [
      { path: '/workbench', element: <Guarded permission="FR2.WORKBENCH.READ"><WorkbenchPage /></Guarded> },
      { path: '/fr2/requests', element: <Guarded permission="FR2.REQUEST.READ"><SubscriptionListPage /></Guarded> },
      { path: '/fr2/requests/new', element: <Guarded permission="FR2.REQUEST.CREATE"><RequestWizardPage /></Guarded> },
      { path: '/fr2/requests/:requestId/submit', element: <Guarded permission="FR2.REQUEST.SUBMIT"><SubmissionConfirmPage /></Guarded> },
      { path: '/fr2/prechecks/:runId', element: <Guarded permission="FR2.PRECHECK.READ"><PrecheckWorkbenchPage /></Guarded> },
      { path: '/fr2/findings/:findingId', element: <Guarded permission="FR2.PRECHECK.READ"><FindingDetailPage /></Guarded> },
      { path: '/fr2/remediations/:caseId', element: <Guarded permission="FR2.PRECHECK.READ"><RemediationCasePage /></Guarded> },
      { path: '/fr2/approvals', element: <Guarded permission="FR2.APPROVAL.READ"><ApprovalQueuePage /></Guarded> },
      { path: '/fr2/approvals/:caseId', element: <Guarded permission="FR2.APPROVAL.READ"><ApprovalWorkbenchPage /></Guarded> },
      { path: '/fr2/approvals/:caseId/decision', element: <Guarded permission="FR2.APPROVAL.READ"><ApprovalDecisionPage /></Guarded> },
      { path: '/fr2/subscriptions', element: <Guarded permission="FR2.SUBSCRIPTION.READ"><SubscriptionInstancesPage /></Guarded> },
      { path: '/fr2/subscriptions/:subscriptionId', element: <Guarded permission="FR2.SUBSCRIPTION.READ"><SubscriptionDetailPage /></Guarded> },
      { path: '/fr2/revisions/compare', element: <Guarded permission="FR2.SUBSCRIPTION.READ"><RevisionComparePage /></Guarded> },
      { path: '/fr2/subscriptions/:subscriptionId/change', element: <Guarded permission="FR2.SUBSCRIPTION.CHANGE"><SubscriptionChangePage /></Guarded> },
      { path: '/fr2/subscriptions/:subscriptionId/control', element: <Guarded permission="FR2.CONTROL.PLAN"><ControlExitPage /></Guarded> },
      { path: '/fr2/subscriptions/:subscriptionId/diagnosis', element: <Guarded permission="FR2.DIAGNOSIS.READ"><DiagnosisPage /></Guarded> },
      { path: '/fr1/catalog', element: <Guarded permission="FR1.CATALOG.READ"><CatalogPage /></Guarded> },
      { path: '/fr1/entitlements', element: <Guarded permission="FR1.ENTITLEMENT.READ"><EntitlementsPage /></Guarded> },
      { path: '/fr1/partners', element: <Guarded permission="FR6.PARTNER.READ"><PartnerOnboardingPage /></Guarded> },
      { path: '/fr1/endpoints', element: <Guarded permission="FR6.PARTNER.READ"><EndpointCredentialPage /></Guarded> },
      { path: '/fr3/configurations', element: <Guarded permission="FR3.CONFIGURATION.READ"><ConfigurationPage /></Guarded> },
      { path: '/fr4/qualifications', element: <Guarded permission="FR4.QUALIFICATION.READ"><QualificationPage /></Guarded> },
      { path: '/fr4/releases', element: <Guarded permission="FR4.RELEASE.READ"><ReleasePage /></Guarded> },
      { path: '/fr5/evidence', element: <Guarded permission="FR5.EVIDENCE.READ"><EvidencePage /></Guarded> },
      { path: '/fr5/incidents', element: <Guarded permission="FR5.INCIDENT.READ"><IncidentsPage /></Guarded> },
      { path: '/governance/permissions', element: <Guarded permission="GOVERNANCE.PERMISSION.READ"><AccessOverviewPage /></Guarded> },
      { path: '/admin/access', element: <Guarded permission="GOVERNANCE.PERMISSION.READ"><AccessOverviewPage /></Guarded> },
      { path: '/governance/roles', element: <Guarded permission="GOVERNANCE.ROLE.READ"><RoleManagementPage /></Guarded> },
      { path: '/governance/role-permissions', element: <Guarded permission="GOVERNANCE.ROLE.READ"><RolePermissionConfigPage /></Guarded> },
      { path: '/governance/authorizations', element: <Guarded permission="GOVERNANCE.ROLE.READ"><SubjectAuthorizationPage /></Guarded> },
      { path: '/governance/access-reviews', element: <Guarded permission="GOVERNANCE.ACCESS_REVIEW.READ"><AccessReviewPage /></Guarded> },
      { path: '/governance/permission-catalog', element: <Guarded permission="GOVERNANCE.PERMISSION.READ"><PermissionCatalogPage /></Guarded> },
      { path: '/governance/audit', element: <Guarded permission="FR2.AUDIT.READ"><AuditPage /></Guarded> },
      { path: '/governance/architecture', element: <Guarded permission="GOVERNANCE.INTEGRATION.READ"><ArchitecturePage /></Guarded> },
      { path: '*', element: <Result status="404" title="页面不存在" subTitle="请从左侧导航重新进入。" extra={<Link className="ant-btn ant-btn-primary" to="/workbench">返回工作台</Link>} /> },
    ],
  },
]);
