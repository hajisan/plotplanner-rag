export async function embed(text) {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding fejlede: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding; // float[] med 768 dimensioner
}
