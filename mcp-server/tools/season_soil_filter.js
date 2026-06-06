// season_soil_filter — finder planter der passer til givne sæson- og jordbundsbetingelser.
// Delegerer til n8n Workflow E via webhook, fordi dansk→engelsk mapping og dynamisk Cypher
// er for komplekst til at ligge direkte i MCP-serveren.

import { z } from "zod";

// Alle tre parametre er optional — n8n filtrerer kun på de parametre der er angivet,
// så brugeren kan fx spørge kun på sæson uden at angive jordbund og fugtighed.
export const seasonSoilFilterSchema = {
  season: z
    .string()
    .optional()
    .describe("Sæson på dansk eller engelsk: forår/spring, sommer/summer, efterår/fall, vinter/winter"),
  soil_type: z
    .string()
    .optional()
    .describe("Jordbundstype på dansk eller engelsk: ler/clay, sand/sandy, muld/loamy, kalk/chalky, tørv/peaty, silt/silty"),
  moisture: z
    .string()
    .optional()
    .describe("Fugtighed: veldrænet/well-drained, fugtig/moist but well-drained, våd/poorly drained"),
};

export async function seasonSoilFilter({ season, soil_type, moisture }) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) throw new Error("N8N_WEBHOOK_URL er ikke sat i .env");

  // Send betingelserne til n8n — workflow E mapper dansk input til engelske Neo4j-værdier
  // og returnerer en liste af matchende planter
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, soil_type, moisture }),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook fejlede: ${response.status}`);
  }

  const data = await response.json();

  if (!data.plants || data.plants.length === 0) {
    return "Ingen planter matcher de angivne betingelser.";
  }

  // Sortér efter PRIORITY så grøntsager prioriteres over urter, frugt osv.
  // Slice til 10 totalt så LLM'en ikke drukner i data
  const PRIORITY = ["Vegetable", "Herbs", "Fruit", "Flowers", "Other"];
  const edible = data.plants
    .filter((p) => p.edible !== false)
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))
    .slice(0, 10);

  // Kun top 3 sendes videre til graph_query — en markplan med 10 planter ville blive uoverskuelig
  const top3 = edible.slice(0, 3).map((p) => p.name_en);

  // NEXT STEPS styrer agenten til at kalde graph_query for hver af de 3 planter
  // før den skriver det danske svar til brugeren
  return `${data.plants.length} plants match. Top 3 selected for markplan: ${top3.join(", ")}.

NEXT STEPS — do not respond to user yet:
1. Call graph_query(plant_name="${top3[0]}")
2. Call graph_query(plant_name="${top3[1]}")
3. Call graph_query(plant_name="${top3[2]}")
4. Write Danish response: 3 plants, one companion combo, one cultivation tip per plant.`;
}
