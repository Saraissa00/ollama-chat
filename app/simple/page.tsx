"use client"; // This makes the page interactive (able to use useState, useEffect, etc.)

import { useState, useRef } from "react"; // useState lets us store and update data on the page
import Link from "next/link";

// This defines the shape of a single chat message
type Message = {
  role: "user" | "assistant"; // who sent it
  content: string;             // what they said
};

export default function SimplePage() {
  // --- STATE ---
  // These are variables that, when changed, cause the page to re-render

  const [messages, setMessages] = useState<Message[]>([]); // the chat history
  const [input, setInput] = useState("");                   // what the user is typing
  const [loading, setLoading] = useState(false);            // is the AI currently responding?

  // abortRef lets us cancel the in-flight fetch when the user clicks Clear
  const abortRef = useRef<AbortController | null>(null);

  // --- CLEAR ---
  function clearChat() {
    abortRef.current?.abort(); // cancel any ongoing stream
    abortRef.current = null;
    setMessages([]);
    setLoading(false);
  }

  // --- SEND MESSAGE ---
  // This runs when the user clicks Send
  async function sendMessage() {
    if (!input.trim() || loading) return; // do nothing if input is empty or busy

    // Add the user's message to the chat history
    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: input },
    ];
    setMessages(updatedMessages);
    setInput("");       // clear the input box
    setLoading(true);   // show loading state

    // Create an AbortController so we can cancel the request if needed
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Call our Next.js API route (app/api/chat/route.ts)
      // That route forwards the message to Ollama
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:270m",
          messages: updatedMessages,
        }),
        signal: controller.signal, // link the abort controller
      });

      // Read the streamed response text from Ollama word by word
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let aiReply = "";

      // Add an empty assistant message to fill in as we stream
      setMessages([...updatedMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // stop when stream ends

        aiReply += decoder.decode(value); // append new chunk

        // Update the last message (the assistant's) with the growing reply
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: aiReply },
        ]);
      }
    } catch (e) {
      // AbortError means the user cleared the chat — not an error worth showing
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages([...updatedMessages, { role: "assistant", content: "Error: could not reach Ollama." }]);
      }
    } finally {
      setLoading(false); // done loading
    }
  }

  // --- UI ---
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Simple Ollama Chat</h1>
        <button
          onClick={clearChat}
          style={{ padding: "6px 14px", borderRadius: 6, background: "#eee", border: "1px solid #ccc", cursor: "pointer", fontSize: 13 }}
        >
          Clear
        </button>
      </div>
      <p style={{ color: "#888" }}>Talking to: gemma3:270m running locally</p>

      {/* Chat history */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, minHeight: 300, marginBottom: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: "#aaa" }}>No messages yet. Say something!</p>
        )}

        {/* Loop through messages and display each one */}
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <strong>{msg.role === "user" ? "You" : "AI"}:</strong>
            <p style={{ margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>{msg.content}</p>
          </div>
        ))}

        {loading && <p style={{ color: "#aaa" }}>AI is typing...</p>}
      </div>

      {/* Input box and send button */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}            // update state as user types
          onKeyDown={(e) => e.key === "Enter" && sendMessage()} // send on Enter key
          placeholder="Type a message..."
          disabled={loading}
          style={{ flex: 1, padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: "8px 16px", borderRadius: 6, background: "#6d28d9", color: "white", border: "none", cursor: "pointer" }}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {/* Link back to the fancy version */}
      <p style={{ marginTop: 24, color: "#888", fontSize: 13 }}>
        <Link href="/">← Back to the full chat UI</Link>
      </p>
    </div>
  );
}
