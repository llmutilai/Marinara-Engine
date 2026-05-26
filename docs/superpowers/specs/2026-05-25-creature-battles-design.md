# Creature Battles — Design Spec

| | |
|---|---|
| **Status** | Draft — pending user review |
| **Date** | 2026-05-25 |
| **Branch** | `feature/creature-battles` (target: `staging`) |
| **Author** | Brainstormed with Claude |
| **Scope** | New roleplay-mode agent + battle system for Pokemon-style creature battles |

---

## 1. Summary

Creature Battles is a new opt-in feature for Marinara Engine that introduces Pokemon-style turn-based creature battles into **roleplay-mode** chats. It ships as a wholly separate stack from the existing Combat agent and Encounter system — a new agent, a new deterministic battle engine, a new modal UI, new editors, and new persisted data — coexisting with both legacy systems without altering their code.

Players build a roster of typed creatures (drawing from a sharable species library), level them up through battle, evolve them, catch new ones from wild encounters, and engage in single or double battles against wild creatures, predefined NPC trainers, or agent-generated ad-hoc opponents.

---

## 2. Motivation

The existing Combat agent narratively tracks generic RPG combat in chat JSON; the Encounter system delivers full deterministic combat but is bound to `game` chat mode and built around a generic RPG model (HP / MP / Attack / Defense / Speed / level / element). Neither supports the structured demands of a creature-collecting battler:

- Multi-creature rosters owned by both player and opponent
- Switching creatures between turns (with structured priority)
- 18-type effectiveness matrix with STAB
- Stat stages (±6) and status conditions as deterministic mechanics
- Held items with mechanical triggers
- Catching mechanics with a canonical formula
- Cross-battle progression: EXP, level-up stat recalc, evolution

Rather than retrofit one of those existing systems (which risks regressions and tangles two mechanically different combat models), Creature Battles ships as a parallel mirror — same structural conventions, separate implementation.

---

## 3. Goals & Non-Goals

### Goals (Phase 1 MVP)

