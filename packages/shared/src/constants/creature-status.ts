// ──────────────────────────────────────────────
// Creature Battles — Status Condition Metadata
// ──────────────────────────────────────────────
// Display metadata + mechanical constants for status conditions.
// The battle engine reads `endOfTurnDamageFraction`, `skipTurnChance`,
// etc. directly from this registry rather than scattering magic numbers.
// ──────────────────────────────────────────────
import type { StatusCondition } from "../types/creature.js";

export interface StatusConditionMetadata {
  id: Exclude<StatusCondition, null>;
  displayName: string;
  emoji: string;
  description: string;
  /** End-of-turn damage as a fraction of max HP. 0 = no damage. */
  endOfTurnDamageFraction: number;
  /** Pre-attack skip-turn chance, 0..1. (For paralysis.) */
  skipTurnChance: number;
  /** True for conditions where the creature might skip multiple turns until cured/escaped. */
  multiTurnLock: boolean;
  /** Multiplier applied to physical Attack stat. 1 = no change. (Burn = 0.5.) */
  physicalAttackMult: number;
}

export const STATUS_CONDITIONS: Record<Exclude<StatusCondition, null>, StatusConditionMetadata> = {
  burn: {
    id: "burn",
    displayName: "Burn",
    emoji: "🔥",
    description: "Takes 1/16 max HP each turn. Physical attack damage is halved.",
    endOfTurnDamageFraction: 1 / 16,
    skipTurnChance: 0,
    multiTurnLock: false,
    physicalAttackMult: 0.5,
  },
  poison: {
    id: "poison",
    displayName: "Poison",
    emoji: "☠️",
    description: "Takes 1/8 max HP each turn.",
    endOfTurnDamageFraction: 1 / 8,
    skipTurnChance: 0,
    multiTurnLock: false,
    physicalAttackMult: 1,
  },
  paralysis: {
    id: "paralysis",
    displayName: "Paralysis",
    emoji: "⚡",
    description: "25% chance to skip the turn. Speed is halved.",
    endOfTurnDamageFraction: 0,
    skipTurnChance: 0.25,
    multiTurnLock: false,
    physicalAttackMult: 1,
  },
  sleep: {
    id: "sleep",
    displayName: "Sleep",
    emoji: "💤",
    description: "Cannot act for 1–3 turns.",
    endOfTurnDamageFraction: 0,
    skipTurnChance: 1,
    multiTurnLock: true,
    physicalAttackMult: 1,
  },
  freeze: {
    id: "freeze",
    displayName: "Freeze",
    emoji: "❄️",
    description: "Cannot act. 20% chance per turn to thaw.",
    endOfTurnDamageFraction: 0,
    skipTurnChance: 1,
    multiTurnLock: true,
    physicalAttackMult: 1,
  },
  confusion: {
    id: "confusion",
    displayName: "Confusion",
    emoji: "❓",
    description: "33% chance to hit self (typeless physical damage) instead of acting.",
    endOfTurnDamageFraction: 0,
    skipTurnChance: 0.33,
    multiTurnLock: false,
    physicalAttackMult: 1,
  },
};
