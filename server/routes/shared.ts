// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { storage } from "../storage";
export function getStorage(_req: any) {
  return storage;
}

// Returns the API key for the ACTIVE provider (LLM_PROVIDER), so a route's
// pre-flight guard checks the key the request will actually use instead of
// always demanding ANTHROPIC_API_KEY. An OpenAI-only instance therefore stops
// failing its guard before dispatch.
export function llmApiKey(): string | undefined {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  return provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
}

// Shared helper for LLM API calls — dispatches by LLM_PROVIDER env var
// ('anthropic' | 'openai'), defaulting to 'anthropic'. Signature is kept
// stable so the 11 call sites don't need to change.
export async function sendClaude(promptConfig: any, anthropicKey: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const model = process.env.LLM_MODEL || promptConfig.model;

  if (provider === 'openai') {
    const openaiKey = process.env.OPENAI_API_KEY;
    const messages = promptConfig.system
      ? [{ role: 'system', content: promptConfig.system }, ...promptConfig.messages]
      : promptConfig.messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: promptConfig.max_tokens,
        ...(promptConfig.temperature !== undefined && { temperature: promptConfig.temperature }),
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.choices[0].message.content;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: promptConfig.max_tokens,
      ...(promptConfig.temperature !== undefined && { temperature: promptConfig.temperature }),
      ...(promptConfig.system && { system: promptConfig.system }),
      messages: promptConfig.messages
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const responseData = await response.json();
  return responseData.content[0].text;
}
