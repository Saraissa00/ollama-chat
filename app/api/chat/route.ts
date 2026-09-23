import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, model } = await req.json();

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) {
    return new Response("Failed to connect to Ollama", { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n").filter(Boolean)) {
            const data = JSON.parse(line);
            if (data.message?.content) {
              controller.enqueue(new TextEncoder().encode(data.message.content));
            }
            if (data.done) controller.close();
          }
        }
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
