import { APP_NAME, BUNDLE_ID } from '@/config/app';

describe('app config', () => {
  it('names the app from the single config value (R-I18N-03)', () => {
    expect(APP_NAME).toBe('Astha Chopa');
    expect(BUNDLE_ID).toMatch(/^[a-z]+(\.[a-z]+)+$/);
  });
});
