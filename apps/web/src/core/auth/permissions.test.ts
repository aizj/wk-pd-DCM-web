import type { ActorContext } from '@vrc/contracts';
import { actorProfiles, authorize, effectivePermissions, mockActor, scopeMatches } from './permissions';

describe('authorize', () => {
  it('requires an explicit permission', () => {
    expect(authorize(mockActor, { permission: 'FR2.CONTROL.PAUSE' })).toEqual({
      allowed: false,
      reason: 'MISSING_PERMISSION',
    });
  });

  it('does not let a frontend permission bypass SoD', () => {
    const approver: ActorContext = {
      ...mockActor,
      roles: ['APPROVER'],
      permissions: new Set([...mockActor.permissions, 'FR2.APPROVAL.DECIDE']),
    };
    expect(authorize(approver, {
      permission: 'FR2.APPROVAL.DECIDE',
      separationOfDutiesPassed: false,
    }).reason).toBe('SOD_CONFLICT');
  });

  it('inherits role permissions while preserving explicit grants', () => {
    expect(effectivePermissions(mockActor).has('GOVERNANCE.PERMISSION.READ')).toBe(true);
    expect(effectivePermissions(mockActor).has('FR2.CONTROL.PAUSE')).toBe(false);
    expect(authorize(mockActor, { permission: 'GOVERNANCE.ROLE.READ' }).allowed).toBe(true);
    expect(authorize(mockActor, { permission: 'GOVERNANCE.ROLE.REQUEST' }).allowed).toBe(true);
    expect(authorize(mockActor, { permission: 'GOVERNANCE.ROLE.MANAGE' }).reason).toBe('MISSING_PERMISSION');
    expect(authorize(mockActor, { permission: 'GOVERNANCE.ROLE.CONFIGURE' }).reason).toBe('MISSING_PERMISSION');
  });

  it('matches hierarchical scopes without treating a sibling city as authorized', () => {
    expect(scopeMatches('FR2:*', 'FR2:APPROVAL')).toBe(true);
    expect(scopeMatches('CITY:JINAN', 'CITY:JINAN')).toBe(true);
    expect(scopeMatches('CITY:JINAN', 'CITY:QINGDAO')).toBe(false);
    expect(authorize(mockActor, { permission: 'FR2.SUBSCRIPTION.READ', requiredScope: 'CITY:QINGDAO' }).reason).toBe('OUT_OF_SCOPE');
  });

  it('enforces tenant, environment, self-action and audit gates', () => {
    expect(authorize(mockActor, { permission: 'FR2.SUBSCRIPTION.READ', resource: { tenantId: 'OTHER-CITY' } }).reason).toBe('TENANT_MISMATCH');
    expect(authorize(mockActor, { permission: 'FR2.SUBSCRIPTION.READ', requiredEnvironment: 'PRODUCTION' }).reason).toBe('ENVIRONMENT_MISMATCH');
    const approver: ActorContext = { ...mockActor, roles: ['APPROVER'], permissions: new Set([...mockActor.permissions, 'FR2.APPROVAL.DECIDE']) };
    expect(authorize(approver, { permission: 'FR2.APPROVAL.DECIDE', subjectActorId: approver.actorId, prohibitSelfAction: true }).reason).toBe('SELF_ACTION');
    expect(authorize(mockActor, { permission: 'FR2.CONTROL.PLAN', auditReasonRequired: true }).reason).toBe('AUDIT_REASON_REQUIRED');
  });

  it('keeps acceptance identities scoped to explicit tenants and environments', () => {
    const admin = actorProfiles.find((item) => item.roles.includes('PLATFORM_ADMIN'))!;
    const approver = actorProfiles.find((item) => item.roles.includes('APPROVER'))!;
    const oem = actorProfiles.find((item) => item.roles.includes('OEM_INTEGRATION'))!;
    expect(authorize(admin, { permission: 'GOVERNANCE.ROLE.CONFIGURE', requiredEnvironment: 'PRODUCTION' }).allowed).toBe(true);
    expect(authorize(approver, { permission: 'FR2.APPROVAL.DECIDE', requiredEnvironment: 'PRODUCTION' }).reason).toBe('ENVIRONMENT_MISMATCH');
    expect(authorize(oem, { permission: 'FR2.REQUEST.CREATE', requiredScope: 'TENANT:OEM-QILU' }).allowed).toBe(true);
    expect(authorize(oem, { permission: 'FR2.REQUEST.CREATE', requiredScope: 'TENANT:OTHER-OEM' }).reason).toBe('OUT_OF_SCOPE');
  });
});
