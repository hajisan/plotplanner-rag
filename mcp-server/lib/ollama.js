// Konverterer tekst til en embedding — et array af 768 tal der repræsenterer tekstens betydning.
// Bruges af vector_search.js til at omdanne brugerens spørgsmål til tal, så det kan sammenlignes med chunks i Neo4j.
export async function embed(text) {
  // HTTP-kald til Ollamas lokale server (localhost:11434) — fungerer som at ringe til et pizzaria:
  // ring når du har brug for det, få svar, læg på. Ingen grund til at holde linjen åben.
  const response = await fetch(`${process.env.OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });

  // Kast fejl med HTTP-statuskode så vector_search ved at noget gik galt
  if (!response.ok) {
    throw new Error(`Ollama embedding fejlede: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding; // float[] med 768 dimensioner
}
