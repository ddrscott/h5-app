import type { PolicyParams } from './search/sim';
import { DEFAULT_POLICY } from './search/sim';

/**
 * Bot personalities. Each one is the same search (src/client/bots/search/engine.ts) with different
 * dials: how long it thinks, what it's playing for, which moves it leans toward, and how often it
 * slips. The seat badge and the lobby picker read their label, icon and blurb from here.
 */
export type PersonaId = 'shark' | 'regular' | 'hothead' | 'turtle' | 'rookie';

export interface Persona {
  id: PersonaId;
  /** shown on the seat badge */
  label: string;
  /** one line for the tooltip and the lobby */
  blurb: string;
  /** default thinking time per move, in seconds */
  thinkSeconds: number;
  /** share of a fixed rollout allowance it uses (self-play harness and tests) */
  effort: number;
  /** never plays out more games than this per move, however long it's given; keeps the weak ones weak */
  rolloutCap?: number;
  /** what a finish is worth: first out, last holding cards; places between sit near zero */
  winValue: number;
  lastValue: number;
  /** added to a move's value per card it sheds */
  shedBias: number;
  /** added per control card spent (2s, jokers, Heart 5; a bomb counts double); fades as the hand empties */
  controlBias: number;
  /** added to passing */
  passBias: number;
  /** chance of playing a random legal move */
  blunder: number;
  /** picks among near-equal moves at random; 0 always takes the best */
  temperature: number;
  /** remembers what has been played; without it every unseen card might still be out there */
  countsCards: boolean;
  /** grows a search tree under each move, so longer thinking means deeper reading, not just more samples */
  tree: boolean;
  /** looks for locked wins and solves the last duel */
  exact: boolean;
  /** how everyone is assumed to play while it imagines the rest of the game */
  policy: PolicyParams;
}

export const MIN_THINK_SECONDS = 0.2;
export const MAX_THINK_SECONDS = 5;
export const THINK_CHOICES = [0.5, 1, 1.5, 2, 3, 5];

export const PERSONAS: Record<PersonaId, Persona> = {
  shark: {
    id: 'shark',
    label: 'Shark',
    blurb: 'Counts every card and thinks each move through.',
    thinkSeconds: 1.5,
    effort: 1,
    winValue: 1,
    lastValue: -1,
    shedBias: 0,
    controlBias: 0,
    passBias: 0,
    blunder: 0,
    temperature: 0,
    countsCards: true,
    tree: true,
    exact: true,
    policy: DEFAULT_POLICY,
  },
  regular: {
    id: 'regular',
    label: 'Regular',
    blurb: 'A steady player. Thinks a little, misses a little.',
    thinkSeconds: 0.5,
    effort: 0.25,
    rolloutCap: 300,
    winValue: 1,
    lastValue: -1,
    shedBias: 0,
    controlBias: 0,
    passBias: 0,
    blunder: 0.02,
    temperature: 0.06,
    countsCards: true,
    tree: false,
    exact: false,
    policy: DEFAULT_POLICY,
  },
  hothead: {
    id: 'hothead',
    label: 'Hothead',
    blurb: 'Plays big and fast. Burns bombs and the Heart 5 early.',
    thinkSeconds: 0.5,
    effort: 0.4,
    winValue: 1.2,
    lastValue: -0.3,
    shedBias: 0.035,
    controlBias: 0.1,
    passBias: -0.3,
    blunder: 0,
    temperature: 0.03,
    countsCards: true,
    tree: false,
    exact: true,
    policy: { eps: 0.06, premium: 0.8, breakUp: 0.3, bomb: 0.4 },
  },
  turtle: {
    id: 'turtle',
    label: 'Turtle',
    blurb: 'Sits on its best cards and hates coming last.',
    thinkSeconds: 1,
    effort: 0.6,
    winValue: 0.6,
    lastValue: -1.4,
    shedBias: 0,
    controlBias: -0.16,
    passBias: 0.06,
    blunder: 0,
    temperature: 0,
    countsCards: true,
    tree: true,
    exact: true,
    policy: { eps: 0.06, premium: 0.15, breakUp: 0.05, bomb: 0.02 },
  },
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    blurb: 'Still learning. Plays on instinct and slips up.',
    thinkSeconds: 0.3,
    effort: 0.04,
    rolloutCap: 40,
    winValue: 1,
    lastValue: -0.6,
    shedBias: 0.01,
    controlBias: 0.04,
    passBias: -0.05,
    blunder: 0.12,
    temperature: 0.25,
    countsCards: false,
    tree: false,
    exact: false,
    policy: { eps: 0.2, premium: 0.5, breakUp: 0.3, bomb: 0.2 },
  },
};

export const PERSONA_LIST: Persona[] = [PERSONAS.shark, PERSONAS.regular, PERSONAS.hothead, PERSONAS.turtle, PERSONAS.rookie];

export const isPersonaId = (id: unknown): id is PersonaId => typeof id === 'string' && id in PERSONAS;

export function personaOf(id: unknown): Persona | undefined {
  return isPersonaId(id) ? PERSONAS[id] : undefined;
}

/** A thinking time the search will accept. */
export function clampThinkSeconds(seconds: unknown, fallback: number): number {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : fallback;
  return Math.min(MAX_THINK_SECONDS, Math.max(MIN_THINK_SECONDS, s));
}
