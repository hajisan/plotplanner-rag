// graph_query — henter strukturerede relationer for én navngiven plante fra Neo4j-grafen.
// Bruges når brugeren nævner en specifik plante — companion planting eller dyrkningsvejledning.

import { z } from "zod";
import { runQuery } from "../lib/neo4j.js"; // Kører Cypher-forespørgsler mod Neo4j

// Kontrakten — definerer hvilke parametre toolet accepterer.
// context styrer hvilket NEXT STEP der returneres og dermed hvilket tool agenten kalder bagefter.
export const graphQuerySchema = {
  plant_name: z
    .string()
    .describe("Plantenavn på engelsk eller dansk, f.eks. 'Tomato' eller 'Tomat'"),
  context: z
    .enum(["companion", "cultivation"])
    .optional()
    .describe("'companion' for naboplantsøgning, 'cultivation' for dyrkningsvejledning"),
};

export async function graphQuery({ plant_name, context }) {
  // toLower() på begge sider sikrer case-insensitiv matching — databasen gemmer navne med stort
  // begyndelsesbogstav (fx "Tomato"), men brugeren kan skrive hvad som helst (fx "tomAt").
  // OPTIONAL MATCH bruges så planter uden en given relation stadig returneres — MATCH ville fejle.
  const cypher = `
    MATCH (p:Plant)
    WHERE toLower(p.name_en) = toLower($name)
       OR toLower(p.name_da) = toLower($name)
    OPTIONAL MATCH (p)-[:GROWS_WELL_WITH]->(companion:Plant)
    OPTIONAL MATCH (p)-[:ANTAGONIZES]->(antagonist:Plant)
    OPTIONAL MATCH (p)-[:FOLLOWS_WELL_AFTER]->(follows:Plant)
    OPTIONAL MATCH (p)-[:AVOID_AFTER]->(avoid:Plant)
    OPTIONAL MATCH (predecessor:Plant)-[:FOLLOWS_WELL_AFTER]->(p)
    RETURN p.name_en AS name_en,
           p.name_da AS name_da,
           p.type AS type,
           collect(DISTINCT companion.name_en) AS grows_well_with,
           collect(DISTINCT antagonist.name_en) AS antagonizes,
           collect(DISTINCT follows.name_en) AS follows_well_after,
           collect(DISTINCT avoid.name_en) AS avoid_after,
           collect(DISTINCT predecessor.name_en) AS good_predecessor_for
  `;

  const records = await runQuery(cypher, { name: plant_name });

  if (records.length === 0) {
    return `Planten "${plant_name}" blev ikke fundet i databasen. Prøv det engelske navn.`;
  }

  const r = records[0];
  // Formaterer arrays til læsbar streng — tomme arrays fra OPTIONAL MATCH vises som "ingen data"
  const fmt = (arr) => (arr.length ? arr.join(", ") : "ingen data");

  const result = [
    `**${r.name_en} (${r.name_da})** — ${r.type}`,
    "",
    `**Trives godt med:** ${fmt(r.grows_well_with)}`,
    `**Hæmmer:** ${fmt(r.antagonizes)}`,
    `**Følger godt efter:** ${fmt(r.follows_well_after)}`,
    `**Undgå efter:** ${fmt(r.avoid_after)}`,
    `**God forgænger for:** ${fmt(r.good_predecessor_for)}`,
  ].join("\n");

  // NEXT STEP styrer agentens næste tool-kald direkte fra tool-resultatet —
  // mere autoritativt end AGENTS.md fordi det er direkte i LLM'ens kontekstvindue.
  if (context === "companion") {
    return result + `\n\nNEXT STEP — do not respond to user yet: Call vector_search(query="${r.name_en} grows well with beneficial neighbor plants"). Then write a Danish response listing: (1) companions from graph data above, (2) EVERY plant name mentioned in the vector search chunks as a potential companion or beneficial neighbor, (3) antagonists from graph data if any.`;
  }
  if (context === "cultivation") {
    return result + `\n\nNEXT STEP — do not respond to user yet: Call vector_search(query="how to grow ${r.name_en} cultivation"). Then write a Danish cultivation guide combining graph data (companions, rotation) with growing tips from vector search.`;
  }

  return result;
}
