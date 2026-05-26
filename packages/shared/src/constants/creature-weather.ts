// ──────────────────────────────────────────────
// Creature Battles — Weather + Terrain Metadata
// ──────────────────────────────────────────────
// Display metadata + mechanical constants for active field effects.
// Multipliers and damage fractions are consumed directly by the engine.
// ──────────────────────────────────────────────
import type { CreatureType, Weather, Terrain } from "../types/creature.js";

export interface WeatherMetadata {
  id: Weather;
  displayName: string;
  emoji: string;
  description: string;
  /** Multipliers applied to specific move types' damage. */
  damageMultipliers: Partial<Record<CreatureType, number>>;
  /** End-of-turn damage as a fraction of max HP, applied to creatures NOT in the immunity list. */
  endOfTurnDamageFraction: number;
  /** Types immune to weather damage tick. */
  damageImmuneTypes: CreatureType[];
}

export const WEATHERS: Record<Weather, WeatherMetadata> = {
  clear: {
    id: "clear",
    displayName: "Clear",
    emoji: "",
    description: "No active weather.",
    damageMultipliers: {},
    endOfTurnDamageFraction: 0,
    damageImmuneTypes: [],
  },
  sun: {
    id: "sun",
    displayName: "Sunny",
    emoji: "☀️",
    description: "Fire-type damage ×1.5. Water-type damage ×0.5.",
    damageMultipliers: { fire: 1.5, water: 0.5 },
    endOfTurnDamageFraction: 0,
    damageImmuneTypes: [],
  },
  rain: {
    id: "rain",
    displayName: "Rain",
    emoji: "🌧️",
    description: "Water-type damage ×1.5. Fire-type damage ×0.5.",
    damageMultipliers: { water: 1.5, fire: 0.5 },
    endOfTurnDamageFraction: 0,
    damageImmuneTypes: [],
  },
  sandstorm: {
    id: "sandstorm",
    displayName: "Sandstorm",
    emoji: "🌪️",
    description: "Non-Rock/Ground/Steel creatures take 1/16 max HP per turn.",
    damageMultipliers: {},
    endOfTurnDamageFraction: 1 / 16,
    damageImmuneTypes: ["rock", "ground", "steel"],
  },
  hail: {
    id: "hail",
    displayName: "Hail",
    emoji: "🌨️",
    description: "Non-Ice creatures take 1/16 max HP per turn.",
    damageMultipliers: {},
    endOfTurnDamageFraction: 1 / 16,
    damageImmuneTypes: ["ice"],
  },
};

export interface TerrainMetadata {
  id: Terrain;
  displayName: string;
  emoji: string;
  description: string;
  /** Multipliers applied to specific move types' damage (grounded attackers only — handled in engine). */
  damageMultipliers: Partial<Record<CreatureType, number>>;
  /** End-of-turn heal as a fraction of max HP, applied to grounded creatures. */
  endOfTurnHealFraction: number;
  /** When true, grounded creatures can't be put to sleep while this terrain is active. */
  blocksSleep: boolean;
  /** When true, grounded creatures are immune to status conditions. */
  blocksAllStatus: boolean;
  /** When true, grounded creatures are immune to priority moves. */
  blocksPriority: boolean;
}

export const TERRAINS: Record<Terrain, TerrainMetadata> = {
  none: {
    id: "none",
    displayName: "No Terrain",
    emoji: "",
    description: "No active terrain.",
    damageMultipliers: {},
    endOfTurnHealFraction: 0,
    blocksSleep: false,
    blocksAllStatus: false,
    blocksPriority: false,
  },
  electric: {
    id: "electric",
    displayName: "Electric Terrain",
    emoji: "⚡",
    description: "Electric-type damage ×1.3 for grounded creatures. Grounded creatures cannot fall asleep.",
    damageMultipliers: { electric: 1.3 },
    endOfTurnHealFraction: 0,
    blocksSleep: true,
    blocksAllStatus: false,
    blocksPriority: false,
  },
  grassy: {
    id: "grassy",
    displayName: "Grassy Terrain",
    emoji: "🌱",
    description: "Grass-type damage ×1.3 for grounded creatures. Grounded creatures heal 1/16 max HP per turn.",
    damageMultipliers: { grass: 1.3 },
    endOfTurnHealFraction: 1 / 16,
    blocksSleep: false,
    blocksAllStatus: false,
    blocksPriority: false,
  },
  misty: {
    id: "misty",
    displayName: "Misty Terrain",
    emoji: "🌫️",
    description: "Dragon-type damage ×0.5 against grounded creatures. Grounded creatures are immune to status conditions.",
    damageMultipliers: { dragon: 0.5 },
    endOfTurnHealFraction: 0,
    blocksSleep: false,
    blocksAllStatus: true,
    blocksPriority: false,
  },
  psychic: {
    id: "psychic",
    displayName: "Psychic Terrain",
    emoji: "🔮",
    description: "Psychic-type damage ×1.3 for grounded creatures. Grounded creatures are immune to priority moves.",
    damageMultipliers: { psychic: 1.3 },
    endOfTurnHealFraction: 0,
    blocksSleep: false,
    blocksAllStatus: false,
    blocksPriority: true,
  },
};
