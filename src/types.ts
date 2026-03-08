export enum Role {
  CIVILIAN = 'CIVILIAN',
  SPY = 'SPY',
  MR_WHITE = 'MR_WHITE'
}

export interface Player {
  id: number;
  name: string;
  role: Role;
  word: string;
  isEliminated: boolean;
  isRevealed: boolean;
}

export interface WordPair {
  civilian: string;
  spy: string;
}

export type GameState = 'SETUP' | 'REVEAL' | 'DISCUSSION' | 'VOTING' | 'RESULT' | 'GAME_OVER';

export enum Type {
  TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED",
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL",
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
