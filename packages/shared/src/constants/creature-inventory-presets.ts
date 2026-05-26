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
