# Creature Battles — Phase 1.0 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all shared types, constants, and the new `creature_species` DB table for the Creature Battles feature, with zero user-visible behavior change. After this PR, no UI, no service, no agent registration — just the data foundation that Phases 1.1–1.4 will build on.

**Architecture:** Pure additive change. One new shared types file (`creature.ts`), seven new shared constants files (type chart, status/weather/terrain metadata, moves, held items, balls, bag-item presets), one new Drizzle schema file (`creatures.ts`), plus optional field additions to existing `Persona`, `CharacterExtensions`, `InventoryItem`, and `AgentResultType`. Validation per task is `pnpm check`; final validation adds `pnpm db:push`. No tests yet — `vitest` arrives in Phase 1.2.

**Tech Stack:** TypeScript, pnpm workspaces, Drizzle ORM (SQLite). See `CLAUDE.md` for project conventions.

**Spec:** `docs/superpowers/specs/2026-05-25-creature-battles-design.md`

**Branch:** `feature/creature-battles` (already created; off `staging`)

**Phase boundary discipline:** This phase ONLY adds data definitions. Do NOT add services, routes, agents, prompt templates, UI components, or tests. Those land in later phases.

---

## File map

**Create:**
- `packages/shared/src/types/creature.ts` — all Creature Battles types
- `packages/shared/src/constants/creature-types.ts` — 18×18 type effectiveness chart
- `packages/shared/src/constants/creature-status.ts` — status condition metadata
- `packages/shared/src/constants/creature-weather.ts` — weather + terrain metadata
- `packages/shared/src/constants/creature-moves.ts` — starter move registry (40 moves)
- `packages/shared/src/constants/creature-items.ts` — held items registry (15 items)
- `packages/shared/src/constants/creature-balls.ts` — ball registry (5 balls)
- `packages/shared/src/constants/creature-inventory-presets.ts` — bag-item starter presets (10 entries)
- `packages/server/src/db/schema/creatures.ts` — `creature_species` Drizzle table

**Modify:**
- `packages/shared/src/index.ts` — barrel-export new types and constants
- `packages/shared/src/types/persona.ts` — add `creatureRoster?`, `creatureBox?`
- `packages/shared/src/types/character.ts` — add `creatureRoster?`, `aiPersonality?` to `CharacterExtensions`
- `packages/shared/src/types/game-state.ts` — add `creatureBattleEffect?` to `InventoryItem`
- `packages/shared/src/types/agent.ts` — add 3 new values to `AgentResultType` union
- `packages/server/src/db/schema/index.ts` — barrel-export `creatures.ts`

---

## Task 1: Shared types — `creature.ts`

**Files:**
- Create: `packages/shared/src/types/creature.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the shared types file with all enums and core interfaces**

Create `packages/shared/src/types/creature.ts` with this exact content:

```ts
// ──────────────────────────────────────────────
// Creature Battles — Shared Types
// ──────────────────────────────────────────────
// All types for the Pokemon-style Creature Battles feature.
// See docs/superpowers/specs/2026-05-25-creature-battles-design.md
// for the full design rationale.
// ──────────────────────────────────────────────

// ── Enums ──────────────────────────────────────

/** All creature types. Mechanically generic — type names are unencumbered. */
export type CreatureType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

export type MoveCategory = "physical" | "special" | "status";

/** Persistent status conditions on a creature. `null` = no status. */
export type StatusCondition =
  | null
  | "burn"
  | "poison"
  | "paralysis"
  | "sleep"
  | "freeze"
  | "confusion";

export type Weather = "clear" | "sun" | "rain" | "sandstorm" | "hail";

export type Terrain = "none" | "electric" | "grassy" | "misty" | "psychic";

export type EvolutionTrigger =
  | { kind: "level"; level: number }
  | { kind: "item"; itemId: string };

export type StatKey = "hp" | "atk" | "def" | "spAtk" | "spDef" | "speed";

export type AiPersonality = "aggressive" | "defensive" | "balanced";

export type BattleFormat = "single" | "double";

export type BattleResult = "victory" | "defeat" | "fled" | "interrupted";

// ── Stats ──────────────────────────────────────

/** Base or computed stats for a creature. */
export interface CreatureStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

// ── Species (template — new top-level entity) ──

