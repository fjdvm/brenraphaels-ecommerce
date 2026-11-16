export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

/** Writes the conversation around the facts. Throws when no model can answer; the caller then falls back to the Order card. */
export type Completer = (messages: ModelMessage[]) => Promise<string>;

export class ModelUnavailableError extends Error {}

const timeoutMs = 8_000;

type Env = Record<string, string | undefined>;

async function groq(key: string, messages: ModelMessage[], fetcher: typeof fetch): Promise<string> {
  const response = await fetcher("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama-3.1-8b-instant", messages, temperature: 0.2, max_tokens: 300 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Groq ${response.status}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned nothing");
  return text;
}

async function gemini(key: string, messages: ModelMessage[], fetcher: typeof fetch): Promise<string> {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
  const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.filter((message) => message.role !== "system").map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned nothing");
  return text;
}

/**
 * Groq first, then Gemini. The assistant has its own keys (`ASSISTANT_GROQ_API_KEY`, `ASSISTANT_GEMINI_API_KEY`),
 * never the ones the Staff features in CREOMS use, so it cannot spend their quota. With no key it is unavailable.
 */
export function createCompleter(env: Env = process.env, fetcher: typeof fetch = fetch): Completer {
  return async (messages) => {
    const attempts: (() => Promise<string>)[] = [];
    if (env.ASSISTANT_GROQ_API_KEY) attempts.push(() => groq(env.ASSISTANT_GROQ_API_KEY!, messages, fetcher));
    if (env.ASSISTANT_GEMINI_API_KEY) attempts.push(() => gemini(env.ASSISTANT_GEMINI_API_KEY!, messages, fetcher));
    if (attempts.length === 0) throw new ModelUnavailableError("No assistant model key is set.");
    let last: unknown;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        last = error;
      }
    }
    throw new ModelUnavailableError(last instanceof Error ? last.message : "The model failed.");
  };
}

export const assistantSystemPrompt = [
  "You are the AI order assistant of Bren Raphael's, a Filipino ube jam and halaya shop. Say you are an AI assistant if asked.",
  "Answer the customer's last question in one to three short sentences, in the same language they use (English or Taglish).",
  "Use ONLY the facts given in the FACTS block. Copy dates, times and links exactly as written there.",
  "Never mention amounts of money, never promise refunds, discounts, replacements or delivery times, never guess.",
  "If the facts do not answer the question, say you don't know and that a teammate can help.",
].join(" ");
