// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { GOE_SYSTEM_REFERENCE } from "./goeReference";
import { llmApiKey, sendClaude } from "./routes/shared";

export type ChatDelivery = "llm" | "openclaw";

function selectedChatDelivery(): ChatDelivery {
  const delivery = process.env.CHAT_DELIVERY;
  if (delivery !== "llm" && delivery !== "openclaw") {
    throw new Error(
      "CHAT_ENABLED=true requires CHAT_DELIVERY to be set to llm or openclaw."
    );
  }
  return delivery;
}

export function validateChatDeliveryConfig(): ChatDelivery {
  const delivery = selectedChatDelivery();
  if (delivery === "llm" && !llmApiKey()) {
    const provider = process.env.LLM_PROVIDER || "anthropic";
    throw new Error(`CHAT_DELIVERY=llm requires the configured ${provider} API key.`);
  }
  if (delivery === "openclaw" && !process.env.OPENCLAW_GATEWAY_TOKEN) {
    throw new Error("CHAT_DELIVERY=openclaw requires OPENCLAW_GATEWAY_TOKEN.");
  }
  return delivery;
}

function withGoeReference(promptConfig: any): any {
  const system = [GOE_SYSTEM_REFERENCE, promptConfig?.system]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n\n");
  return { ...promptConfig, system };
}

async function sendToLlm(promptConfig: any): Promise<string> {
  const key = llmApiKey();
  if (!key) {
    const provider = process.env.LLM_PROVIDER || "anthropic";
    throw new Error(`Chat delivery error: ${provider} API key is not configured.`);
  }
  return sendClaude(withGoeReference(promptConfig), key);
}

async function sendToOpenClaw(promptConfig: any, sessionKey: string): Promise<string> {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    throw new Error("Chat delivery error: OpenClaw gateway token is not configured.");
  }
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
  const referencedPrompt = withGoeReference(promptConfig);
  const messages: Array<{ role: string; content: string }> = [];

  if (referencedPrompt.system) {
    messages.push({ role: "system", content: referencedPrompt.system });
  }
  if (Array.isArray(referencedPrompt.messages)) {
    for (const message of referencedPrompt.messages) {
      messages.push({ role: message.role || "user", content: message.content });
    }
  } else if (typeof referencedPrompt.prompt === "string") {
    messages.push({ role: "user", content: referencedPrompt.prompt });
  }

  const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openclaw/default",
      user: sessionKey,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenClaw gateway error: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenClaw gateway error: response did not contain message content.");
  }
  return content;
}

export async function deliverChat(
  promptConfig: any,
  sessionKey: string
): Promise<string> {
  const delivery = validateChatDeliveryConfig();
  return delivery === "llm"
    ? sendToLlm(promptConfig)
    : sendToOpenClaw(promptConfig, sessionKey);
}