/** A creature species: template data shared across all instances of that species. */
export interface CreatureSpecies {
  id: string;
  name: string;
  description: string;
  /** 1 or 2 types. */
  types: [CreatureType] | [CreatureType, CreatureType];
  baseStats: CreatureStats;
  /** Canonical catch-rate scale 1..255 (lower = harder to catch). */
  catchRate: number;
  xpCurve: "fast" | "medium" | "slow";
  learnableMoves: LearnableMove[];
  evolution?: { trigger: EvolutionTrigger; toSpeciesId: string };
  spritePath: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LearnableMove {
  moveId: string;
  /** Level at which this move is learned. 0 = known at level 1. */
  learnLevel: number;
}

// ── Moves (static registry) ────────────────────

/** A move definition (immutable; sourced from constants/creature-moves.ts). */
export interface Move {
  id: string;
  name: string;
  type: CreatureType;
  category: MoveCategory;
  /** 0 for status moves. */
  power: number;
  /** 0..100. */
  accuracy: number;
  /** Tie-breaker on speed; default 0. Range -7..+5. */
  priority: number;
  description: string;
  /** Optional secondary effect: inflict a status condition. */
  statusInflict?: { condition: Exclude<StatusCondition, null>; chance: number };
  /** Optional secondary effect: change a stat stage. */
  statStageChange?: { target: "self" | "opponent"; stat: StatKey; delta: number; chance: number };
  /** Optional: set field weather. */
  weatherSet?: Weather;
  /** Optional: set field terrain. */
  terrainSet?: Terrain;
  /** 0 = normal crit chance (1/24); 1 = high crit (1/8). */
  critRatio?: number;
}

// ── Held items (static registry) ───────────────

export interface HeldItem {
  id: string;
  name: string;
  description: string;
  trigger:
    | "passive"
    | "on_attack"
    | "on_hit"
    | "end_of_turn"
    | "on_low_hp"
    | "on_switch_in";
  effectKind:
    | "heal"
    | "damage_mod"
    | "stat_mod"
    | "survive_ko"
    | "speed_mod"
    | "lock_move";
  /** Effect-kind-specific. For heal: HP fraction of max. For damage_mod: multiplier. */
  amount?: number;
  /** Effect-kind-specific. For on_low_hp triggers: HP fraction threshold. */
  threshold?: number;
  /** When defined, the effect only applies to moves of this type. */
  affectedType?: CreatureType;
}

// ── Balls (static registry) ────────────────────

export interface BallType {
  id: string;
  name: string;
  /** Multiplier into the canonical catch formula. */
  catchMultiplier: number;
  description: string;
  /** Master-ball-style guaranteed catch (skips RNG). */
  guaranteed?: boolean;
}

// ── Bag item / inventory effect ────────────────

/** Typed mechanical effect for a bag item used in Creature Battles. Lives as an
 *  optional field on the existing PlayerStats.inventory items (see game-state.ts).
 *  When absent on an InventoryItem, the item is narrative-only and is interpreted
 *  by the LLM via the modal's free-text input (matches existing Encounter behavior). */
export type CreatureBattleEffect =
  | { kind: "heal"; amount: number; isPercentage: boolean }
  | { kind: "cure_status"; statuses: Exclude<StatusCondition, null>[] }
  | { kind: "revive"; restoreFraction: number }
  | { kind: "ball"; ballTypeId: string }
  | { kind: "stat_stage"; stat: StatKey; delta: number };

// ── Roster instances (per-trainer state) ───────

/** A specific creature in a trainer's roster. Lives on Persona.creatureRoster
 *  or CharacterExtensions.creatureRoster. */
export interface CreatureInstance {
  instanceId: string;
  speciesId: string;
  nickname: string | null;
  /** 1..100. */
  level: number;
  /** Accumulated XP toward the next level. Resets to 0 on level-up. */
  currentExp: number;
  /** Persists between battles. */
  currentHp: number;
  /** Exactly 4 moveIds; each must be in the species's learnableMoves at/below current level. */
  moves: string[];
  /** FK → HeldItem id. Only changeable out of combat. */
  heldItemId: string | null;
  /** Persists between battles (poison stays unless cured). */
  status: StatusCondition;
}

// ── Active battle state (transient, agent memory) ──

/** A single side of a battle (player or opponent). */
export interface BattleSide {
  ownerKind: "persona" | "character" | "wild" | "adhoc-trainer";
  /** Null for wild creatures. */
  ownerId: string | null;
  ownerName: string;
  isAiControlled: boolean;
  /** Length 1 (single battle) or 2 (double battle). Null slot = fainted/empty. */
  activeSlots: (CreatureInstance | null)[];
  /** Remaining roster, ordered. */
  benchInstanceIds: string[];
  /** AI heuristic personality; applies when isAiControlled === true. */
  aiPersonality?: AiPersonality;
}

/** A single entry in the battle log (rendered in the UI). */
export interface BattleLogEntry {
  /** Unix epoch ms. */
  timestamp: number;
  type:
    | "player-action"
    | "opponent-action"
    | "ai-ally-action"
    | "status-tick"
    | "weather-tick"
    | "item-trigger"
    | "switch"
    | "faint"
    | "catch-attempt"
    | "evolution-prompt"
    | "system"
    | "narrative";
  message: string;
  /** Optional roll details for debug overlays. */
  rolls?: { kind: string; value: number; threshold?: number }[];
}

/** Full battle state. Persisted in agent memory keyed by (creature-battles, chatId, "activeBattle"). */
export interface CreatureBattleState {
  battleId: string;
  chatId: string;
  format: BattleFormat;
  /** Optimistic concurrency guard. Incremented every server-side state mutation. */
  stateVersion: number;
  playerSide: BattleSide;
  opponentSide: BattleSide;
  weather: Weather;
  terrain: Terrain;
  weatherTurnsLeft: number;
  terrainTurnsLeft: number;
  turnNumber: number;
  log: BattleLogEntry[];
  /** Present when the battle has ended. */
  result?: BattleResult;
  /** Cleared to false once the battle ends. */
  active: boolean;
  startedAt: string;
  endedAt?: string;
}

// ── Player actions (battle input) ──────────────

/** A single player action submitted per slot per round. */
export type PlayerAction =
  | { kind: "attack"; slotIndex: 0 | 1; moveId: string; targetIndex?: 0 | 1 }
  | { kind: "switch"; slotIndex: 0 | 1; benchInstanceId: string }
  | {
      kind: "item";
      slotIndex: 0 | 1;
      /** Matched by name against PlayerStats.inventory for the current chat. */
      inventoryItemName: string;
      targetInstanceId: string;
    }
  | { kind: "run" };

// ── Request / response types (API surface) ─────

export interface CreatureBattleInitRequest {
  chatId: string;
  format: BattleFormat;
  opponent:
    | { kind: "wild"; speciesId: string; level: number }
    | { kind: "character"; characterId: string }
    | { kind: "adhoc"; opponentInstances: CreatureInstance[]; trainerName?: string };
  /** Instance IDs from the active persona's roster; length 1 (single) or 2 (double). */
  playerSlotInstanceIds: string[];
}

export interface CreatureBattleInitResponse {
  state: CreatureBattleState;
}

export interface CreatureBattleActionRequest {
  chatId: string;
  stateVersion: number;
  /** 1 (single) or 2 (double) actions. */
  actions: PlayerAction[];
}

export interface CreatureBattleActionResponse {
  state: CreatureBattleState;
  /** Log entries added during this round, in order. */
  deltaLog: BattleLogEntry[];
}

export interface CatchAttemptRequest {
  chatId: string;
  stateVersion: number;
  slotIndex: 0 | 1;
  /** Matched against PlayerStats.inventory; item must have creatureBattleEffect.kind === "ball". */
  ballInventoryItemName: string;
  targetInstanceId: string;
}

export interface CatchAttemptResponse {
  /** Updated state (ball consumed; instance moved to roster on success). */
  state: CreatureBattleState;
  caught: boolean;
  /** 0..4 — how many shake checks succeeded before resolution. */
  shakes: 0 | 1 | 2 | 3 | 4;
  rosterUpdated: boolean;
}

export interface FreeTextActionRequest {
  chatId: string;
  stateVersion: number;
  text: string;
}

export interface FreeTextActionResponse {
  interpretation: "structured-action" | "narrative-only" | "clarification-needed";
  /** Present when interpretation === "structured-action". */
  structuredAction?: PlayerAction;
  /** Present when interpretation === "narrative-only". */
  narrativeMessage?: string;
  /** Present when interpretation === "clarification-needed". */
  clarificationPrompt?: string;
  /** Present when state mutated (structured-action only). */
  state?: CreatureBattleState;
  /** Present when state mutated. */
  deltaLog?: BattleLogEntry[];
}

export interface EndBattleRequest {
  chatId: string;
  reason: "forfeit" | "interrupt";
}

export interface EndBattleResponse {
  state: CreatureBattleState;
  /** Chat message ID for the injected end-of-battle summary. */
  summaryMessageId: string;
  rosterDiffs: Array<{
    trainerKind: "persona" | "character";
    trainerId: string;
    instanceId: string;
    /** Diff of mutated fields. */
    changes: Partial<CreatureInstance>;
    /** Present if this creature can evolve as a result of the battle. */
    evolutionAvailable?: { fromSpeciesId: string; toSpeciesId: string };
  }>;
}
```

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

Modify `packages/shared/src/index.ts`. After line 26 (the last existing type export, `export * from "./types/image-generation-defaults.js";`), add:

```ts
export * from "./types/creature.js";
```

- [ ] **Step 3: Run `pnpm check` to verify TypeScript and ESLint pass**

Run from repo root:

```bash
pnpm check
```

Expected: clean (no TypeScript errors, no ESLint errors). The new `creature.ts` file has no runtime code; only declarations. If `pnpm check` complains about unused exports or anything else, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/creature.ts packages/shared/src/index.ts
git commit -m "feat(types): add Creature Battles shared types

Add packages/shared/src/types/creature.ts with all enums, species,
instance, move, item, ball, battle-state, and API request/response
shapes for the Creature Battles feature. Phase 1.0 of feature/creature-battles.

No runtime code; types only. Constants and DB schema follow."
```

---

## Task 2: Type effectiveness chart

**Files:**
- Create: `packages/shared/src/constants/creature-types.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the type chart constant**

Create `packages/shared/src/constants/creature-types.ts` with this exact content:

```ts
// ──────────────────────────────────────────────
// Creature Battles — Type Effectiveness Chart
// ──────────────────────────────────────────────
// Mechanically generic 18×18 matrix used by the battle engine.
// Values: 0 = no effect, 0.5 = not very effective, 1 = neutral, 2 = super effective.
// Lookup: TYPE_CHART[attackingType][defendingType]
// ──────────────────────────────────────────────
import type { CreatureType } from "../types/creature.js";

export type TypeEffectivenessMultiplier = 0 | 0.5 | 1 | 2;

export const TYPE_CHART: Record<CreatureType, Record<CreatureType, TypeEffectivenessMultiplier>> = {
  normal:   { normal:1, fire:1,   water:1,  electric:1, grass:1,  ice:1,   fighting:1, poison:1, ground:1, flying:1,   psychic:1,   bug:1,   rock:0.5, ghost:0,   dragon:1,   dark:1,   steel:0.5, fairy:1 },
  fire:     { normal:1, fire:0.5, water:0.5,electric:1, grass:2,  ice:2,   fighting:1, poison:1, ground:1, flying:1,   psychic:1,   bug:2,   rock:0.5, ghost:1,   dragon:0.5, dark:1,   steel:2,   fairy:1 },
  water:    { normal:1, fire:2,   water:0.5,electric:1, grass:0.5,ice:1,   fighting:1, poison:1, ground:2, flying:1,   psychic:1,   bug:1,   rock:2,   ghost:1,   dragon:0.5, dark:1,   steel:1,   fairy:1 },
  electric: { normal:1, fire:1,   water:2,  electric:0.5,grass:0.5,ice:1,  fighting:1, poison:1, ground:0, flying:2,   psychic:1,   bug:1,   rock:1,   ghost:1,   dragon:0.5, dark:1,   steel:1,   fairy:1 },
  grass:    { normal:1, fire:0.5, water:2,  electric:1, grass:0.5,ice:1,   fighting:1, poison:0.5,ground:2,flying:0.5, psychic:1,   bug:0.5, rock:2,   ghost:1,   dragon:0.5, dark:1,   steel:0.5, fairy:1 },
  ice:      { normal:1, fire:0.5, water:0.5,electric:1, grass:2,  ice:0.5, fighting:1, poison:1, ground:2, flying:2,   psychic:1,   bug:1,   rock:1,   ghost:1,   dragon:2,   dark:1,   steel:0.5, fairy:1 },
  fighting: { normal:2, fire:1,   water:1,  electric:1, grass:1,  ice:2,   fighting:1, poison:0.5,ground:1,flying:0.5, psychic:0.5, bug:0.5, rock:2,   ghost:0,   dragon:1,   dark:2,   steel:2,   fairy:0.5 },
  poison:   { normal:1, fire:1,   water:1,  electric:1, grass:2,  ice:1,   fighting:1, poison:0.5,ground:0.5,flying:1, psychic:1,   bug:1,   rock:0.5, ghost:0.5, dragon:1,   dark:1,   steel:0,   fairy:2 },
  ground:   { normal:1, fire:2,   water:1,  electric:2, grass:0.5,ice:1,   fighting:1, poison:2, ground:1, flying:0,   psychic:1,   bug:0.5, rock:2,   ghost:1,   dragon:1,   dark:1,   steel:2,   fairy:1 },
  flying:   { normal:1, fire:1,   water:1,  electric:0.5,grass:2, ice:1,   fighting:2, poison:1, ground:1, flying:1,   psychic:1,   bug:2,   rock:0.5, ghost:1,   dragon:1,   dark:1,   steel:0.5, fairy:1 },
  psychic:  { normal:1, fire:1,   water:1,  electric:1, grass:1,  ice:1,   fighting:2, poison:2, ground:1, flying:1,   psychic:0.5, bug:1,   rock:1,   ghost:1,   dragon:1,   dark:0,   steel:0.5, fairy:1 },
  bug:      { normal:1, fire:0.5, water:1,  electric:1, grass:2,  ice:1,   fighting:0.5,poison:0.5,ground:1,flying:0.5,psychic:2,   bug:1,   rock:1,   ghost:0.5, dragon:1,   dark:2,   steel:0.5, fairy:0.5 },
  rock:     { normal:1, fire:2,   water:1,  electric:1, grass:1,  ice:2,   fighting:0.5,poison:1, ground:0.5,flying:2, psychic:1,   bug:2,   rock:1,   ghost:1,   dragon:1,   dark:1,   steel:0.5, fairy:1 },
  ghost:    { normal:0, fire:1,   water:1,  electric:1, grass:1,  ice:1,   fighting:1, poison:1, ground:1, flying:1,   psychic:2,   bug:1,   rock:1,   ghost:2,   dragon:1,   dark:0.5, steel:1,   fairy:1 },
  dragon:   { normal:1, fire:1,   water:1,  electric:1, grass:1,  ice:1,   fighting:1, poison:1, ground:1, flying:1,   psychic:1,   bug:1,   rock:1,   ghost:1,   dragon:2,   dark:1,   steel:0.5, fairy:0 },
  dark:     { normal:1, fire:1,   water:1,  electric:1, grass:1,  ice:1,   fighting:0.5,poison:1, ground:1, flying:1,  psychic:2,   bug:1,   rock:1,   ghost:2,   dragon:1,   dark:0.5, steel:1,   fairy:0.5 },
  steel:    { normal:1, fire:0.5, water:0.5,electric:0.5,grass:1, ice:2,   fighting:1, poison:1, ground:1, flying:1,   psychic:1,   bug:1,   rock:2,   ghost:1,   dragon:1,   dark:1,   steel:0.5, fairy:2 },
  fairy:    { normal:1, fire:0.5, water:1,  electric:1, grass:1,  ice:1,   fighting:2, poison:0.5,ground:1,flying:1,   psychic:1,   bug:1,   rock:1,   ghost:1,   dragon:2,   dark:2,   steel:0.5, fairy:1 },
};

/** Convenience helper: effectiveness of an attack type against a defender's
 *  one or two types. Multiplies per-type values together (canonical behavior). */
export function getTypeEffectiveness(
  attackingType: CreatureType,
  defenderTypes: [CreatureType] | [CreatureType, CreatureType],
): number {
  let mult = 1;
  for (const defenderType of defenderTypes) {
    mult *= TYPE_CHART[attackingType][defenderType];
  }
  return mult;
}
```

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

Modify `packages/shared/src/index.ts`. After line 52 (the last existing constant export, `export * from "./constants/game-assets.js";`), add:

```ts
export * from "./constants/creature-types.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/creature-types.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles type-effectiveness chart

18×18 type chart + getTypeEffectiveness() helper. Mechanically
copies canonical effectiveness values."
```

---

## Task 3: Status, weather, and terrain registries

**Files:**
- Create: `packages/shared/src/constants/creature-status.ts`
- Create: `packages/shared/src/constants/creature-weather.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the status condition metadata file**

Create `packages/shared/src/constants/creature-status.ts` with this exact content:

```ts
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
```

- [ ] **Step 2: Create the weather + terrain metadata file**

Create `packages/shared/src/constants/creature-weather.ts` with this exact content:

```ts
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
```

- [ ] **Step 3: Add the barrel exports to `packages/shared/src/index.ts`**

Modify `packages/shared/src/index.ts`. After the line `export * from "./constants/creature-types.js";` added in Task 2, add:

```ts
export * from "./constants/creature-status.js";
export * from "./constants/creature-weather.js";
```

- [ ] **Step 4: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants/creature-status.ts packages/shared/src/constants/creature-weather.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles status, weather, terrain registries

Per-condition metadata (display name + mechanical constants like
endOfTurnDamageFraction). Lets the engine read mechanical values
from the registry instead of scattering magic numbers."
```

---

## Task 4: Held items registry

**Files:**
- Create: `packages/shared/src/constants/creature-items.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the held items registry**

Create `packages/shared/src/constants/creature-items.ts` with this exact content:

```ts
// ──────────────────────────────────────────────
// Creature Battles — Held Items Registry
// ──────────────────────────────────────────────
// The 15 staple held items shipped in Phase 1.0. Each entry has typed
// triggers + effect kinds that the deterministic battle engine consumes.
// More items can be added in later phases without engine changes if
// they reuse the existing trigger/effectKind combinations.
// ──────────────────────────────────────────────
import type { HeldItem } from "../types/creature.js";

export const HELD_ITEMS: HeldItem[] = [
  {
    id: "leftovers",
    name: "Leftovers",
    description: "Restores 1/16 of max HP at the end of each turn.",
    trigger: "end_of_turn",
    effectKind: "heal",
    amount: 1 / 16,
  },
  {
    id: "oran_berry",
    name: "Oran Berry",
    description: "Consumed when HP falls below 50%; restores 10 HP (flat).",
    trigger: "on_low_hp",
    effectKind: "heal",
    amount: 10,
    threshold: 0.5,
  },
  {
    id: "sitrus_berry",
    name: "Sitrus Berry",
    description: "Consumed when HP falls below 50%; restores 25% of max HP.",
    trigger: "on_low_hp",
    effectKind: "heal",
    amount: 0.25,
    threshold: 0.5,
  },
  {
    id: "life_orb",
    name: "Life Orb",
    description: "Damaging moves deal ×1.3 damage; user loses 10% max HP per attack.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.3,
  },
  {
    id: "choice_band",
    name: "Choice Band",
    description: "Physical Attack ×1.5, but locked into the first move used.",
    trigger: "passive",
    effectKind: "lock_move",
    amount: 1.5,
  },
  {
    id: "choice_specs",
    name: "Choice Specs",
    description: "Special Attack ×1.5, but locked into the first move used.",
    trigger: "passive",
    effectKind: "lock_move",
    amount: 1.5,
  },
  {
    id: "choice_scarf",
    name: "Choice Scarf",
    description: "Speed ×1.5, but locked into the first move used.",
    trigger: "passive",
    effectKind: "speed_mod",
    amount: 1.5,
  },
  {
    id: "focus_sash",
    name: "Focus Sash",
    description: "Survives a one-shot KO with 1 HP if user was at full HP. Consumed on use.",
    trigger: "on_hit",
    effectKind: "survive_ko",
  },
  {
    id: "eviolite",
    name: "Eviolite",
    description: "Defense and Sp. Def ×1.5 for creatures that can still evolve.",
    trigger: "passive",
    effectKind: "stat_mod",
    amount: 1.5,
  },
  {
    id: "charcoal",
    name: "Charcoal",
    description: "Fire-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "fire",
  },
  {
    id: "mystic_water",
    name: "Mystic Water",
    description: "Water-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "water",
  },
  {
    id: "miracle_seed",
    name: "Miracle Seed",
    description: "Grass-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "grass",
  },
  {
    id: "magnet",
    name: "Magnet",
    description: "Electric-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "electric",
  },
  {
    id: "soft_sand",
    name: "Soft Sand",
    description: "Ground-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "ground",
  },
  {
    id: "never_melt_ice",
    name: "Never-Melt Ice",
    description: "Ice-type moves deal ×1.2 damage.",
    trigger: "on_attack",
    effectKind: "damage_mod",
    amount: 1.2,
    affectedType: "ice",
  },
];

/** Convenience lookup map. */
export const HELD_ITEMS_BY_ID: Record<string, HeldItem> = Object.fromEntries(
  HELD_ITEMS.map((item) => [item.id, item]),
);
```

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

After the `export * from "./constants/creature-weather.js";` line added in Task 3, add:

```ts
export * from "./constants/creature-items.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/creature-items.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles held items registry

15 staple held items (Leftovers, Oran/Sitrus Berries, Life Orb,
Choice Band/Specs/Scarf, Focus Sash, Eviolite, 6 type-boosting
items). Includes HELD_ITEMS_BY_ID lookup map."
```

---

## Task 5: Ball registry

**Files:**
- Create: `packages/shared/src/constants/creature-balls.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the ball registry**

Create `packages/shared/src/constants/creature-balls.ts` with this exact content:

```ts
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
```

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

After the `export * from "./constants/creature-items.js";` line added in Task 4, add:

```ts
export * from "./constants/creature-balls.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/creature-balls.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles ball registry

Standard / Great / Ultra / Premier / Master Ball with canonical
catch multipliers. Master Ball uses guaranteed: true to skip RNG."
```

---

## Task 6: Move registry

**Files:**
- Create: `packages/shared/src/constants/creature-moves.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the move registry**

Create `packages/shared/src/constants/creature-moves.ts` with this exact content (40 moves covering all 18 types and all 3 categories):

```ts
// ──────────────────────────────────────────────
// Creature Battles — Move Registry
// ──────────────────────────────────────────────
// The 40 starter moves shipped in Phase 1.0. Coverage:
//   - At least one offensive move per type (physical or special)
//   - A handful of status moves (heal, buff, debuff, status inflict, weather, terrain)
//   - Classic familiar names players will recognize
//
// Additional moves can be added later by following this exact shape.
// Engine code reads ID, type, category, power, accuracy, priority,
// and any optional effect fields.
// ──────────────────────────────────────────────
import type { Move } from "../types/creature.js";

export const MOVES: Move[] = [
  // ── Normal ──
  {
    id: "tackle",
    name: "Tackle",
    type: "normal",
    category: "physical",
    power: 40,
    accuracy: 100,
    priority: 0,
    description: "A full-body tackle.",
  },
  {
    id: "body_slam",
    name: "Body Slam",
    type: "normal",
    category: "physical",
    power: 85,
    accuracy: 100,
    priority: 0,
    description: "A heavy body slam; may paralyze.",
    statusInflict: { condition: "paralysis", chance: 0.3 },
  },
  {
    id: "hyper_beam",
    name: "Hyper Beam",
    type: "normal",
    category: "special",
    power: 150,
    accuracy: 90,
    priority: 0,
    description: "A devastating beam of energy.",
  },
  {
    id: "quick_attack",
    name: "Quick Attack",
    type: "normal",
    category: "physical",
    power: 40,
    accuracy: 100,
    priority: 1,
    description: "A blindingly fast strike that always goes first.",
  },

  // ── Fire ──
  {
    id: "ember",
    name: "Ember",
    type: "fire",
    category: "special",
    power: 40,
    accuracy: 100,
    priority: 0,
    description: "A small flame. May burn.",
    statusInflict: { condition: "burn", chance: 0.1 },
  },
  {
    id: "flamethrower",
    name: "Flamethrower",
    type: "fire",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A scorching flame. May burn.",
    statusInflict: { condition: "burn", chance: 0.1 },
  },
  {
    id: "sunny_day",
    name: "Sunny Day",
    type: "fire",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Intensifies the sun for 5 turns.",
    weatherSet: "sun",
  },

  // ── Water ──
  {
    id: "water_gun",
    name: "Water Gun",
    type: "water",
    category: "special",
    power: 40,
    accuracy: 100,
    priority: 0,
    description: "A blast of water.",
  },
  {
    id: "surf",
    name: "Surf",
    type: "water",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A towering wave.",
  },
  {
    id: "rain_dance",
    name: "Rain Dance",
    type: "water",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Summons heavy rain for 5 turns.",
    weatherSet: "rain",
  },

  // ── Electric ──
  {
    id: "thunder_shock",
    name: "Thunder Shock",
    type: "electric",
    category: "special",
    power: 40,
    accuracy: 100,
    priority: 0,
    description: "An electric jolt. May paralyze.",
    statusInflict: { condition: "paralysis", chance: 0.1 },
  },
  {
    id: "thunderbolt",
    name: "Thunderbolt",
    type: "electric",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A powerful electric blast. May paralyze.",
    statusInflict: { condition: "paralysis", chance: 0.1 },
  },
  {
    id: "electric_terrain",
    name: "Electric Terrain",
    type: "electric",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Electrifies the field for 5 turns.",
    terrainSet: "electric",
  },

  // ── Grass ──
  {
    id: "vine_whip",
    name: "Vine Whip",
    type: "grass",
    category: "physical",
    power: 45,
    accuracy: 100,
    priority: 0,
    description: "A whip of vines.",
  },
  {
    id: "energy_ball",
    name: "Energy Ball",
    type: "grass",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A focused orb of natural energy.",
  },
  {
    id: "grassy_terrain",
    name: "Grassy Terrain",
    type: "grass",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Covers the field in grass for 5 turns.",
    terrainSet: "grassy",
  },

  // ── Ice ──
  {
    id: "icy_wind",
    name: "Icy Wind",
    type: "ice",
    category: "special",
    power: 55,
    accuracy: 95,
    priority: 0,
    description: "A chilling wind that lowers Speed.",
    statStageChange: { target: "opponent", stat: "speed", delta: -1, chance: 1 },
  },
  {
    id: "ice_beam",
    name: "Ice Beam",
    type: "ice",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A frigid beam. May freeze.",
    statusInflict: { condition: "freeze", chance: 0.1 },
  },
  {
    id: "hail",
    name: "Hail",
    type: "ice",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Summons a hailstorm for 5 turns.",
    weatherSet: "hail",
  },

  // ── Fighting ──
  {
    id: "karate_chop",
    name: "Karate Chop",
    type: "fighting",
    category: "physical",
    power: 50,
    accuracy: 100,
    priority: 0,
    description: "A high-crit chopping strike.",
    critRatio: 1,
  },
  {
    id: "close_combat",
    name: "Close Combat",
    type: "fighting",
    category: "physical",
    power: 120,
    accuracy: 100,
    priority: 0,
    description: "A reckless brawl; lowers Defense and Sp. Def.",
    statStageChange: { target: "self", stat: "def", delta: -1, chance: 1 },
  },

  // ── Poison ──
  {
    id: "poison_sting",
    name: "Poison Sting",
    type: "poison",
    category: "physical",
    power: 15,
    accuracy: 100,
    priority: 0,
    description: "A poisonous stinger. May poison.",
    statusInflict: { condition: "poison", chance: 0.3 },
  },
  {
    id: "sludge_bomb",
    name: "Sludge Bomb",
    type: "poison",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A toxic sludge bomb. May poison.",
    statusInflict: { condition: "poison", chance: 0.3 },
  },
  {
    id: "toxic",
    name: "Toxic",
    type: "poison",
    category: "status",
    power: 0,
    accuracy: 90,
    priority: 0,
    description: "Badly poisons the target.",
    statusInflict: { condition: "poison", chance: 1 },
  },

  // ── Ground ──
  {
    id: "mud_shot",
    name: "Mud-Shot",
    type: "ground",
    category: "special",
    power: 55,
    accuracy: 95,
    priority: 0,
    description: "A flung gob of mud. Lowers Speed.",
    statStageChange: { target: "opponent", stat: "speed", delta: -1, chance: 1 },
  },
  {
    id: "earthquake",
    name: "Earthquake",
    type: "ground",
    category: "physical",
    power: 100,
    accuracy: 100,
    priority: 0,
    description: "A devastating ground tremor.",
  },

  // ── Flying ──
  {
    id: "wing_attack",
    name: "Wing Attack",
    type: "flying",
    category: "physical",
    power: 60,
    accuracy: 100,
    priority: 0,
    description: "A buffeting strike with broad wings.",
  },
  {
    id: "air_slash",
    name: "Air Slash",
    type: "flying",
    category: "special",
    power: 75,
    accuracy: 95,
    priority: 0,
    description: "A blade of air; high crit ratio.",
    critRatio: 1,
  },

  // ── Psychic ──
  {
    id: "confusion",
    name: "Confusion",
    type: "psychic",
    category: "special",
    power: 50,
    accuracy: 100,
    priority: 0,
    description: "A weak psychic attack. May confuse.",
    statusInflict: { condition: "confusion", chance: 0.1 },
  },
  {
    id: "psychic",
    name: "Psychic",
    type: "psychic",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A strong psychic pulse. May lower Sp. Def.",
    statStageChange: { target: "opponent", stat: "spDef", delta: -1, chance: 0.1 },
  },
  {
    id: "psychic_terrain",
    name: "Psychic Terrain",
    type: "psychic",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Charges the field with psychic energy for 5 turns.",
    terrainSet: "psychic",
  },

  // ── Bug ──
  {
    id: "bug_bite",
    name: "Bug Bite",
    type: "bug",
    category: "physical",
    power: 60,
    accuracy: 100,
    priority: 0,
    description: "A piercing bite.",
  },
  {
    id: "bug_buzz",
    name: "Bug Buzz",
    type: "bug",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    description: "A damaging sonic vibration.",
    statStageChange: { target: "opponent", stat: "spDef", delta: -1, chance: 0.1 },
  },

  // ── Rock ──
  {
    id: "rock_throw",
    name: "Rock Throw",
    type: "rock",
    category: "physical",
    power: 50,
    accuracy: 90,
    priority: 0,
    description: "A hurled rock.",
  },
  {
    id: "stone_edge",
    name: "Stone Edge",
    type: "rock",
    category: "physical",
    power: 100,
    accuracy: 80,
    priority: 0,
    description: "Sharp stones; high crit ratio.",
    critRatio: 1,
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    type: "rock",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Whips up a sandstorm for 5 turns.",
    weatherSet: "sandstorm",
  },

  // ── Ghost ──
  {
    id: "shadow_ball",
    name: "Shadow Ball",
    type: "ghost",
    category: "special",
    power: 80,
    accuracy: 100,
    priority: 0,
    description: "A blob of shadow. May lower Sp. Def.",
    statStageChange: { target: "opponent", stat: "spDef", delta: -1, chance: 0.2 },
  },

  // ── Dragon ──
  {
    id: "dragon_breath",
    name: "Dragon Breath",
    type: "dragon",
    category: "special",
    power: 60,
    accuracy: 100,
    priority: 0,
    description: "A shockwave of draconic energy. May paralyze.",
    statusInflict: { condition: "paralysis", chance: 0.3 },
  },
  {
    id: "dragon_claw",
    name: "Dragon Claw",
    type: "dragon",
    category: "physical",
    power: 80,
    accuracy: 100,
    priority: 0,
    description: "A slashing claw infused with draconic power.",
  },

  // ── Dark ──
  {
    id: "bite",
    name: "Bite",
    type: "dark",
    category: "physical",
    power: 60,
    accuracy: 100,
    priority: 0,
    description: "A sharp bite. May cause flinching (engine: lower priority next turn).",
  },
  {
    id: "dark_pulse",
    name: "Dark Pulse",
    type: "dark",
    category: "special",
    power: 80,
    accuracy: 100,
    priority: 0,
    description: "A pulse of dark energy.",
  },

  // ── Steel ──
  {
    id: "iron_tail",
    name: "Iron Tail",
    type: "steel",
    category: "physical",
    power: 100,
    accuracy: 75,
    priority: 0,
    description: "A heavy iron-hardened tail. May lower Defense.",
    statStageChange: { target: "opponent", stat: "def", delta: -1, chance: 0.3 },
  },

  // ── Fairy ──
  {
    id: "fairy_wind",
    name: "Fairy Wind",
    type: "fairy",
    category: "special",
    power: 40,
    accuracy: 100,
    priority: 0,
    description: "A gust of fairy-touched wind.",
  },
  {
    id: "moonblast",
    name: "Moonblast",
    type: "fairy",
    category: "special",
    power: 95,
    accuracy: 100,
    priority: 0,
    description: "A blast of moonlight. May lower Sp. Atk.",
    statStageChange: { target: "opponent", stat: "spAtk", delta: -1, chance: 0.3 },
  },

  // ── Status / utility ──
  {
    id: "recover",
    name: "Recover",
    type: "normal",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Restores 50% of max HP.",
    statStageChange: { target: "self", stat: "hp", delta: 0, chance: 1 }, // heal handled by engine for status-cat moves with this convention
  },
  {
    id: "swords_dance",
    name: "Swords Dance",
    type: "normal",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Sharply raises Attack (+2 stages).",
    statStageChange: { target: "self", stat: "atk", delta: 2, chance: 1 },
  },
  {
    id: "calm_mind",
    name: "Calm Mind",
    type: "psychic",
    category: "status",
    power: 0,
    accuracy: 100,
    priority: 0,
    description: "Raises Sp. Atk and Sp. Def.",
    statStageChange: { target: "self", stat: "spAtk", delta: 1, chance: 1 },
  },
  {
    id: "sleep_powder",
    name: "Sleep Powder",
    type: "grass",
    category: "status",
    power: 0,
    accuracy: 75,
    priority: 0,
    description: "Puts the target to sleep.",
    statusInflict: { condition: "sleep", chance: 1 },
  },
];

/** Convenience lookup map. */
export const MOVES_BY_ID: Record<string, Move> = Object.fromEntries(
  MOVES.map((move) => [move.id, move]),
);
```

> NOTE for the engine implementer in Phase 1.2: `Recover` and `Calm Mind` rely on engine conventions for status-category moves (heal-self for Recover; double-stat-raise for Calm Mind needs an additional pass in the resolver). These are not engine bugs — the move registry is shape-correct; the resolver in Phase 1.2 will branch on `category === "status"` and handle these specifics. Phase 1.0 only ships the data.

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

After the `export * from "./constants/creature-balls.js";` line added in Task 5, add:

```ts
export * from "./constants/creature-moves.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/creature-moves.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles starter move registry

40 moves covering all 18 types and all 3 categories (physical,
special, status). Includes classic damage moves, status moves with
inflict chances, weather/terrain setters, stat-stage modifiers,
healing, and one priority move (Quick Attack). MOVES_BY_ID lookup
map included."
```

---

## Task 7: Inventory presets

**Files:**
- Create: `packages/shared/src/constants/creature-inventory-presets.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the inventory presets file**

Create `packages/shared/src/constants/creature-inventory-presets.ts` with this exact content:

```ts
// ──────────────────────────────────────────────
// Creature Battles — Bag Item Presets
// ──────────────────────────────────────────────
// Starter inventory items that users can quickly seed into a chat's
// PlayerStats.inventory. Each preset is shaped to match the existing
// InventoryItem type (see game-state.ts) PLUS the new optional
// `creatureBattleEffect` field that wires it into the deterministic
// battle engine.
//
// These are templates, not registry entries — the actual items live
// in PlayerStats.inventory per-chat (existing storage). The Phase 1.3
// inventory editor will offer a "Seed common items" affordance using
// these presets.
// ──────────────────────────────────────────────
import type { CreatureBattleEffect } from "../types/creature.js";

export interface CreatureBattleInventoryPreset {
  name: string;
  description: string;
  /** Suggested starting quantity when the preset is seeded. */
  defaultQuantity: number;
  /** Suggested location field for the existing InventoryItem. */
  defaultLocation: string;
  /** The mechanical effect that gets attached to the InventoryItem when seeded. */
  creatureBattleEffect: CreatureBattleEffect;
}

export const CREATURE_BATTLE_INVENTORY_PRESETS: CreatureBattleInventoryPreset[] = [
  {
    name: "Potion",
    description: "Restores 20 HP to one creature.",
    defaultQuantity: 5,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "heal", amount: 20, isPercentage: false },
  },
  {
    name: "Super Potion",
    description: "Restores 50 HP to one creature.",
    defaultQuantity: 3,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "heal", amount: 50, isPercentage: false },
  },
  {
    name: "Hyper Potion",
    description: "Restores 120 HP to one creature.",
    defaultQuantity: 1,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "heal", amount: 120, isPercentage: false },
  },
  {
    name: "Full Restore",
    description: "Fully restores HP and cures all status conditions.",
    defaultQuantity: 0,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "heal", amount: 1, isPercentage: true },
  },
  {
    name: "Antidote",
    description: "Cures poison.",
    defaultQuantity: 3,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "cure_status", statuses: ["poison"] },
  },
  {
    name: "Awakening",
    description: "Cures sleep.",
    defaultQuantity: 2,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "cure_status", statuses: ["sleep"] },
  },
  {
    name: "Burn Heal",
    description: "Cures burn.",
    defaultQuantity: 2,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "cure_status", statuses: ["burn"] },
  },
  {
    name: "Revive",
    description: "Revives a fainted creature to half HP.",
    defaultQuantity: 1,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "revive", restoreFraction: 0.5 },
  },
  {
    name: "Standard Ball",
    description: "Throws a ball to attempt a catch.",
    defaultQuantity: 10,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "ball", ballTypeId: "pokeball" },
  },
  {
    name: "Great Ball",
    description: "Throws a higher-quality ball; 1.5× catch rate.",
    defaultQuantity: 5,
    defaultLocation: "on_person",
    creatureBattleEffect: { kind: "ball", ballTypeId: "great_ball" },
  },
];
```

- [ ] **Step 2: Add the barrel export to `packages/shared/src/index.ts`**

After the `export * from "./constants/creature-moves.js";` line added in Task 6, add:

```ts
export * from "./constants/creature-inventory-presets.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/creature-inventory-presets.ts packages/shared/src/index.ts
git commit -m "feat(constants): add Creature Battles bag-item presets

