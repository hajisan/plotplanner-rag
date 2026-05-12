import { z } from "zod";

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

  const lines = data.plants.map(
    (p) => `- ${p.name_en} (${p.name_da}) — ${p.type}${p.edible ? "" : " [ikke spiselig]"}`
  );

  return `**${data.count} planter matcher:**\n\n${lines.join("\n")}`;
}
