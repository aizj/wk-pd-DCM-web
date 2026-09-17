import { stateFamilyCount, statesOf, statusLabel, statusTone } from './status-registry';

describe('FR-2 state registry', () => {
  it('keeps the 17 orthogonal state families', () => {
    expect(stateFamilyCount()).toBe(17);
  });

  it('does not invent READY in instance lifecycle', () => {
    expect(statesOf('instanceLifecycle')).not.toContain('READY');
    expect(statesOf('activationReadiness')).toContain('READY');
  });

  it('renders unknown execution facts as risk', () => {
    expect(statusTone('UNKNOWN')).toBe('error');
  });

  it('presents machine states as business-readable Chinese', () => {
    expect(statusLabel('PASS_WITH_CONDITIONS')).toBe('有条件通过');
    expect(statusLabel('PENDING_VERIFY')).toBe('待核验');
    expect(statusLabel('CREATED')).toBe('已创建');
    expect(statusLabel('NOT_CONNECTED')).toBe('未接入');
  });
});