- Roleplay-mode-only battle modal with structured action buttons + free-text "describe" input (mirrors `EncounterModal` UX conventions)
- Deterministic battle resolution: types, STAB, damage formula, crits, accuracy, status conditions, stat stages, weather, terrain, held items
- 6-stat data model (HP / Atk / Def / SpA / SpD / Speed) with speed-driven turn order and structured action priority (Switch → Item → Attack)
- Species library as a new top-level entity; per-trainer creature rosters on Persona and Character
- Full progression loop: EXP gain, automatic level-up, stat recalc, evolution, catching
- Single and double battle formats
- Three opponent sources: wild creatures, NPC trainers (character cards), agent-generated ad-hoc opponents
- Automatic pause of the existing Combat agent while a Creature Battle is active (runtime branch only; no code change to Combat)
- Sharable species library (cross-chat) — instances are per-trainer (per-chat scoped to the trainer they're on)

### Non-Goals (deferred or cut)

- Move PP — moves are unlimited per battle in Phase 1
- Abilities — no mechanical ability framework; no `ability` field on `CreatureSpecies`. Flavor-text abilities can be added in Phase 2 as a non-mechanical narrative string
- Multi-turn moves (Solar Beam, Fly, Hyper Beam recharge) — every move resolves on the turn used
- Switch hazards (Stealth Rock, Spikes)
- IVs / Nature / EVs — base stats only for Phase 1 instance state
- Storage box beyond party-of-6 — `creatureBox` field is reserved but no editor UI in Phase 1.0
- Game-mode integration — Roleplay only
- Visual-novel-mode integration — Roleplay only
- Conversation-mode integration — Roleplay only
- Replacement of or change to the existing Combat agent
- Cross-chat creature persistence ("save file" model) — rosters are scoped to the trainer they live on, and trainers (Personas/Characters) are global but each chat has its own active Persona
- PvP / multiplayer

---

## 4. Constraints

- Must not alter the existing Combat agent's behavior or code
- Must not alter the existing Encounter system's behavior or code
- SFW only — content guidance reinforced in the agent prompt
- "Pokemon" is a reference term in this design only; canonical name is "Creature" to avoid trademark associations. Type names (Fire, Water, etc.) are mechanically generic and safe
- Server code must use shared Pino logger (per `CLAUDE.md`); never `console.*` on the server
- Validation baseline is `pnpm check` (TypeScript + ESLint) per `CLAUDE.md`
- Target branch is `staging`, not `main` (per `CLAUDE.md` § Branches)
- Documentation touch points (per `CLAUDE.md`): README, CHANGELOG, docs/CONFIGURATION, docs/FAQ as applicable

---

## 5. High-Level Architecture

Four cooperating layers, all new (Approach A — Full Parallel Mirror).

```
┌──────────────────────────────────────────────────────────────────┐
│                       CLIENT (React)                             │
│  ┌────────────────────────────┐  ┌──────────────────────────┐    │
│  │ CreatureBattleModal        │  │ CreatureSpeciesEditor    │    │
│  │ (action panel + log +      │  │ (new top-level route)    │    │
│  │  free-text input)          │  │                          │    │
│  └────────────────────────────┘  └──────────────────────────┘    │
│  ┌────────────────────────────┐  ┌──────────────────────────┐    │
│  │ Roster editor sections     │  │ Inventory item effect    │    │
│  │ (Persona + Character)      │  │ sub-form (reuses         │    │
│  │                            │  │ existing tracker panel)  │    │
│  └────────────────────────────┘  └──────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ creatureBattle.store.ts (Zustand, mirrors encounter.store) │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  │ REST
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SERVER (Node + Drizzle)                    │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  /api/creature-battle/{init,state,action,catch,         │     │
│  │                       free-text,end}                    │     │
│  │  /api/creature-species/  (CRUD)                         │     │
│  └─────────────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  creature-battle.service.ts (pure, deterministic)       │     │
│  │  ─ resolveRound(state, actions): newState               │     │
│  │  ─ computeDamage(...): number                           │     │
│  │  ─ applyStatusTick(state): newState                     │     │
│  │  ─ checkVictory(state): result | null                   │     │
│  │  ─ runCatchFormula(...): { caught, shakes }             │     │
│  │  ─ aiSelectAction(state, slot): action                  │     │
│  └─────────────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  creature-progression.service.ts                        │     │
│  │  ─ awardExperience(creature, xp): newCreature           │     │
│  │  ─ checkEvolution(creature, species): trigger | null    │     │
│  │  ─ recalcStatsFromBase(species, level): Stats           │     │
│  └─────────────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Agent: creature-battles (parallel phase, opt-in)       │     │
│  │  Tools: start_creature_battle, spawn_creature_instance, │     │
│  │         define_creature_species, update_creature_roster,│     │
│  │         award_experience, catch_creature                │     │
│  └─────────────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Agent orchestrator runtime branch                      │     │
│  │  ─ If creatureBattleActive(chatId): skip Combat agent   │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                       DATABASE (SQLite)                          │
│  NEW:    creature_species table                                  │
│  ADDED:  creatureRoster, creatureBox JSON on personas table      │
│  EXTENDED: InventoryItem in PlayerStats gains optional            │
│          creatureBattleEffect field (existing per-chat store)     │
│  ADDED:  creatureRoster, aiPersonality JSON inside character     │
│          extensions                                              │
│  REUSED: agent_memory for transient CreatureBattleState          │
└──────────────────────────────────────────────────────────────────┘
```

**Boundaries respected:**
- ✅ Existing `combat.service.ts` — untouched
- ✅ Existing `combat` agent — untouched (auto-pause is a runtime branch, not a code change)
- ✅ Existing Encounter system (game mode) — untouched
- ✅ Other chat modes (conversation, visual_novel, game) — unaffected

---

## 6. Data Model

All shared types live in a new file: `packages/shared/src/types/creature.ts`.

### 6.1 Enums

```ts
type CreatureType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

type MoveCategory = "physical" | "special" | "status";

type StatusCondition =
  | null | "burn" | "poison" | "paralysis" | "sleep" | "freeze" | "confusion";

type Weather = "clear" | "sun" | "rain" | "sandstorm" | "hail";
type Terrain = "none" | "electric" | "grassy" | "misty" | "psychic";

type EvolutionTrigger =
  | { kind: "level"; level: number }
  | { kind: "item"; itemId: string };

type StatKey = "hp" | "atk" | "def" | "spAtk" | "spDef" | "speed";

type AiPersonality = "aggressive" | "defensive" | "balanced";

type BattleFormat = "single" | "double";

type BattleResult = "victory" | "defeat" | "fled" | "interrupted";
```

### 6.2 `CreatureSpecies` (new top-level entity)

Stored in the new `creature_species` Drizzle table. Globally accessible across chats, like Personas / Characters / Lorebooks.

```ts
interface CreatureSpecies {
  id: string;
  name: string;
  description: string;
  types: [CreatureType] | [CreatureType, CreatureType];
  baseStats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number };
  catchRate: number;                  // 1–255 (canonical scale)
  xpCurve: "fast" | "medium" | "slow";
  learnableMoves: LearnableMove[];
  evolution?: { trigger: EvolutionTrigger; toSpeciesId: string };
  spritePath: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface LearnableMove {
  moveId: string;
  learnLevel: number;     // 0 = known at level 1
}
```

### 6.3 `Move` (static registry in `packages/shared/src/constants/creature-moves.ts`)

```ts
interface Move {
  id: string;
  name: string;
  type: CreatureType;
  category: MoveCategory;
  power: number;                      // 0 for status moves
  accuracy: number;                   // 0–100
  priority: number;                   // -7..+5, default 0
  description: string;
  statusInflict?: { condition: StatusCondition; chance: number };
  statStageChange?: { target: "self" | "opponent"; stat: StatKey; delta: number; chance: number };
  weatherSet?: Weather;
  terrainSet?: Terrain;
  critRatio?: number;                 // 0 normal, 1 high-crit
}
```

Phase 1 ships a curated starter pool of **~80 moves** covering core combat shapes.

### 6.4 `CreatureInstance` (per-roster state, lives on Persona/Character)

```ts
interface CreatureInstance {
  instanceId: string;
  speciesId: string;
  nickname: string | null;
  level: number;                      // 1–100
  currentExp: number;                 // resets to 0 each level-up
  currentHp: number;                  // persists between battles
  moves: string[];                    // exactly 4 moveIds, from learnableMoves at/below current level
  heldItemId: string | null;
  status: StatusCondition;            // persists between battles
}
```

### 6.5 Held items (registry in `packages/shared/src/constants/creature-items.ts`)

```ts
interface HeldItem {
  id: string;
  name: string;
  description: string;
  trigger: "passive" | "on_attack" | "on_hit" | "end_of_turn" | "on_low_hp" | "on_switch_in";
  effectKind: "heal" | "damage_mod" | "stat_mod" | "survive_ko" | "speed_mod" | "lock_move";
  amount?: number;
  threshold?: number;
  affectedType?: CreatureType;
}
```

Phase 1 starter set: ~10–15 staple items. Confirmed: Leftovers, Oran Berry, Sitrus Berry, Life Orb, Choice Band, Choice Specs, Choice Scarf, Focus Sash, Eviolite, plus type-boosting items (one per type, condensed).

### 6.6 Bag items — reuse existing `PlayerStats.inventory`

**Important:** Marinara Engine already has a chat-scoped inventory system used by the existing Encounter combat. Creature Battles **reuses** it rather than introducing a parallel store.

**Existing storage:** `PlayerStats.inventory: InventoryItem[]` (lives on game-state snapshots — `packages/shared/src/types/game-state.ts:113`). Per-chat, per-message snapshot. The existing Encounter system reads from this same source (`encounter.routes.ts:228-232, 356-378`) and asks the LLM to interpret each item into a `CombatItemEffect` per encounter — i.e. items are intentionally LLM-mediated when used by the existing combat system.

**Existing shape:**
```ts
interface InventoryItem {
  name: string;
  description: string;
  quantity: number;
  location: string;        // "on_person" | "stored" | custom
}
```

**Existing UI:** `PersonaInventoryRow.tsx` in the tracker panel handles add/edit/remove + quantity. No new bag-editor screen needed.

**Creature Battles extension — additive, backwards compatible:**

Add one optional field to `InventoryItem` to opt items into **deterministic** mechanical effects for Creature Battles. Items without this field still work — they fall back to LLM narration via the modal's free-text input (mirroring how the existing Encounter system already handles items).

```ts
// Additive change to packages/shared/src/types/game-state.ts
interface InventoryItem {
  name: string;
  description: string;
  quantity: number;
  location: string;
  /** Optional: typed mechanical effect for Creature Battles. When present, the
   *  battle engine applies it deterministically. When absent, the item is
   *  narrative-only (free-text input route, same as Encounter system behavior). */
  creatureBattleEffect?: CreatureBattleEffect;
}

type CreatureBattleEffect =
  | { kind: "heal"; amount: number; isPercentage: boolean }
  | { kind: "cure_status"; statuses: Exclude<StatusCondition, null>[] }
  | { kind: "revive"; restoreFraction: number }   // 0..1 of maxHp restored on revive
  | { kind: "ball"; ballTypeId: string }          // FK → BallType registry (§6.7)
  | { kind: "stat_stage"; stat: StatKey; delta: number };
```

**Routing in the Creature Battle modal's "Item" panel:**

- Reads from `PlayerStats.inventory` for the current chat
- Items with `creatureBattleEffect.kind === "ball"` are routed to `POST /catch`
- Items with any other `creatureBattleEffect` are routed to `POST /action` with `kind: "item"`
- Items *without* `creatureBattleEffect` are still shown but marked "narrative" — selecting one routes through `POST /free-text` so the agent can interpret narratively (same flexibility the existing Encounter system already provides)
- All routes decrement `quantity` by 1 on the server when the item is consumed; `quantity === 0` entries can stay (existing pattern) or be filtered client-side

**Scope note — deliberate asymmetry:**

This results in Creature Battles having:
- **Creatures** on the persona (cross-chat — decided in §6.9)
- **Inventory** on the chat (per-chat — matches existing system)

This matches Pokemon canon's mental model: your team travels with you, but each playthrough/save file has its own bag. It also avoids forking inventory across two storage scopes. Surfaced explicitly here so it's a deliberate decision, not an oversight.

### 6.7 Ball registry (`packages/shared/src/constants/creature-balls.ts`)

```ts
interface BallType {
  id: string;
  name: string;
  catchMultiplier: number;   // 1.0 for pokeball, 1.5 great, 2.0 ultra, etc.
  description: string;
  guaranteed?: boolean;      // master ball
}
```

Phase 1 starter: pokeball (1.0), great_ball (1.5), ultra_ball (2.0), premier_ball (1.0 cosmetic), master_ball (guaranteed).

### 6.8 Active battle state (transient, agent memory)

Stored in `agent_memory` keyed by `(agentConfigId: "creature-battles", chatId, key: "activeBattle")`. Persistent across modal close, browser refresh, server restart.

```ts
interface CreatureBattleState {
  battleId: string;
  chatId: string;
  format: BattleFormat;
  stateVersion: number;               // optimistic concurrency guard
  playerSide: BattleSide;
  opponentSide: BattleSide;
  weather: Weather;
  terrain: Terrain;
  weatherTurnsLeft: number;
  terrainTurnsLeft: number;
  turnNumber: number;
  log: BattleLogEntry[];
  result?: BattleResult;
  active: boolean;
  startedAt: string;
  endedAt?: string;
}

interface BattleSide {
  ownerKind: "persona" | "character" | "wild" | "adhoc-trainer";
  ownerId: string | null;
  ownerName: string;
  isAiControlled: boolean;
  activeSlots: (CreatureInstance | null)[];   // length 1 or 2
  benchInstanceIds: string[];
  aiPersonality?: AiPersonality;
}

interface BattleLogEntry {
  timestamp: number;
  type:
    | "player-action" | "opponent-action" | "ai-ally-action"
    | "status-tick" | "weather-tick" | "item-trigger"
    | "switch" | "faint" | "catch-attempt" | "evolution-prompt"
    | "system" | "narrative";
  message: string;
  rolls?: { kind: string; value: number; threshold?: number }[];   // optional dice/random rolls for debug
}
```

### 6.9 Additions to existing types

```ts
// packages/shared/src/types/persona.ts (additive)
interface Persona {
  // ...existing fields...
  creatureRoster?: CreatureInstance[];
  creatureBox?: CreatureInstance[];       // Phase 1.5: overflow beyond party-of-6
}
// NOTE: No bag/inventory field added. Inventory reuses the existing per-chat
// PlayerStats.inventory (see §6.6).

// packages/shared/src/types/character.ts (additive, inside extensions)
interface CharacterExtensions {
  // ...existing fields...
  creatureRoster?: CreatureInstance[];
  aiPersonality?: AiPersonality;          // tweaks heuristic for opponent decisions
}

// packages/shared/src/types/game-state.ts (additive, optional field on existing type)
interface InventoryItem {
  // ...existing fields (name, description, quantity, location)...
  creatureBattleEffect?: CreatureBattleEffect;   // optional opt-in to deterministic mechanics; see §6.6
}
```

Roster fields default `undefined` for personas/characters that never enable the feature — zero impact on existing users. The `creatureBattleEffect` field on `InventoryItem` is optional and additive — existing inventory items continue to work identically.

### 6.10 DB schema additions (Drizzle)

```ts
// packages/server/src/db/schema/creatures.ts (new file)
export const creatureSpecies = sqliteTable("creature_species", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  types: text("types").notNull(),          // JSON: CreatureType[]
  baseStats: text("base_stats").notNull(), // JSON: Stats
  catchRate: integer("catch_rate").notNull().default(45),
  xpCurve: text("xp_curve", { enum: ["fast", "medium", "slow"] }).notNull().default("medium"),
  learnableMoves: text("learnable_moves").notNull().default("[]"),  // JSON
  evolution: text("evolution"),                                      // JSON nullable
  spritePath: text("sprite_path"),
  tags: text("tags").notNull().default("[]"),                        // JSON
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

Verified by `pnpm db:push` per `CLAUDE.md` workflow.

---

## 7. Battle Engine

### 7.1 Round resolution order

```
1. Collect actions from each slot:
   - Player slots: from POST /action body
   - AI slots:    from aiSelectAction(state, slot) heuristic
2. Apply structured priority:
   a. SWITCH actions (all sides) — resolve first, in declared order
   b. ITEM use actions — resolve second
   c. ATTACK actions — sort by (Move.priority desc, Speed desc, random tiebreak)
3. For each attack in order:
   - If attacker fainted earlier this round → skip
   - Pre-attack status checks:
     - paralysis: 25% skip
     - sleep: tick counter (1–3 turns); skip if still sleeping
     - freeze: 20% thaw chance; otherwise skip
     - confusion: 33% self-hit (typeless physical damage); otherwise proceed
   - Compute damage (see §7.2)
   - Apply hit effects (status inflict roll, stat-stage change, weather/terrain set)
   - Trigger held-item effects (on_attack, on_hit)
   - Check for faint → mark slot empty, queue forced switch for next round
4. End-of-turn phase:
   - Weather damage tick: sandstorm/hail 1/16 max HP (type-immune respected)
   - Grassy terrain heal: 1/16 max HP for grounded creatures
   - Status damage tick: burn 1/16, poison 1/8 max HP
   - End-of-turn held items: Leftovers heal 1/16
   - Decrement weather/terrain timers; clear at 0
5. Check victory:
   - If one side has all roster fainted (active + bench) → opposite side wins
   - Persist new state, return delta to client
```

### 7.2 Damage formula

Adapted from Gen V+ canon, simplified:

```
damage = floor(
  ((2 * level / 5 + 2) * power * (atkStat * atkStageMult) / (defStat * defStageMult)) / 50
  + 2
) * stab * typeMult * critMult * weatherMult * itemMult * burnMult * random
```

| Factor | Value |
|---|---|
| `stab` | 1.5 if move.type ∈ attacker.species.types, else 1.0 |
| `typeMult` | Product of effectiveness vs each defender type (0, 0.25, 0.5, 1, 2, 4) |
| `critMult` | 1.5 with crit chance based on `Move.critRatio` (1/24 normal, 1/8 high-crit) |
| `weatherMult` | sun: fire ×1.5, water ×0.5; rain: water ×1.5, fire ×0.5; else 1.0 |
| `itemMult` | Combined held-item modifiers (Life Orb 1.3, Choice Band 1.5 on physical, type-booster 1.2) |
| `burnMult` | 0.5 if attacker has burn AND move is physical, else 1.0 |
| `random` | uniform in [0.85, 1.0] |
| `atkStageMult` | Stat-stage modifier: 2/(2-stage) if stage ≤ 0; (2+stage)/2 if stage > 0; clamped ±6 |

### 7.3 Type chart

Static 18×18 lookup in `packages/shared/src/constants/creature-types.ts`. Mechanical copy from canon — type names (Fire, Water, etc.) are generic and unencumbered.

### 7.4 Catch formula

Canonical Gen V+ formula, deterministic except for RNG:

```ts
function runCatchFormula(target: CreatureInstance, species: CreatureSpecies, ball: BallType): { caught: boolean; shakes: 0 | 1 | 2 | 3 | 4 } {
  if (ball.guaranteed) return { caught: true, shakes: 4 };

  const statusMod =
    target.status === "sleep" || target.status === "freeze" ? 2.5
    : target.status === "paralysis" || target.status === "burn" || target.status === "poison" ? 1.5
    : 1.0;

  const maxHp = recalcStatsFromBase(species, target.level).hp;
  const a = ((3 * maxHp - 2 * target.currentHp) * species.catchRate * ball.catchMultiplier) / (3 * maxHp) * statusMod;

  if (a >= 255) return { caught: true, shakes: 4 };

  const b = Math.floor(65536 / Math.pow(255 / a, 3 / 16));

  // 4 shake checks
  let shakes: 0 | 1 | 2 | 3 | 4 = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(Math.random() * 65536) < b) shakes++;
    else return { caught: false, shakes: shakes as 0 | 1 | 2 | 3 };
  }
  return { caught: true, shakes: 4 };
}
```

UI animates 1 shake per checkpoint; final result revealed when all 4 land or one fails.

### 7.5 AI heuristic action selection

Deterministic; no per-turn LLM call. Per `CLAUDE.md` cost/latency concerns, LLM is only consulted at battle initiation, ad-hoc opponent generation, end-of-battle summary, and explicit free-text input.

```
aiSelectAction(state, slot):
  candidates = []
  for move in slot.creature.moves:
    expectedDmgPct = predictDamage(slot, opposingActive, move) / opposingActive.maxHp
    candidates.push({ kind: "attack", move, score: expectedDmgPct * move.accuracy / 100 })

  for benchId in slot.side.benchInstanceIds:
    if hasTypeAdvantage(bench, opposingActive) AND currentSlotHasTypeDisadvantage:
      candidates.push({ kind: "switch", target: bench, score: 0.5 })  // switching costs a turn

  if slot.creature.currentHp / maxHp < 0.30:
    for invItem in chatInventory (player side only — AI opponents don't dip into player bag):
      if invItem.creatureBattleEffect?.kind === "heal":
        candidates.push({ kind: "item", target: slot.creature, score: 0.7 })
  # NOTE: wild creatures and most NPC trainers have no bag — only player can use bag items.
  # Trainers may have a per-character itemPouch field added in Phase 2 if desired.

  # Personality weights
  if slot.side.aiPersonality === "aggressive": multiply attack scores ×1.3
  if slot.side.aiPersonality === "defensive": multiply switch/item scores ×1.3
  # "balanced" — no modifier

  return candidates.maxBy(score)
```

---

## 8. Agent — `creature-battles`

A new parallel-phase agent (`phase: "parallel"`), default-off, opt-in per chat via settings.

### 8.1 Responsibilities

1. **Detect battle context** — scan recent narrative turns for cues that a creature battle is starting (rival appearing, wild creature emerging, explicit player intent). Output: structured JSON.
2. **Compose battle invitations** — produce a `creature_battle_invitation` agent result that the UI renders as an inline `ChatInvitationCard` with Accept / Decline buttons. New `AgentResultType`.
3. **Generate ad-hoc opponents** — when context implies an unscripted encounter, pick an appropriate species from the library, then spawn a `CreatureInstance` at a level appropriate to the player's average team level. May rarely `define_creature_species` if no fitting template exists.
4. **Generate post-battle summaries** — after a battle ends, produce narrative summary text injected as a chat message (`creature_battle_summary` agent result type).
5. **Apply progression** — call `award_experience` for each defeated opponent creature; the tool handles level-up, stat recalc, and evolution rule checks internally.
6. **Mediate catching free-text** — if the player types "I throw an Ultra Ball at it" in the free-text input, agent interprets, identifies the ball, calls `catch_creature` which runs the formula.
7. **Auto-pause Combat agent** — handled by the orchestrator runtime branch, not by the agent itself. Documented here for completeness.

### 8.2 Agent prompt guardrails

The agent's prompt template explicitly states:
- **No per-turn LLM consultation during active battles.** AI action selection is deterministic.
- **SFW only.** Reinforce content guidance in the agent prompt.
- **Use existing species when possible.** Only `define_creature_species` when no template fits the narrative.
- **Validate tool inputs.** Never invent move IDs, item IDs, or species IDs that aren't in the registries.

### 8.3 Tools

Registered in `BUILT_IN_TOOLS` alongside existing tools.

| Tool | Purpose | Critical validations |
|---|---|---|
| `start_creature_battle` | Initiate a battle (format, opponent side spec) | Player has ≥1 living creature; opponent valid |
| `spawn_creature_instance` | Create a `CreatureInstance` from a `speciesId` at given level | speciesId exists, level ∈ [1, 100] |
| `define_creature_species` | Create a new `CreatureSpecies` entry | All required fields, types ≤ 2 enum-valid, baseStats ∈ [1, 255], catchRate ∈ [1, 255], xpCurve ∈ enum, evolution target exists |
| `update_creature_roster` | Mutate fields on a `CreatureInstance` in a trainer's roster | Trainer owner exists, instanceId in roster, field ranges valid |
| `award_experience` | Grant XP; internally handles level-up, stat recalc, evolution check | xpAmount ≥ 0, creature exists, level not at cap. Returns structured result describing what changed. |
| `catch_creature` | Run catch formula; if caught, move wild creature to player's roster | Wild creature exists in current battle, ball in registry; idempotent if already caught |

Every tool returns a structured result the agent can narrate over. Validation failures are returned as errors (not silent defaults) so the LLM self-corrects.

### 8.4 New `AgentResultType` values

```ts
// added to AgentResultType union in packages/shared/src/types/agent.ts
| "creature_battle_invitation"
| "creature_battle_summary"
| "creature_battle_state_update"        // for incremental state hints to other agents
```

---

## 9. API Surface

All endpoints mounted in a new router file. All responses typed via shared request/response types. All server code uses Pino logger.

### 9.1 Battle lifecycle

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/creature-battle/init` | Start a battle |
| GET  | `/api/creature-battle/:chatId/state` | Fetch current battle state (modal reopen / refresh) |
| POST | `/api/creature-battle/action` | Submit structured player action; server resolves round |
| POST | `/api/creature-battle/catch` | Attempt to catch a wild creature (runs the formula) |
| POST | `/api/creature-battle/free-text` | Submit free-text player input; agent interprets |
| POST | `/api/creature-battle/end` | Force-end (forfeit / interrupt); auto-end fires from `/action` on victory/defeat |

### 9.2 Species library CRUD

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/creature-species` | List (paginated, searchable) |
| POST | `/api/creature-species` | Create |
| GET | `/api/creature-species/:id` | Read |
| PUT | `/api/creature-species/:id` | Update |
| DELETE | `/api/creature-species/:id` | Delete |

### 9.3 Request/response shapes

Typed in `packages/shared/src/types/creature.ts` alongside the data model. Mirror the `EncounterInitRequest`/`Response` conventions:

```ts
interface CreatureBattleInitRequest {
  chatId: string;
  format: BattleFormat;
  opponent:
    | { kind: "wild"; speciesId: string; level: number }
    | { kind: "character"; characterId: string }
    | { kind: "adhoc"; opponentInstances: CreatureInstance[]; trainerName?: string };
  playerSlotInstanceIds: string[];     // 1 or 2 from active persona's roster
}
interface CreatureBattleInitResponse { state: CreatureBattleState; }

interface CreatureBattleActionRequest {
  chatId: string;
  stateVersion: number;                // optimistic concurrency
  actions: PlayerAction[];             // 1 or 2 actions (single or double)
}
interface CreatureBattleActionResponse { state: CreatureBattleState; deltaLog: BattleLogEntry[]; }

type PlayerAction =
  | { kind: "attack"; slotIndex: 0 | 1; moveId: string; targetIndex?: 0 | 1 }
  | { kind: "switch"; slotIndex: 0 | 1; benchInstanceId: string }
  | { kind: "item"; slotIndex: 0 | 1; inventoryItemName: string; targetInstanceId: string }   // matched by name against PlayerStats.inventory for the current chat
  | { kind: "run" };

interface CatchAttemptRequest {
  chatId: string;
  stateVersion: number;                // optimistic concurrency, same as /action
  slotIndex: 0 | 1;
  ballInventoryItemName: string;       // matched against PlayerStats.inventory; item must have creatureBattleEffect.kind === "ball"
  targetInstanceId: string;
}
interface CatchAttemptResponse {
  state: CreatureBattleState;          // updated state (one ball consumed; instance moved to roster on success)
  caught: boolean;
  shakes: 0 | 1 | 2 | 3 | 4;
  rosterUpdated: boolean;
}

interface FreeTextActionRequest {
  chatId: string;
  stateVersion: number;
  text: string;
}
interface FreeTextActionResponse {
  interpretation: "structured-action" | "narrative-only" | "clarification-needed";
  structuredAction?: PlayerAction;        // present when interpretation === "structured-action" — server resolves the round
  narrativeMessage?: string;              // present when interpretation === "narrative-only" — appended to battle log; no round resolution
  clarificationPrompt?: string;           // present when interpretation === "clarification-needed" — shown inline above the free-text input as a prompt; no state mutation; player resubmits
  state?: CreatureBattleState;            // updated state when a round actually resolved (structured-action only)
  deltaLog?: BattleLogEntry[];            // delta log entries when state mutated
}

interface EndBattleRequest { chatId: string; reason: "forfeit" | "interrupt"; }
interface EndBattleResponse {
  state: CreatureBattleState;
  summaryMessageId: string;
  rosterDiffs: Array<{
    trainerKind: "persona" | "character";
    trainerId: string;
    instanceId: string;
    changes: Partial<CreatureInstance>;     // diff of mutated fields
    evolutionAvailable?: { fromSpeciesId: string; toSpeciesId: string };
  }>;
}
```

---

## 10. Client UI

### 10.1 `CreatureBattleModal.tsx`

Layout modeled on `EncounterModal.tsx` (framer-motion, lucide icons, color-coded HP bars).

```
┌─────────────────────────────────────────────────────────────┐
│ [X]   ⚔ Creature Battle — vs Wild Charizard                 │
├─────────────────────────────────────────────────────────────┤
│  ☀ Sun (3 turns)    🌱 Grassy Terrain (2 turns)             │
├─────────────────────────────────────────────────────────────┤
│  OPPONENT SIDE                                              │
│  [sprite] Charizard Lv 45 🔥💧                               │
│           HP ▰▰▰▰▰▰▰▱▱▱ 62%  [poison] [+1 atk]              │
├─────────────────────────────────────────────────────────────┤
│  ── BATTLE LOG (scrolling, latest 5–8 turns) ──             │
│  • Pikachu used Thunderbolt! Super effective! (84 dmg)      │
│  • Charizard's Sitrus Berry restored HP                     │
│  • Charizard used Flamethrower! Pikachu took 31 dmg         │
├─────────────────────────────────────────────────────────────┤
│  PLAYER SIDE                                                │
│  [sprite] Pikachu Lv 42 ⚡                                   │
│           HP ▰▰▰▰▰▰▰▰▱▱ 78%                                 │
├─────────────────────────────────────────────────────────────┤
│  YOUR ACTIONS                                               │
│  [⚔ Fight] [🔄 Switch] [🎒 Item] [🏃 Run]                    │
│                                                             │
│  [Thunderbolt ⚡85] [Quick Atk 🌫40] [Iron Tail ⚙100] [...]  │
│                                                             │
│  ── Custom Action ──                                        │
│  [ Describe what you do...           ]      [→ Send]        │
└─────────────────────────────────────────────────────────────┘
```

Sub-components (each in its own file):

| Component | Purpose |
|---|---|
| `CreatureCard` | Sprite + name + level + types + HP bar + status badges |
| `HPBar` | Color-coded (green/yellow/red for player; red/orange for opponent) — same color logic as `EncounterModal.HPBar` |
| `StatusBadges` | Tiny pills for active statuses + stat stages |
| `BattleLog` | Scrolling log, color-coded by entry type |
| `WeatherTerrainBanner` | Top banner shown only when weather or terrain is active |
| `ActionPanel` | Fight / Switch / Item / Run + contextual expansion |
| `MoveButton` | Name + type chip + power number, color-coded by type |
| `SwitchGrid` | 6 slots showing bench creatures; fainted grayed out |
| `ItemList` | Items from `PlayerStats.inventory` for the current chat. Items with `creatureBattleEffect` are highlighted with their effect kind; items without are marked "narrative" and route through the free-text input. |
| `CustomActionInput` | Text input + submit (mirrors `EncounterModal` lines 595–611) |
| `CatchAnimation` | Ball-shake visual (4 shakes max) — overlay during catch attempts |
| `EvolutionPrompt` | Inline chat prompt for evolution acceptance |

### 10.2 `CreatureSpeciesEditor.tsx`

New top-level route alongside Personas, Characters, Lorebooks. Sidebar entry with a creature-pawprint icon (to distinguish from existing entities).

Layout (key fields):
- Sprite uploader + path display
- Name, description (markdown-aware)
- Type 1 / Type 2 selectors (enum dropdowns)
- Catch Rate slider 1–255 (with canonical-reference labels: "Legendary: 3", "Starter: 45", "Common: 255")
- XP Curve dropdown (fast/medium/slow)
- Base Stats grid with individual sliders + total-display
- Evolution rule builder (trigger type + target species)
- Learnable Moves table (move + learn-level)
- Tags input
- Save / Delete / Duplicate buttons

### 10.3 Roster editor (inside existing Persona / Character editors)

New collapsible section "Creature Roster" added to existing editors. Up to 6 entries:

- Each entry: sprite + name/nickname + species + level + current HP + status + held item
- [edit] opens an InstanceEditor sub-modal: nickname, level, currentExp, currentHp, moves (4 picker), heldItemId, status
- [×] removes from roster (with confirmation)
- [+ Add creature from species library] → species picker + level input → spawns instance
- Phase 1.5: [Switch to box view] toggle

**No new bag editor.** Inventory editing already lives in the existing tracker panel via `PersonaInventoryRow` (per-chat, free-text items). Creature Battles reuses that. The only new wrinkle: when editing an inventory item, add an *optional* "Creature Battle effect" sub-form that lets the user opt the item into a typed mechanical effect (heal / cure_status / revive / ball / stat_stage) for the deterministic engine. Items without this field continue to work narratively via the free-text input — same as today's Encounter behavior.

For Character only: `aiPersonality` dropdown (aggressive / defensive / balanced).

### 10.4 Chat header surface

In **roleplay mode only**, the chat header gets a new icon button (Sparkles or custom paw-print SVG — explicitly NOT lucide `Swords` to avoid visual collision with the Encounter modal button in game mode). Clicking opens `BattleSetupMiniModal`:

- Format: Single / Double
- Opponent source: Wild (species picker + level) OR Character (picker from existing characters with rosters)
- Player team selection: 1 or 2 slots from active persona's roster

When a battle is active in this chat, the button shows a "Resume Battle" badge instead of opening setup. Clicking reopens the existing modal.

### 10.5 Inline `ChatInvitationCard`

Renders when an agent run produces a `creature_battle_invitation` result. Inline in the chat scroll above the agent's narrative response:

```
┌─────────────────────────────────────────────┐
│  ⚔ A wild Charizard appears!                │
│  Lv 45 · Fire/Flying                        │
│  [Accept Battle]  [Decline]                 │
└─────────────────────────────────────────────┘
```

Accept → calls `/init` with the pre-spawned opponent. Decline → no-op, normal chat continues.

---

## 11. Lifecycle

### 11.1 Initiation

**Path A (player-initiated):**
Chat header button → `BattleSetupMiniModal` → user picks format + opponent + team → `POST /init` → server creates `CreatureBattleState`, persists to agent memory, returns state → client opens modal.

**Path B (agent-initiated):**
`creature-battles` agent runs in parallel phase, detects battle context, produces `creature_battle_invitation` result containing pre-spawned opponent → chat UI renders `ChatInvitationCard` → user clicks Accept → same flow as Path A from `/init`.

### 11.2 During battle

Each round:
1. Player chooses action via UI (structured) or free-text input
2. Structured action → `POST /action`. Free-text → `POST /free-text` → agent interprets → maps to structured action OR narrative-only beat.
3. Server `resolveRound`: collects AI opponent actions via heuristic, applies priority (Switch → Item → Attack), runs damage/status math, applies held-item triggers, end-of-turn ticks, checks victory.
4. Server persists state to agent memory, returns updated state + delta log entries.
5. Client renders updates with animations.

Combat agent: auto-paused throughout (orchestrator runtime check).

Modal close ≠ battle end: state persists, chat header shows "Resume Battle" badge.

Browser refresh: state restored via `GET /:chatId/state` on chat reload; modal reopens automatically.

### 11.3 End

Triggers: victory, defeat, fled (wild only), interrupted.

`/end` handler (auto-fires from `/action` on victory/defeat; explicit for fled/interrupted):

1. Apply progression: for each defeated opponent, `award_experience` to *participating* player creatures (any creature that was in an active slot at some point during this battle)
2. Compute level-ups; recalc stats from species baseStats; cap at level 100
3. Check evolution rules per leveled creature; collect `evolutionAvailable` entries into the `rosterDiffs` payload (entries are queued, not auto-applied)
4. Catches: no work here — catches happen synchronously during `POST /catch` mid-battle. The `/end` handler does NOT re-run catch logic; this is just where any post-battle bookkeeping (e.g. resetting transient catch flags on the wild side) lives. Mentioned for completeness.
5. Persist all roster mutations to Persona / Character DB rows in a single transaction
6. Generate end-of-battle summary via LLM (mirrors `EncounterSummaryResponse` pattern); inject as a chat message — the message rendering includes inline `EvolutionPrompt` cards (one per `evolutionAvailable` entry from step 3) directly below the summary text
7. Clear `active: true` from `CreatureBattleState`; mark with `result`; retain final state in agent memory for the chat's history
8. Combat agent resumes on next chat turn (no explicit action needed)

### 11.4 Evolution flow

When `award_experience` triggers a level-up that meets an evolution rule:
- The tool result includes `evolutionAvailable: { instanceId, fromSpeciesId, toSpeciesId }`
- Agent's summary message includes inline `EvolutionPrompt` card per creature
- User clicks Accept → `update_creature_roster` mutates `speciesId`, stats recalc; `Cancel` → no change, state preserved on instance so the same evolution can re-trigger after another level-up (canonical behavior)

### 11.5 Between battles

- Status conditions persist (poison stays unless cured) — canonical
- Current HP persists (fainted stays fainted until healed)
- Healing surfaces: roster editor (manual edit), bag items (Potions / Revives), agent narrative grants ("you rest at the inn" → agent calls `update_creature_roster`)
- Roster reorder / move swap / held item changes — roster editor sub-modal, between battles only

---

## 12. Co-existence

### 12.1 Combat agent auto-pause

Single runtime branch in the agent orchestrator. Zero code change to the existing Combat agent.

```ts
for (const agent of parallelAgents) {
  if (agent.id === "combat" && await isCreatureBattleActive(chatId)) {
    logger.debug("Skipping combat agent: creature battle active in chat %s", chatId);
    continue;
  }
  await runAgent(agent, ctx);
}

async function isCreatureBattleActive(chatId: string): Promise<boolean> {
  const state = await getAgentMemory("creature-battles", chatId, "activeBattle");
  return state?.active === true && !state.result;
}
```

Gated by `creatureBattleSettings.pauseCombatAgent` (default `true`) on the chat. User can disable to run both simultaneously at their own risk of contradictory narrative state.

### 12.2 Encounter system

Encounter lives in game mode; Creature Battles in roleplay mode (Phase 1). No runtime interaction — they cannot coexist in the same chat by chat-mode design. Documented here for future-phase consideration when Creature Battles potentially expands beyond roleplay mode.

### 12.3 Chat mode binding

`CHAT_MODES.roleplay.defaultAgents` is NOT modified — Creature Battles is opt-in per chat, not on by default. Adding to defaults could be a Phase 2 decision after the feature has soaked.

---

## 13. Error Handling

### 13.1 Server (engine + API)

Defensive checks before any state mutation:

| Validation | On failure |
|---|---|
| `chatId` has active battle | 409 — "No active battle for this chat" |
| `stateVersion` matches server's current | 409 — stale state, client must refetch via `/state` |
| Player action targets a slot they own | 403 — "Cannot control opponent slot" |
| Switch target is non-fainted, non-active bench | 400 — return reason, no state mutation |
| Item exists in chat inventory and quantity > 0 | 400 — return reason |
| Item's `creatureBattleEffect` (if present) is valid for the chosen action | 400 — return reason |
| Move ID is among creature's 4 current moves | 400 — return reason |

All engine functions are **pure** (no DB access). They accept full `CreatureBattleState` snapshots; the route handler is the single point of persistence. This makes rollback trivial — if any post-engine step fails, the in-memory state is discarded and the prior persisted state is the source of truth.

### 13.2 Agent tools

Every tool validates input at the boundary. Validation failures return structured errors (not silent defaults) — the LLM receives the error and self-corrects. All tool errors logged via Pino at `warn` level. See §8.3 for per-tool validations.

### 13.3 Client

| Scenario | Behavior |
|---|---|
| Network failure during `/action` | "Couldn't submit action — retry?" with retry button; server state is source of truth |
| Stale-state 409 | Silent refetch via `/state`, retry action once, surface error if retry fails |
| Active battle 404 | Modal closes, toast: "Battle ended unexpectedly" |
| Missing sprite asset | Fallback to type-icon placeholder |

Client uses `console.error` per `CLAUDE.md` (server uses Pino, client doesn't).

### 13.4 Edge cases

| Scenario | Behavior |
|---|---|
| Player closes modal mid-battle | State persists; "Resume Battle" badge on header |
| Browser refresh during battle | State restored via `/state`; modal reopens |
| Server restart during battle | State survives (agent memory is DB-backed) |
| Undo message that triggered battle | Confirm dialog: "End in-progress battle? It will resolve as Interrupted." Yes → force `/end interrupted`; No → undo blocked |
| Player switches active persona mid-battle | Blocked; toast: "End current battle first." |
| Roster edit mid-battle | Roster fields read-only-with-warning while battle active |
| Two chats with simultaneous battles | Independent — keyed by `chatId` |
| Creature reaches level 100 mid-battle | XP capped; battle continues |
| Held item destroyed mid-battle (consumed berry) | `heldItemId` set to `null`, persists |
| Species deleted while in active roster | Block deletion; surface UI warning listing all owning trainers |

---

## 14. Testing

### 14.1 `pnpm check` (mandatory, per CLAUDE.md)

- TypeScript clean
- ESLint clean

### 14.2 `pnpm db:push` (mandatory)

- `creature_species` table applies cleanly
- Existing tables unchanged

### 14.3 Engine unit tests (new — `vitest`)

First test infrastructure in the project. Scoped strictly to deterministic engine math. Added in Phase 1.2.

- New dev dep: `vitest`
- New `pnpm test` script at root
- Test files colocated with engine: `creature-battle.service.test.ts`, `creature-progression.service.test.ts`

Test coverage targets:
- Damage formula: type effectiveness multipliers, STAB, crit, weather, items, burn-physical reduction, stat-stage modifiers
- Type chart: all 18×18 matchups (snapshot test)
- Status ticks: burn/poison/sleep counters, paralysis skip roll, freeze thaw, confusion self-hit
- Stat stages: clamping at ±6, multiplier formula correctness
- Catch formula: edge cases (full HP, 1 HP, asleep, master ball, catchRate=3 legendary, catchRate=255 common)
- XP / level-up: stat recalc at level-up, evolution rule triggering, level-100 cap
- AI heuristic scoring: aggressive vs defensive vs balanced personality differences

### 14.4 Manual verification (PR checklist — unchecked per CLAUDE.md AI-PR rule)

To live in each PR description:

- [ ] Roleplay-mode chat shows the new battle button in header; other modes don't
- [ ] Create a species, persona with roster of 2, start a wild battle — confirm damage math via log details
- [ ] Type effectiveness: Water-on-Fire = 2x, Electric-on-Ground = 0x
- [ ] Status: burn ticks 1/16 maxHP at end-of-turn; burn halves physical Attack damage
- [ ] Catching: low-HP statused wild = high catch rate; full-HP healthy = low catch rate
- [ ] Evolution: level-up that hits threshold triggers inline `EvolutionPrompt`
- [ ] Combat agent confirmed paused (agent run history shows skip log) during active battle
- [ ] Browser refresh mid-battle restores modal in correct state
- [ ] Persona/Character with no roster shows no UI changes (clean opt-in)
- [ ] Existing Encounter modal in game mode still works (regression check)
- [ ] Existing Combat agent in roleplay mode still works (regression check)

---

## 15. Phasing

Five PRs against `staging`, each independently reviewable, each opening as a draft PR per CLAUDE.md agent-coordination rule.

### Phase 1.0 — Foundations (no user-visible feature)

- Shared types in `packages/shared/src/types/creature.ts`
- Constants: type chart, status registry, weather/terrain registry, move registry (~80 starter), held-item registry (~15), ball registry (~5)
- DB migration: `creature_species` table
- Roster JSON fields on Persona (creatureRoster, creatureBox) and CharacterExtensions (creatureRoster, aiPersonality)
- Optional `creatureBattleEffect` field added to existing `InventoryItem` shape (additive, backwards compatible) + ~10 starter inventory presets (Potion, Antidote, Revive, ball variants, etc.) that users can quickly seed into their chat inventory
- New `AgentResultType` union additions
- `pnpm check` + `pnpm db:push` clean

### Phase 1.1 — Species Editor

- CRUD endpoints for `/api/creature-species/...`
- `CreatureSpeciesEditor.tsx` + new top-level route + sidebar entry
- Read-only end-to-end verification

### Phase 1.2 — Battle Engine + Tests

- `creature-battle.service.ts` (pure functions)
- `creature-progression.service.ts`
- Battle API endpoints (init/state/action/catch/free-text/end)
- AI heuristic action selection
- Roster persistence to Persona/Character
- `vitest` dev dependency + `pnpm test` script
- Engine unit tests

### Phase 1.3 — Battle Modal + Roster Editor + Inventory Sub-form

- `CreatureBattleModal.tsx` + all sub-components
- Roster editor sections in Persona & Character editors
- Tracker-panel `PersonaInventoryRow` extended with optional "Creature Battle effect" sub-form (no new editor; reuses existing UI)
- `aiPersonality` selector (Character only)
- Chat header button in roleplay mode
- `BattleSetupMiniModal`
- Browser-refresh restoration via `/state`

### Phase 1.4 — Agent + Co-existence

- `creature-battles` agent registration with prompt template
- Tool registrations (`start_creature_battle`, `spawn_creature_instance`, `define_creature_species`, `update_creature_roster`, `award_experience`, `catch_creature`)
- `ChatInvitationCard` component
- `EvolutionPrompt` inline card
- Combat agent auto-pause orchestrator branch
- End-to-end manual verification

---

## 16. Rollout & Migration

- **Feature toggle:** No global flag needed. Agent is opt-in per chat (default disabled); personas/characters with no roster see zero UI changes.
- **DB migration:** Single new table (`creature_species`). Roster JSON fields on Persona + optional `creatureBattleEffect` field on existing `InventoryItem` shape — all additive, no breaking change.
- **Branch:** `feature/creature-battles` → `staging` (per CLAUDE.md).
- **Logging:** All server code uses `logger` from `lib/logger.js`. Pino format specifiers throughout. Errors logged with error-object first.
- **PR descriptions:** Manual verification checklist as unchecked boxes (per CLAUDE.md AI-PR rule). Why-the-change-matters paragraph in each PR.
- **Agent coordination:** Draft PR opened at start of each phase per CLAUDE.md. Issue owner tagged on the linked issue.

---

## 17. Documentation Touch Points (per CLAUDE.md)

To check/update during the feature work:

- `README.md` — mention Creature Battles in feature list (Phase 1.4 PR)
- `CHANGELOG.md` — entry under next version (every PR)
- `docs/CONFIGURATION.md` — new agent + settings flag documented (Phase 1.4 PR)
- `docs/FAQ.md` — "What is Creature Battles?" entry (Phase 1.4 PR)
- (No `android/README.md` impact — server + client only)

---

## 18. Open Questions / Future Considerations

### Phase 2 candidates

- Move PP (canonical limited-use moves)
- Mechanical abilities (effect registry similar to held items)
- Multi-turn moves (Solar Beam, Fly, Hyper Beam recharge)
- Switch hazards (Stealth Rock, Spikes, Toxic Spikes, Sticky Web)
- IVs / Nature / EVs
- Storage box UI beyond party-of-6
- Cross-chat creature persistence ("save file" model)
- Game-mode integration (alongside Encounter system, with disambiguation)
- Move expansion beyond the starter ~80
- Held item expansion beyond ~15
- Sprite/animation polish (move animations, cry SFX)
- Tournament / gym-leader narrative templates

### Resolved during brainstorming

- **Mode binding:** Roleplay-only for Phase 1 (per user input)
- **Storage:** Hybrid — Species library + per-trainer rosters on Persona/Character (per user input, recommended)
- **MVP mechanics:** Types, STAB, damage, crits, accuracy, status, stat stages, weather, terrain, held items (per user input)
- **Cuts:** Abilities, PP, multi-turn moves, switch hazards (per user input)
- **Opponents:** Wild + trainer + agent-generated ad-hoc (per user input)
- **Progression:** Full loop — level + EXP + evolution + catching (per user input)
- **Battle start:** Both UI button and agent-suggested (per user input, recommended)
- **Combat agent interaction:** Auto-pause during Creature Battles (per user input, recommended)
- **Implementation approach:** Full parallel mirror — no code reuse with Encounter (per user input, recommended)
- **AI action selection:** Deterministic heuristic, no per-turn LLM (per user input)
- **Catching mechanics:** Canonical Gen V+ catch formula with ball-shake animation (per user input)
- **Engine tests:** Yes, add vitest + engine math tests (per user input)
- **Bag inventory:** Reuse existing `PlayerStats.inventory` (per-chat) — extend with optional `creatureBattleEffect` field rather than creating a parallel bag store on Persona. Caught during self-review when user flagged that an inventory system already exists in the Combat mechanics.
