"use strict";

const fetch = require("node-fetch");

function verbosityInstructions(verbosity) {
  switch (verbosity) {
    case "minimal":
      return [
        "- Add a brief file/header comment (if language supports it).",
        "- Add only the most essential comments for non-obvious logic.",
        "- Prefer high-signal comments; do NOT comment every line."
      ].join("\n");
    case "medium":
      return [
        "- Add a short header comment (if language supports it).",
        "- Add comments for major blocks, tricky logic, edge cases, and invariants.",
        "- Do not comment obvious syntax; focus on intent and reasoning."
      ].join("\n");
    case "verbose":
      return [
        "- Add a header comment (if language supports it).",
        "- Add thorough comments explaining intent, assumptions, edge cases, invariants, and pitfalls.",
        "- It is OK to add more comments than typical, but do NOT narrate obvious syntax.",
        "- When uncertain about intent, add a short comment stating the assumption."
      ].join("\n");
    default:
      return verbosityInstructions("medium");
  }
}

function buildPrompt({ code, grammarName, verbosity }) {
  return `
You are an expert software engineer.

Task:
Add helpful comments to the user's code.

Absolute rules (must follow):
- Output MUST be ONLY the commented code. No markdown. No backticks. No extra explanation.
- Preserve behavior and structure. Do NOT refactor or rewrite code.
- Do NOT rename variables, change formatting, re-indent, or reorder logic.
- Do NOT wrap lines or reflow long lines.
- Add comments in the style idiomatic to the language.
- If the language uses multiple comment styles, prefer the most common in real projects.
- If you need to add a header comment, do so without changing code indentation below it.

Verbosity instructions:
${verbosityInstructions(verbosity)}

Context:
- Language/grammar: ${grammarName || "unknown"}

CODE (verbatim, do not alter except for adding comments):
${code}
`.trim();
}

function extractOutputText(json) {
  let out = "";
  for (const item of (json.output || [])) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c && c.type === "output_text" && typeof c.text === "string") out += c.text;
    }
  }
  return out.trim();
}

async function generateCommentedCode({ apiKey, apiBaseUrl, model, prompt, timeoutMs }) {
  const base = String(apiBaseUrl || "https://api.openai.com").replace(/\/+$/, "");
  const url = `${base}/v1/responses`;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutHandle = null;
  if (controller) timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, input: prompt }),
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI API ${res.status}: ${text || res.statusText}`);
    }

    const json = await res.json();
    const out = extractOutputText(json);
    if (!out) throw new Error("OpenAI returned an empty response.");
    return out;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

module.exports = { buildPrompt, generateCommentedCode };
