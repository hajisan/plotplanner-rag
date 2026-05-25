import { z } from "zod";
import { embed } from "../lib/ollama.js";
import { runQuery } from "../lib/neo4j.js";

export const vectorSearchSchema = {
  query: z.string().describe("Søgetekst ALTID på engelsk"),
  limit: z.number().int().min(1).max(10).default(5).optional(),
  plant: z.string().optional().describe("Plantenavn på engelsk — bruges til graph_query-opfølgning i cultivation-flow"),
};

export async function vectorSearch({ query, limit = 5, plant }) {
  const embedding = await embed(query);

  const cypher = `
    CALL db.index.vector.queryNodes('plant_chunks', $limit, $embedding)
    YIELD node AS chunk, score
    WHERE score >= 0.7
    MATCH (p:Plant)-[:HAS_CHUNK]->(chunk)
    RETURN chunk.text AS text,
           p.name_en AS plant_en,
           p.name_da AS plant_da,
           score
    ORDER BY score DESC
  `;

  const records = await runQuery(cypher, { embedding, limit });

  if (records.length === 0) {
    return "Ingen resultater fundet over tærskel 0.7. Prøv en anden søgetekst.";
  }

  const result = records
    .map(
      (r) =>
        `**${r.plant_en} (${r.plant_da})** [score: ${Number(r.score).toFixed(2)}]\n${r.text}`
    )
    .join("\n\n---\n\n");

  if (plant) {
    return result + `\n\nNEXT STEP: Call graph_query(plant_name="${plant}") for companion context, then write Danish response.`;
  }

  return result;
}
