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
  /** Optional secondary effect: inflict a status condition. `chance` is a 0..1 probability. */
  statusInflict?: { condition: Exclude<StatusCondition, null>; chance: number };
  /** Optional secondary effect: change a stat stage. `chance` is a 0..1 probability. */
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
  ownerKind: "persona" | "character" | "wild" | "adhoc_trainer";
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
