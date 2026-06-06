// vector_search — semantisk søgning i tekst-chunks fra Wikipedia om planter.
// Bruges til åbne spørgsmål uden en specifik navngivet plante, fx "hvad er companion planting?".

import { z } from "zod";                        // Schema-validering af tool-parametre
import { embed } from "../lib/ollama.js";        // Konverterer søgetekst til 768-dim embedding
import { runQuery } from "../lib/neo4j.js";      // Kører Cypher-forespørgsler mod Neo4j

// Kontrakten — definerer hvilke parametre toolet accepterer.
// Bruges af index.js når toolet registreres, og af LLM'en til at vide hvad den må sende ind.
export const vectorSearchSchema = {
  query: z.string().describe("Søgetekst ALTID på engelsk"),
  limit: z.number().int().min(1).max(10).default(5).optional(),
  plant: z.string().optional().describe("Plantenavn på engelsk — bruges til graph_query-opfølgning i cultivation-flow"),
};

// Åben semantisk søgning — bruges til spørgsmål uden en specifik navngivet plante.
// Konverterer søgeteksten til 768 tal via Ollama, og finder de tekst-chunks i Neo4j der ligner mest.
export async function vectorSearch({ query, limit = 5, plant }) {
  // Konvertér søgetekst til embedding så den kan sammenlignes med chunks i Neo4j
  const embedding = await embed(query);

  // Søg i Neo4j vector index — score >= 0.7 er sweetspottet mellem præcision og bredde
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

  // Hvis plant er angivet, styrer vi LLM'en til at kalde graph_query som næste skridt.
  // NEXT STEP i tool-resultatet er mere autoritativt end AGENTS.md fordi det er direkte i LLM'ens kontekstvindue.
  if (plant) {
    return result + `\n\nNEXT STEP: Call graph_query(plant_name="${plant}") for companion context, then write Danish response.`;
  }

  return result;
}
