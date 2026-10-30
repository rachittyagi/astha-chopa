// Public bot API. Filled in during M2 (TASK-36).

export const BOT_LEVELS = ['easy', 'medium', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