10 starter presets (Potion, Super Potion, Hyper Potion, Full
Restore, Antidote, Awakening, Burn Heal, Revive, Standard Ball,
Great Ball) shaped for seeding into the existing chat-scoped
PlayerStats.inventory."
```

---

## Task 8: Drizzle schema — `creature_species` table

**Files:**
- Create: `packages/server/src/db/schema/creatures.ts`
- Modify: `packages/server/src/db/schema/index.ts`

- [ ] **Step 1: Create the Drizzle schema file**

Create `packages/server/src/db/schema/creatures.ts` with this exact content:

```ts
// ──────────────────────────────────────────────
// Schema: Creature Species
// ──────────────────────────────────────────────
// The species library — globally accessible templates for creatures.
// Individual roster instances (CreatureInstance) live in JSON fields
// on the Persona and Character tables, not in this schema.
//
// Field encoding follows the rest of the project's conventions:
//   - JSON-typed fields stored as TEXT
//   - createdAt / updatedAt as TEXT (ISO strings, same as other tables)
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const creatureSpecies = sqliteTable("creature_species", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON array of CreatureType strings, length 1 or 2. */
  types: text("types").notNull(),
  /** JSON object: CreatureStats. */
  baseStats: text("base_stats").notNull(),
  /** Canonical 1..255 scale. */
  catchRate: integer("catch_rate").notNull().default(45),
  xpCurve: text("xp_curve", { enum: ["fast", "medium", "slow"] }).notNull().default("medium"),
  /** JSON array of LearnableMove objects. */
  learnableMoves: text("learnable_moves").notNull().default("[]"),
  /** JSON object: { trigger: EvolutionTrigger; toSpeciesId: string } or null. */
  evolution: text("evolution"),
  spritePath: text("sprite_path"),
  /** JSON array of strings. */
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

- [ ] **Step 2: Add the barrel export to `packages/server/src/db/schema/index.ts`**

Modify `packages/server/src/db/schema/index.ts`. After the last existing export (`export * from "./prompt-overrides.js";`), add:

```ts
export * from "./creatures.js";
```

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 4: Run `pnpm db:push` to verify the new table applies cleanly**

```bash
pnpm db:push
```

Expected: prompts for or applies the new `creature_species` table without errors. If Drizzle reports any issues with the schema syntax, fix and re-run before committing. Existing tables should be unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema/creatures.ts packages/server/src/db/schema/index.ts
git commit -m "feat(db): add creature_species table schema

New Drizzle table for the Creature Battles species library. JSON-encoded
columns (types, base_stats, learnable_moves, evolution, tags) follow
the project's existing schema conventions."
```

---

## Task 9: Extend `Persona` with roster fields

**Files:**
- Modify: `packages/shared/src/types/persona.ts`

- [ ] **Step 1: Read the current `Persona` interface**

Open `packages/shared/src/types/persona.ts` and locate the `Persona` interface. Confirm it ends with `createdAt: string; updatedAt: string; }` (around line 40–42 based on current file state).

- [ ] **Step 2: Add a `CreatureInstance` import at the top**

Below the existing `// User Persona Types` header block, ADD this import statement:

