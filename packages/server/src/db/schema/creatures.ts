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
