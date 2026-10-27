// Minimal client for any OpenAI-compatible chat API (Gemini, Groq, OpenRouter, Ollama, LM Studio…).
// Configured in .env: LLM_PROVIDERS plus LLM_<NAME>_BASE_URL / _API_KEY / _MODELS per provider (see .env.example).

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function splitList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Every configured model, in .env order. id = "<provider>/<model>".
function listLlms() {
  return splitList(process.env.LLM_PROVIDERS).flatMap((provider) => {
    const prefix = `LLM_${provider.toUpperCase()}_`;
    const baseUrl = process.env[prefix + 'BASE_URL'];
    if (!baseUrl) return [];
    return splitList(process.env[prefix + 'MODELS']).map((model) => ({
      id: `${provider}/${model}`,
      provider,
      model,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey: process.env[prefix + 'API_KEY'],
      // Long-context models (e.g. Gemini) can take a whole transcript and find the scene themselves.
      referenceMaxChars: Number(process.env[prefix + 'REFERENCE_MAX_CHARS']) || undefined,
    }));
  });
}

// Missing llmId means the default model. Throws 503 / 400 like chat().
function findLlm(llmId) {
  const llms = listLlms();
  if (!llms.length) {
    throw httpError(503, 'No LLM configured: set LLM_PROVIDERS and its LLM_<NAME>_* values in .env, then restart the server');
  }
  const llm = llmId ? llms.find((l) => l.id === llmId) : llms[0];
  if (!llm) throw httpError(400, `Unknown LLM ${llmId}`);
  return llm;
}

// Max characters per reference page for this model; undefined falls back to REFERENCE_MAX_CHARS.
function referenceLimit(llmId) {
  return findLlm(llmId).referenceMaxChars;
}

// Safe to send to the browser: no URLs or keys.
function publicLlms() {
  return listLlms().map(({ id, provider, model }) => ({ id, provider, model }));
}

async function chat(messages, llmId) {
  const llm = findLlm(llmId);

  let res;
  try {
    res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(llm.apiKey && { Authorization: `Bearer ${llm.apiKey}` }),
      },
      body: JSON.stringify({ model: llm.model, messages, temperature: 0.8 }),
      // Local models can be slow on first load.
      signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || 120000),
    });
  } catch (err) {
    throw httpError(502, `Cannot reach ${llm.id}: ${err.message}`);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw httpError(502, `${llm.id} request failed (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

module.exports = { chat, httpError, publicLlms, referenceLimit };