```ts
import type { CreatureInstance } from "./creature.js";
```

(Place it after the comment header, before the `export interface Persona` line. If there are already imports in the file, group it with them.)

- [ ] **Step 3: Add `creatureRoster` and `creatureBox` fields to `Persona`**

Inside the `Persona` interface, ADD these two fields (place them just before `createdAt: string;` to keep the structure neat):

```ts
  /** Per-trainer creature roster for the Creature Battles feature. Optional;
   *  undefined for personas that don't use the feature. */
  creatureRoster?: CreatureInstance[];
  /** Overflow storage for creatures beyond the party-of-6. Reserved for Phase 1.5+
   *  UI; storage is supported now so future writes don't need a migration. */
  creatureBox?: CreatureInstance[];
```

- [ ] **Step 4: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean. (The fields are optional, so existing personas in serialized form remain valid.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/persona.ts
git commit -m "feat(types): add optional creatureRoster/creatureBox to Persona

Both fields optional; zero impact on existing personas. Roster
holds the active party (≤6), box reserved for Phase 1.5 storage."
```

---

## Task 10: Extend `CharacterExtensions` with roster + AI personality

**Files:**
- Modify: `packages/shared/src/types/character.ts`

- [ ] **Step 1: Read the current `CharacterExtensions` interface**

Open `packages/shared/src/types/character.ts` and locate the `CharacterExtensions` interface (around line 33–55). Confirm it ends with the `[key: string]: unknown;` index signature.

- [ ] **Step 2: Add a `CreatureInstance` and `AiPersonality` import**

In the imports at the top of the file (alongside `import type { AltDescription } from "./persona";`), ADD:

```ts
import type { AiPersonality, CreatureInstance } from "./creature.js";
```

- [ ] **Step 3: Add `creatureRoster` and `aiPersonality` fields to `CharacterExtensions`**

Inside the `CharacterExtensions` interface, just BEFORE the `[key: string]: unknown;` line, ADD:

```ts
  /** Per-trainer creature roster for the Creature Battles feature. Optional;
   *  undefined for characters that don't use the feature. */
  creatureRoster?: CreatureInstance[];
  /** AI personality used by the Creature Battles heuristic when this character
   *  is an opponent. Defaults to "balanced" if undefined. */
  aiPersonality?: AiPersonality;
```

- [ ] **Step 4: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/character.ts
git commit -m "feat(types): add optional creatureRoster/aiPersonality to CharacterExtensions

Both fields optional. Characters without rosters are unaffected.
aiPersonality tunes Creature Battles opponent heuristic when set."
```

---

## Task 11: Extend `InventoryItem` with `creatureBattleEffect`

**Files:**
- Modify: `packages/shared/src/types/game-state.ts`

- [ ] **Step 1: Read the current `InventoryItem` interface**

Open `packages/shared/src/types/game-state.ts` and locate the `InventoryItem` interface (around lines 112–119). Confirm its shape matches:

```ts
export interface InventoryItem {
  name: string;
  description: string;
  quantity: number;
  location: string;
}
```

- [ ] **Step 2: Add a `CreatureBattleEffect` import**

Near the top of the file (above the first `export interface`), ADD an import block (or extend an existing one):

```ts
import type { CreatureBattleEffect } from "./creature.js";
```

- [ ] **Step 3: Add the optional `creatureBattleEffect` field**

Inside the `InventoryItem` interface, AFTER the `location: string;` line, ADD:

```ts
  /** Optional typed mechanical effect for Creature Battles. When present, the
   *  battle engine applies it deterministically. When absent, the item is
   *  narrative-only (interpreted via the modal's free-text input — same as
   *  the existing Encounter system's item handling). */
  creatureBattleEffect?: CreatureBattleEffect;
```

- [ ] **Step 4: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean. The field is optional and additive; existing serialized inventory items remain valid.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/game-state.ts
git commit -m "feat(types): add optional creatureBattleEffect to InventoryItem

Additive optional field. Items without it remain narrative-only
(matches existing Encounter behavior). When present, the Phase 1.2
Creature Battles engine uses it deterministically."
```

---

## Task 12: Extend `AgentResultType` union

**Files:**
- Modify: `packages/shared/src/types/agent.ts`

- [ ] **Step 1: Locate the `AgentResultType` union**

Open `packages/shared/src/types/agent.ts`. The `AgentResultType` union starts at line 15 and ends at line 40 with `| "game_state_transition";`.

- [ ] **Step 2: Add three new union members**

Replace the last line (the one ending with `| "game_state_transition";`) with:

```ts
  | "game_state_transition"
  | "creature_battle_invitation"
  | "creature_battle_summary"
  | "creature_battle_state_update";
```

(Note: the previously-terminal `| "game_state_transition"` keeps its `|` prefix and loses its trailing `;`; the new last line picks up the `;`.)

- [ ] **Step 3: Run `pnpm check`**

```bash
pnpm check
```

Expected: clean. No consumer code references these new types yet, so nothing should break.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/agent.ts
git commit -m "feat(types): add Creature Battles AgentResultType union values

Three new result types: creature_battle_invitation (inline chat
card), creature_battle_summary (post-battle message), and
creature_battle_state_update (state hints for other agents). No
consumers wired yet — those land in Phase 1.4 with the agent
registration."
```

---

## Task 13: Final validation + PR preparation

**Files:**
- None to modify. This task verifies the whole phase and prepares the PR.

- [ ] **Step 1: Run the full validation suite from a clean state**

From the repo root, run:

```bash
pnpm check
```

Expected: clean across all packages.

```bash
pnpm db:push
```

Expected: schema is in sync; no pending migrations or errors.

If either fails, fix the underlying issue before continuing. Do NOT proceed to PR with failing validation.

- [ ] **Step 2: Verify all 12 task commits are on the feature branch**

```bash
git log --oneline staging..HEAD
```

Expected: 12 new commits with the messages from Tasks 1–12, in order:

1. `feat(types): add Creature Battles shared types`
2. `feat(constants): add Creature Battles type-effectiveness chart`
3. `feat(constants): add Creature Battles status, weather, terrain registries`
4. `feat(constants): add Creature Battles held items registry`
5. `feat(constants): add Creature Battles ball registry`
6. `feat(constants): add Creature Battles starter move registry`
7. `feat(constants): add Creature Battles bag-item presets`
8. `feat(db): add creature_species table schema`
9. `feat(types): add optional creatureRoster/creatureBox to Persona`
10. `feat(types): add optional creatureRoster/aiPersonality to CharacterExtensions`
11. `feat(types): add optional creatureBattleEffect to InventoryItem`
12. `feat(types): add Creature Battles AgentResultType union values`

- [ ] **Step 3: Push the feature branch (already tracking `origin/feature/creature-battles`)**

```bash
git push
```

Expected: 12 commits pushed to your fork.

- [ ] **Step 4: Open a draft PR per CLAUDE.md agent-coordination rule**

Per `CLAUDE.md`: "when implementation effort starts for an issue, open a draft PR immediately so the project Kanban board shows the work in progress."

Open a **draft** PR from `feature/creature-battles` → `staging`. Title:

```
Creature Battles — Phase 1.0 Foundations (data layer only)
```

PR description (paste this verbatim; keep all checkboxes UNCHECKED per CLAUDE.md AI-PR rule — these are todos for the human reviewer):

```markdown
## Why

Phase 1.0 of the Creature Battles feature (Pokemon-style turn-based
battle simulator for roleplay mode). Lands the data foundation — all
shared types, constants, and the new `creature_species` DB table —
with zero user-visible behavior change. Phases 1.1–1.4 build the
species editor, deterministic battle engine, modal UI, and agent
registration on top of this.

See `docs/superpowers/specs/2026-05-25-creature-battles-design.md`
for the full design rationale.

## Scope (data only)

- New shared types: `packages/shared/src/types/creature.ts` (enums,
  species, instance, move, item, ball, battle state, API shapes)
- New shared constants: type chart, status/weather/terrain metadata,
  ~40 starter moves, 15 held items, 5 ball variants, 10 bag-item presets
- New Drizzle schema: `creature_species` table
- Additive optional fields on `Persona`, `CharacterExtensions`, `InventoryItem`
- 3 new `AgentResultType` union values

## Not in this PR (deferred to later phases)

- Species editor UI → Phase 1.1
- Battle engine + tests → Phase 1.2 (vitest introduced here)
- Battle modal + roster editor UI → Phase 1.3
- `creature-battles` agent registration + Combat agent auto-pause → Phase 1.4

## Manual verification

- [ ] `pnpm check` passes locally (TS + ESLint)
- [ ] `pnpm db:push` applies the new `creature_species` table cleanly with
      no impact on existing tables
- [ ] Existing personas with no `creatureRoster` field still load correctly
      (open the persona editor and verify no error)
- [ ] Existing characters with no `creatureRoster` or `aiPersonality` still load
- [ ] Existing inventory items (no `creatureBattleEffect`) still display in the
      tracker panel as today
- [ ] Existing Combat agent and Encounter system show no behavior change
      (open a game-mode chat, trigger an encounter — should be unchanged)

## Linked issue

⚠️ No linked issue yet — per `CLAUDE.md` § Before You Open a Pull Request,
open a feature-request issue and link it before this PR moves out of draft.
```

- [ ] **Step 5: Confirm draft PR is open on GitHub**

Verify the PR shows up on https://github.com/llmutilai/Marinara-Engine/pulls in **draft** state, with all 12 commits visible. Do NOT mark it ready-for-review yet — that happens after the human verification checklist above is run.

---

## Task 14: Hand-off to Phase 1.1

This task isn't a commit — it's a flag for the human reviewer.

- [ ] **Step 1: After Phase 1.0 PR is merged, initiate Phase 1.1 planning**

Once the Phase 1.0 PR is merged into `staging`, the next plan-writing cycle begins for Phase 1.1 (Species Editor). Per the user's stated preference (one plan per phase), the writing-plans skill should be invoked again at that point with scope `Phase 1.1 only`. The Phase 1.1 plan will cover:

- CRUD endpoints for `/api/creature-species/...`
- `CreatureSpeciesEditor.tsx` and new top-level route + sidebar entry
- Wiring + read-only end-to-end verification

No work in this PR pre-empts that scope.
