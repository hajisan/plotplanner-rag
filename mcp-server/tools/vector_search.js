import { z } from "zod";
import { embed } from "../lib/ollama.js";
import { runQuery } from "../lib/neo4j.js";

export const vectorSearchSchema = {
  query: z.string().describe("Søgetekst på dansk eller engelsk"),
  limit: z.number().int().min(1).max(10).default(5).optional(),
};

export async function vectorSearch({ query, limit = 5 }) {
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

  return records
    .map(
      (r) =>
        `**${r.plant_en} (${r.plant_da})** [score: ${Number(r.score).toFixed(2)}]\n${r.text}`
    )
    .join("\n\n---\n\n");
}
