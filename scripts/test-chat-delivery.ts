// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
process.env.DATABASE_URL ||= "postgresql:///goe_chat_delivery_test_unused";

const { deliverChat, validateChatDeliveryConfig } = await import("../server/chatDelivery");

const prompt = {
  model: "claude-sonnet-4-6",
  max_tokens: 100,
  system: "CARD SYSTEM",
  messages: [{ role: "user", content: "TEST QUESTION" }],
};

try {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ content: [{ text: "direct answer" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  process.env.CHAT_DELIVERY = "llm";
  process.env.LLM_PROVIDER = "anthropic";
  process.env.LLM_MODEL = "claude-sonnet-4-6";
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  delete process.env.OPENCLAW_GATEWAY_TOKEN;

  assert.equal(validateChatDeliveryConfig(), "llm");
  assert.equal(await deliverChat(prompt, "goe-chat-owner-cosmic"), "direct answer");
  assert.equal(requestUrl, "https://api.anthropic.com/v1/messages");
  const directBody = JSON.parse(String(requestInit?.body));
  assert.match(directBody.system, /GOE/);
  assert.match(directBody.system, /CARD SYSTEM/);
  assert.equal(directBody.messages[0].content, "TEST QUESTION");

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      choices: [{ message: { content: "agent answer" } }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  process.env.CHAT_DELIVERY = "openclaw";
  process.env.OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789/";
  process.env.OPENCLAW_GATEWAY_TOKEN = "test-gateway-token";

  assert.equal(validateChatDeliveryConfig(), "openclaw");
  assert.equal(await deliverChat(prompt, "goe-chat-owner-rest"), "agent answer");
  assert.equal(requestUrl, "http://127.0.0.1:18789/v1/chat/completions");
  const agentBody = JSON.parse(String(requestInit?.body));
  assert.equal(agentBody.user, "goe-chat-owner-rest");
  assert.equal(agentBody.messages[0].role, "system");
  assert.match(agentBody.messages[0].content, /GOE/);
  assert.match(agentBody.messages[0].content, /CARD SYSTEM/);

  process.env.CHAT_DELIVERY = "invalid";
  assert.throws(() => validateChatDeliveryConfig(), /llm or openclaw/);

  process.env.CHAT_DELIVERY = "openclaw";
  delete process.env.OPENCLAW_GATEWAY_TOKEN;
  assert.throws(() => validateChatDeliveryConfig(), /OPENCLAW_GATEWAY_TOKEN/);

  console.log("chat delivery tests passed");
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
