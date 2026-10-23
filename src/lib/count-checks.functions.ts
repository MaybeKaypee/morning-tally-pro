import { createServerFn } from "@tanstack/react-start";

export const countCheckMarks = createServerFn({ method: "POST" })
  .inputValidator((input: { image: string }) => {
    if (typeof input?.image !== "string" || !input.image.startsWith("data:image/")) {
      throw new Error("Invalid image");
    }
    if (input.image.length > 8_000_000) throw new Error("Photo is too large");
    return input;
  })
  .handler(async ({ data }) => {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "This is a photo of a class attendance sheet. Count how many check marks (✓) are marked. " +
                "Reply with ONLY a single whole number, nothing else.",
            },
            { type: "image", image: data.image },
          ],
        },
      ],
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    let text: string;
    try {
      text = await result.text;
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      if (status === 429) throw new Error("Too many requests, please try again shortly.");
      if (status === 402) throw new Error("AI credits have run out.");
      throw new Error(e?.message ?? "AI request failed");
    }
    const m = text.match(/\d+/);
    if (!m) throw new Error("Could not read a count from the photo.");
    return { count: Number(m[0]) };
  });
