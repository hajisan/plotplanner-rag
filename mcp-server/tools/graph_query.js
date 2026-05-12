import { z } from "zod";
import { runQuery } from "../lib/neo4j.js";

export const graphQuerySchema = {
  plant_name: z
    .string()
    .describe("Plantenavn på engelsk eller dansk, f.eks. 'Tomato' eller 'Tomat'"),
};

export async function graphQuery({ plant_name }) {
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
  const fmt = (arr) => (arr.length ? arr.join(", ") : "ingen data");

  return [
    `**${r.name_en} (${r.name_da})** — ${r.type}`,
    "",
    `**Trives godt med:** ${fmt(r.grows_well_with)}`,
    `**Hæmmer:** ${fmt(r.antagonizes)}`,
    `**Følger godt efter:** ${fmt(r.follows_well_after)}`,
    `**Undgå efter:** ${fmt(r.avoid_after)}`,
    `**God forgænger for:** ${fmt(r.good_predecessor_for)}`,
  ].join("\n");
}
