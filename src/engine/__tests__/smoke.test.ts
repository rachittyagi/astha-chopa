import { SCHEMA_VERSION } from '../index';

describe('engine scaffold', () => {
  it('exposes the saved-state schema version', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
