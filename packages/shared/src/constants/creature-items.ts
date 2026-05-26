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
