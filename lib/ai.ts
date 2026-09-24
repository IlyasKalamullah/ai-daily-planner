/**
 * Klien AI yang kompatibel dengan format OpenAI Chat Completions.
 * Groq dan Gemini sama-sama menyediakan endpoint ini, jadi cukup ganti AI_PROVIDER.
 */
const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-120b",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
} as const;

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function chatCompletion(messages: ChatMessage[], tools: unknown[]) {
  const providerName = (process.env.AI_PROVIDER || "groq") as keyof typeof PROVIDERS;
  const provider = PROVIDERS[providerName] || PROVIDERS.groq;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY belum diisi di environment variables");

  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || provider.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
    }),
    cache: "no-store",
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMIT");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message as {
    content: string | null;
    tool_calls?: ToolCall[];
  };
}
