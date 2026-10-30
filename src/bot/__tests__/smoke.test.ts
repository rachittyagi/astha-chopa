import { BOT_LEVELS } from '../index';

describe('bot scaffold', () => {
  it('lists the three bot levels', () => {
    expect(BOT_LEVELS).toEqual(['easy', 'medium', 'hard']);
  });
});
