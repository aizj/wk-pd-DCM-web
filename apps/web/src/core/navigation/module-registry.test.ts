import { describe, expect, it } from 'vitest';
import { findNavigationItem, navigationGroups } from './module-registry';

describe('business navigation hierarchy', () => {
  it('recognizes dynamic application and approval routes', () => {
    expect(findNavigationItem('/fr2/requests/REQ-240916-003/submit')?.parentKey).toBe('fr2-p01');
    expect(findNavigationItem('/fr2/approvals/APR-240916-003/decision')?.parentKey).toBe('fr2-p07-queue');
  });

  it('does not expose technical detail pages as top-level tasks', () => {
    expect(findNavigationItem('/fr2/findings/FND-240916-002')?.visible).toBe(false);
    expect(findNavigationItem('/fr2/remediations/REM-240916-001')?.parentKey).toBe('fr2-p01');
  });

  it('shows the full platform module structure and enables delivered read-only slices', () => {
    expect(navigationGroups.filter((group) => group.visible !== false).map((group) => group.key)).toEqual([
      'workbench', 'fr1', 'fr2-request', 'fr2-ops', 'fr3', 'fr4', 'fr5', 'governance',
    ]);
    expect(findNavigationItem('/fr2/subscriptions/SUB-JN-0004')?.parentKey).toBe('fr2-p09');
    expect(findNavigationItem('/fr1/catalog')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr1/catalog')?.permission).toBe('FR1.CATALOG.READ');
    expect(findNavigationItem('/fr1/entitlements')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr1/entitlements')?.permission).toBe('FR1.ENTITLEMENT.READ');
    expect(findNavigationItem('/fr3/configurations')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr3/configurations')?.permission).toBe('FR3.CONFIGURATION.READ');
    expect(findNavigationItem('/fr4/qualifications')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr4/qualifications')?.permission).toBe('FR4.QUALIFICATION.READ');
    expect(findNavigationItem('/fr4/releases')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr4/releases')?.permission).toBe('FR4.RELEASE.READ');
    expect(findNavigationItem('/fr2/subscriptions/SUB-JN-0001/diagnosis')?.permission).toBe('FR2.DIAGNOSIS.READ');
    expect(findNavigationItem('/fr2/subscriptions/SUB-JN-0001/diagnosis')?.parentKey).toBe('fr2-p09');
    expect(findNavigationItem('/fr2/revisions/compare')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr2/revisions/compare')?.permission).toBe('FR2.SUBSCRIPTION.READ');
    expect(findNavigationItem('/fr2/subscriptions/SUB-JN-0001/change')?.permission).toBe('FR2.SUBSCRIPTION.CHANGE');
    expect(findNavigationItem('/fr2/subscriptions/SUB-JN-0001/control')?.permission).toBe('FR2.CONTROL.PLAN');
    expect(findNavigationItem('/fr5/evidence')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr5/evidence')?.permission).toBe('FR5.EVIDENCE.READ');
    expect(findNavigationItem('/fr5/incidents')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr5/incidents')?.permission).toBe('FR5.INCIDENT.READ');
    expect(findNavigationItem('/governance/permissions')?.enabled).not.toBe(false);
    expect(findNavigationItem('/governance/permissions')?.permission).toBe('GOVERNANCE.PERMISSION.READ');
    expect(findNavigationItem('/admin/access')?.parentKey).toBe('access-overview');
    expect(findNavigationItem('/governance/roles')?.permission).toBe('GOVERNANCE.ROLE.READ');
    expect(findNavigationItem('/governance/role-permissions')?.permission).toBe('GOVERNANCE.ROLE.READ');
    expect(findNavigationItem('/governance/authorizations')?.permission).toBe('GOVERNANCE.ROLE.READ');
    expect(findNavigationItem('/governance/permission-catalog')?.permission).toBe('GOVERNANCE.PERMISSION.READ');
    expect(findNavigationItem('/governance/audit')?.enabled).not.toBe(false);
    expect(findNavigationItem('/governance/audit')?.permission).toBe('FR2.AUDIT.READ');
    expect(findNavigationItem('/governance/architecture')?.enabled).not.toBe(false);
    expect(findNavigationItem('/governance/architecture')?.permission).toBe('GOVERNANCE.INTEGRATION.READ');
    expect(findNavigationItem('/governance/architecture')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr2/approvals')?.enabled).not.toBe(false);
    expect(findNavigationItem('/fr2/approvals')?.permission).toBe('FR2.APPROVAL.READ');
    expect(findNavigationItem('/fr2/approvals/APR-240916-001')?.parentKey).toBe('fr2-p07-queue');
    expect(findNavigationItem('/fr2/subscriptions')?.enabled).not.toBe(false);
  });
});
