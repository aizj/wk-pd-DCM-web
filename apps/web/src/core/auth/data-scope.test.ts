import { afterEach, describe, expect, it } from 'vitest';
import type { ActorContext } from '@vrc/contracts';
import { actorProfiles, mockActor } from './permissions';
import { filterScoped, setDataScopeContext } from './data-scope';

afterEach(() => setDataScopeContext(null));

describe('data scope context', () => {
  it('filters records by the active environment', () => {
    setDataScopeContext({ ...mockActor, scopes: [...mockActor.scopes, 'ENV:TEST'], environment: 'TEST' });
    const records = filterScoped([
      { id: 'sandbox', environment: 'SANDBOX' as const, oemName: '齐鲁智行汽车' },
      { id: 'test', environment: 'TEST' as const, oemName: '齐鲁智行汽车' },
    ]);
    expect(records.map((item) => item.id)).toEqual(['test']);
  });

  it('keeps OEM records within its tenant while excluding other OEMs', () => {
    const oem = actorProfiles.find((item) => item.actorId === 'U-OEM-QILU-021') as ActorContext;
    setDataScopeContext(oem);
    const records = filterScoped([
      { id: 'qilu', environment: 'TEST' as const, oemName: '齐鲁智行汽车' },
      { id: 'other', environment: 'TEST' as const, oemName: '其他汽车企业' },
    ]);
    expect(records.map((item) => item.id)).toEqual(['qilu']);
  });

  it('does not expose another city tenant to a city operator', () => {
    setDataScopeContext(mockActor);
    const records = filterScoped([
      { id: 'jn', tenantId: 'CITY-JINAN', environment: 'SANDBOX' as const },
      { id: 'qd', tenantId: 'CITY-QINGDAO', environment: 'SANDBOX' as const },
    ]);
    expect(records.map((item) => item.id)).toEqual(['jn']);
  });
});
