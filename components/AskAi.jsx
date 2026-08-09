"use client";

import { useState } from "react";

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

// Renders nothing unless AI is switched on, so the detail page is unaffected
// when Gemini isn't configured.
export default function AskAi({ recipe }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  if (!AI_ENABLED) return null;

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ask", recipe, question }),
      });
      const data = await res.json();
      setAnswer(res.ok ? data.answer : data.error || "Something went wrong.");
    } catch {
      setAnswer("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-assist" style={{ marginTop: 32 }}>
      <p className="eyebrow">Ask about this recipe · AI</p>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. “How do I make this vegetarian?” or “Scale it to 6 people”"
      />
      <button
        className="btn"
        style={{ marginTop: 10, padding: "10px 22px" }}
        onClick={ask}
        disabled={loading}
      >
        {loading ? "Thinking…" : "Ask"}
      </button>
      {answer && (
        <p style={{ marginTop: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {answer}
        </p>
      )}
    </div>
  );
}
