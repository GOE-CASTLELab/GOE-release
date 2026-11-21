import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { chatConversations, chatMessages, users } from "../shared/schema";
import { closeDatabaseConnection, db } from "../server/db";
import { storage } from "../server/storage";
import { cardChatSessionKey } from "../server/cardContext";

const ownerId = "chat-conversation-db-test-owner";
const cardType = "cosmic";

try {
  await db.insert(users).values({ id: ownerId });
  await db.insert(chatMessages).values({
    userId: ownerId,
    cardType,
    messageType: "user",
    content: "legacy question",
  });

  const adopted = await storage.getChatMessages(ownerId, cardType);
  assert.equal(adopted.length, 1);
  assert.ok(adopted[0].conversationId, "legacy messages must join the active conversation");

  const first = await storage.getActiveChatConversation(ownerId, cardType);
  assert.equal(adopted[0].conversationId, first.id);

  const second = await storage.resetChatConversation(ownerId, cardType);
  assert.notEqual(second.id, first.id);
  assert.equal((await storage.getChatMessages(ownerId, cardType)).length, 0);
  assert.equal((await storage.getChatConversationMessages(ownerId, cardType, first.id)).length, 1);

  await storage.createChatMessage({
    userId: ownerId,
    cardType,
    conversationId: second.id,
    messageType: "user",
    content: "new question",
  });
  assert.equal((await storage.getChatMessages(ownerId, cardType)).length, 1);
  assert.notEqual(
    cardChatSessionKey(ownerId, cardType, first.id),
    cardChatSessionKey(ownerId, cardType, second.id),
  );

  const conversations = await storage.getChatConversations(ownerId, cardType);
  assert.equal(conversations.length, 2);
  assert.equal(conversations.filter((conversation) => conversation.archivedAt === null).length, 1);
  const archived = conversations.find((conversation) => conversation.id === first.id);
  assert.equal(archived?.messageCount, 1);
  assert.equal(archived?.preview, "legacy question");

  console.log("database chat conversations adopt, persist, archive, reset, and rotate cleanly");
} finally {
  await db.delete(chatMessages).where(eq(chatMessages.userId, ownerId));
  await db.delete(chatConversations).where(eq(chatConversations.userId, ownerId));
  await db.delete(users).where(eq(users.id, ownerId));
  await closeDatabaseConnection();
}
