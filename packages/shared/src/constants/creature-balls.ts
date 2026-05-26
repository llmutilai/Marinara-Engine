// ──────────────────────────────────────────────
// Creature Battles — Ball Registry
// ──────────────────────────────────────────────
// The 5 ball variants shipped in Phase 1.0. Each entry has a
// `catchMultiplier` that feeds the canonical Gen V+ catch formula.
// `guaranteed: true` skips the RNG entirely (master-ball behavior).
// ──────────────────────────────────────────────
import type { BallType } from "../types/creature.js";

export const BALL_TYPES: BallType[] = [
  {
    id: "pokeball",
    name: "Standard Ball",
    catchMultiplier: 1.0,
    description: "The everyday creature ball.",
  },
  {
    id: "great_ball",
    name: "Great Ball",
    catchMultiplier: 1.5,
    description: "A higher-quality ball with a 1.5× catch rate.",
  },
  {
    id: "ultra_ball",
    name: "Ultra Ball",
    catchMultiplier: 2.0,
    description: "A premium ball with a 2× catch rate.",
  },
  {
    id: "premier_ball",
    name: "Premier Ball",
    catchMultiplier: 1.0,
    description: "Cosmetic-only ball with standard catch rate.",
  },
  {
    id: "master_ball",
    name: "Master Ball",
    catchMultiplier: 255.0,
    description: "Guaranteed catch — never fails.",
    guaranteed: true,
  },
];

/** Convenience lookup map. */
export const BALL_TYPES_BY_ID: Record<string, BallType> = Object.fromEntries(
  BALL_TYPES.map((ball) => [ball.id, ball]),
);
