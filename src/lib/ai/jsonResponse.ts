import type { z } from "zod";

/** Existing Responses API/configuration, shared by document and workflow proposals. */
export async function requestAIJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI není dostupná. Cíl i plán můžete zadat ručně.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", input: prompt, text: { format: { type: "json_object" } } })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("AI požadavek selhal. Ruční zadání je nadále dostupné.");
  const output = data?.output_text ?? data?.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
    ?.map((content: { text?: string }) => content.text ?? "").join("") ?? "";
  return schema.parse(JSON.parse(output));
}
