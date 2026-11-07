// Optional LLM layer. If no key is set (or the call fails), callers use deterministic fallbacks.

export function llmProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function complete(system: string, user: string, maxTokens = 600): Promise<string | null> {
  const provider = llmProvider();
  if (!provider) return null;
  const signal = AbortSignal.timeout(12_000);
  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      return json.content?.find((c) => c.type === "text")?.text ?? null;
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function completeJSON<T>(system: string, user: string, maxTokens = 600): Promise<T | null> {
  const text = await complete(`${system}\nRespond with JSON only, no prose, no code fences.`, user, maxTokens);
  if (!text) return null;
  const match = text.match(/[[{][\s\S]*[\]}]/);
  try {
    return match ? (JSON.parse(match[0]) as T) : null;
  } catch {
    return null;
  }
}

export async function completeText(system: string, user: string, maxTokens = 500): Promise<string | null> {
  return complete(system, user, maxTokens);
}
