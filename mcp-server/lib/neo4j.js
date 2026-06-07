// Officiel Neo4j driver — håndterer forbindelsen til databasen via Bolt-protokollen
import neo4j from "neo4j-driver";

// Opretter én vedvarende forbindelse til Neo4j ved serverstart via credentials fra .env.
// Fungerer som et abonnement — forbindelsen holdes åben og er klar hver gang et tool kalder runQuery.
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Kører en Cypher-forespørgsel med valgfrie parametre og returnerer resultatet som plain objects.
// Bruges fx i graph_query.js (tools/graph_query.js linje 34): runQuery(cypher, { name: plant_name })
export async function runQuery(cypher, params = {}) {
  const session = driver.session({ database: process.env.NEO4J_DATABASE ?? "neo4j" });
  try {
    // Kør forespørgslen og konvertér Neo4j-records til plain JavaScript objects
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  } finally {
    // Lukkes altid — også ved fejl — så sessionen ikke hænger åben (resource leak)
    await session.close();
  }
}

// Verificér forbindelsen ved serverstart — fejler højt og tidligt frem for først ved første tool-kald
try {
  await driver.getServerInfo();
  console.log("Neo4j forbindelse OK");
} catch (err) {
  console.error("Neo4j forbindelse fejlede ved serverstart:", err.message);
  process.exit(1);
}

export default driver;
