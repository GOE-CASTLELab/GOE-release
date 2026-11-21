// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { getStorage } from "./shared";
import { generateMenstrualWellnessPrompt } from "../goePrompts";
import { HOMESCREEN_CHAT_PROMPT } from "../prompts/chatPrompts";
import { calculateCycleInfo, DEFAULT_CYCLE_LENGTH } from "@shared/cycleCore";
import { resolveUserDate } from "../lib/userDate";
import { addCrossCardContextToPrompt, assembleCrossCardContext, cardChatSessionKey, type SupportedChatCard } from "../cardContext";
import { getRecoveryQuality, hasRecoveryInputs } from "../lib/recovery";
import { previousDateString } from "@shared/restRisingCore";
import { deliverChat } from "../chatDelivery";

// Database storage returns chat history newest-first. Sort by timestamp ascending,
// keep the last six, so the
// model always sees the most recent turns in the order they happened.
function formatRecentHistory(messages: any[]): string {
  return [...messages]
    .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime())
    .slice(-6)
    .map(msg => `${msg.messageType === 'user' ? 'User' : 'Guide'}: ${msg.content}`)
    .join('\n');
}

export function registerChatRoutes(app: Express) {
  // Chat routes
  app.get('/api/chat/:cardType/conversations', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await getStorage(req).getChatConversations(userId, req.params.cardType);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching chat conversations:", error);
      res.status(500).json({ message: "Failed to fetch chat conversations" });
    }
  });

  app.get('/api/chat/:cardType/conversations/:conversationId', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await getStorage(req).getChatConversationMessages(
        userId,
        req.params.cardType,
        req.params.conversationId,
        limit,
      );
      res.json(messages.reverse());
    } catch (error) {
      console.error("Error fetching archived chat messages:", error);
      res.status(500).json({ message: "Failed to fetch archived chat messages" });
    }
  });

  app.post('/api/chat/:cardType/reset', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await getStorage(req).resetChatConversation(userId, req.params.cardType);
      res.json({ reset: true, conversationId: conversation.id });
    } catch (error) {
      console.error("Error resetting chat conversation:", error);
      res.status(500).json({ message: "Failed to reset chat conversation" });
    }
  });

  app.get('/api/chat/:cardType', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cardType } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await getStorage(req).getChatMessages(userId, cardType, limit);
      res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/chat/:cardType', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cardType } = req.params;
      const { content, messageType = 'user', metadata } = req.body;
      const conversation = await getStorage(req).getActiveChatConversation(userId, cardType);

      const aiResponse = await generateAIResponse(req, cardType, content, userId, conversation.id, req.body.context);

      const userMessage = await getStorage(req).createChatMessage({
        userId,
        cardType,
        conversationId: conversation.id,
        messageType: 'user',
        content,
        metadata
      });

      const agentMessage = await getStorage(req).createChatMessage({
        userId,
        cardType,
        conversationId: conversation.id,
        messageType: 'agent',
        content: aiResponse,
        metadata: { generated: true }
      });

      res.json({ userMessage, agentMessage });
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });
}

// AI and API integration functions with Human-Centered Impact Intelligence
async function generateAIResponse(req: any, cardType: string, message: string, userId: string, conversationId: string, contextData?: any): Promise<string> {
  try {
    const storageInstance = getStorage(req);
    const sessionKey = cardChatSessionKey(userId, cardType, conversationId);
    const crossCardContext = (recentHistory = '') => assembleCrossCardContext({
      storage: storageInstance,
      userId,
      cardType: cardType as SupportedChatCard,
      message,
      recentHistory,
    });

    // For restUnified (unified sacred rest across all tabs), use context-aware chat
    // For cosmic (unified astrology/gene keys/human design), use comprehensive integration
    if (cardType === 'cosmic') {
      const birthChartRecord = await storageInstance.getBirthChart(userId);
      const currentSkyRecord = await storageInstance.getCurrentSky(userId);
      const currentTransitsRecord = await storageInstance.getCurrentTransits(userId);
      const geneKeysData = await storageInstance.getGeneKeys(userId);
      const humanDesignData = await storageInstance.getHumanDesign(userId);

      if (!birthChartRecord || !currentSkyRecord || !currentTransitsRecord) {
        return "I'd love to provide personalized cosmic guidance! Please make sure your astrology data is loaded first.";
      }

      const birthChartData = birthChartRecord.transformedData;
      const currentSkyData = currentSkyRecord.transformedData;
      const currentTransitsData = currentTransitsRecord.transformedData;

      if (!birthChartData || !Array.isArray(currentSkyData) || !Array.isArray(currentTransitsData)) {
        return "I'm having trouble accessing your current astrological data. Please refresh your cosmic data and try again.";
      }

      const currentSkyTransformed = currentSkyData.map((planet: any) => ({
        planet: planet.planet,
        sign: planet.sign,
        degree: planet.degree
      }));

      const currentTransitsTransformed = currentTransitsData.map((transit: any) => ({
        transit: transit.transit,
        transitingPlanet: transit.transitingPlanet || transit.planet,
        natalPlanet: transit.natalPlanet || transit.planet,
        aspect: transit.aspect,
        exactDate: transit.exactDate
      }));

      const recentMessages = await storageInstance.getChatMessages(userId, 'cosmic');
      const conversationHistory = formatRecentHistory(recentMessages);

      const { generateOraclePrompt } = await import('../goePrompts');

      if (!birthChartData || typeof birthChartData !== 'object') {
        return "I don't have your birth chart yet — no chart data is set up. Add it in the Astrology card's setup step and I can read from your actual placements.";
      }

      const promptConfig = generateOraclePrompt(
        birthChartData as any,
        currentSkyTransformed,
        currentTransitsTransformed,
        geneKeysData,
        humanDesignData,
        message,
        conversationHistory
      );

      const promptWithContext = addCrossCardContextToPrompt(promptConfig, await crossCardContext(conversationHistory));
      return await deliverChat(promptWithContext, sessionKey);
    }

    // Handle menstrual card with cycle intelligence
    if (cardType === 'menstrual') {
      const rawCycleData = await storageInstance.getCycleData(userId);
      // SWITCHBOARD READ (Option B): this chat is a CONSUMER of the cycle card's
      // published phase. It does NOT recompute phase itself — it reads the value
      // the cycle card publishes through getCycleContext (the server publish point,
      // which computes via @shared/cycleCore + applies wrap/blend). Absent cycle
      // data -> published fields are null and we fall back cleanly.
      // Audit A (S5): absent published fields must stay null/absent — never faked as a
      // real day/phase/centre ("Unknown"/"Hairline" previously masqueraded as real data).
      // Null here lets the assembled prompt name the gap instead of the model asserting a
      // phase that was never actually read.
      const published = await storageInstance.getCycleContext(userId).catch(() => null);
      const cycleDay = published?.cycleDay ?? null;
      const cyclePhase = published?.cyclePhase ?? null;
      const moonCenter = published?.moonCenter ?? null;
      const hasCycleData = cycleDay !== null && cyclePhase !== null;

      // The prompt template always interpolates cycleDay/cyclePhase directly with no
      // null-guard, so a null read here cannot silently pass through as text — name the
      // gap and return instead of letting the template assert a phase that was never read.
      if (!hasCycleData && !moonCenter) {
        return "I don't have your cycle phase read yet — no cycle data is set up. Set it up in the deployment/setup step and I can speak to where you actually are.";
      }

      const enhancedCycleData = {
        ...rawCycleData,
        cycleDay,
        cyclePhase,
        moonCenter,
        lifeStage: 'Menstruating Years'
      };

      const recentMessages = await storageInstance.getChatMessages(userId, 'menstrual');
      const conversationHistory = formatRecentHistory(recentMessages);

      const promptConfig = generateMenstrualWellnessPrompt(
        enhancedCycleData,
        message,
        conversationHistory
      );

      const promptWithContext = addCrossCardContextToPrompt(promptConfig, await crossCardContext(conversationHistory));
      return await deliverChat(promptWithContext, sessionKey);
    }

    // MOVEMENT card chat — reads the day's colour signal / readiness (never overrides it),
    // with cycle phase as interpretive context only. Uses generateMovementChatPrompt.
    if (cardType === 'movement') {
      const { refreshTodayMovementSignal } = await import('../lib/movementRead');
      const today = await resolveUserDate(userId, storageInstance);
      const todayLog = await refreshTodayMovementSignal(storageInstance, userId, today);
      const latestWorkout = await storageInstance.getLatestMovementWorkout(userId).catch(() => null);
      const cycleData = await storageInstance.getCycleContext(userId).catch(() => null);

      const movementData = {
        rhythmColour: todayLog?.rhythmColour ?? null,
        movementColour: todayLog?.movementColour ?? null,
        signalContext: todayLog?.signalContext ?? null,
        rmssd: todayLog?.rmssd ?? null,
        sdnn: todayLog?.sdnn ?? null,
        readinessScore: todayLog?.readinessScore ?? null,
        latestWorkout: latestWorkout?.practiceName ?? null,
      };

      const recentMessages = await storageInstance.getChatMessages(userId, 'movement');
      const conversationHistory = formatRecentHistory(recentMessages);

      const { generateMovementChatPrompt } = await import('../goePrompts');
      const promptConfig = generateMovementChatPrompt(movementData, cycleData, message, conversationHistory);
      const promptWithContext = addCrossCardContextToPrompt(promptConfig, await crossCardContext(conversationHistory));
      return await deliverChat(promptWithContext, sessionKey);
    }

    // REST chat — runs generateRestChatPrompt (to-standard, banned-word list), the twin
    // of the movement branch. Reads nervous-system state, recovery quality, sleep, and
    // cycle phase (interpretive only).
    if (cardType === 'rest') {
      const latestRest = await storageInstance.getLatestRestRisingSubmission(userId).catch(() => null);
      const cycleData = await storageInstance.getCycleContext(userId).catch(() => null);

      // No logged inputs means no observation — leave recovery and the flags unknown
      // rather than letting getRecoveryQuality's graceful 'high' default and the
      // boolean falses read as a logged, favourable night. A blank row counts as
      // unlogged, not a clear night.
      const recoveryQuality = hasRecoveryInputs(latestRest) ? getRecoveryQuality(latestRest) : null;
      const sleepSummary = latestRest?.wakingState
        ? `Waking state: ${latestRest.wakingState}${latestRest.sleepProcess ? `; falling asleep: ${latestRest.sleepProcess}` : ''}`
        : (latestRest?.energyAssessment ? `Evening energy: ${latestRest.energyAssessment}` : null);

      const restData = {
        nervousSystemState: latestRest?.nervousSystemState ?? null,
        recoveryQuality,
        nightWakings: latestRest?.nightWakings ?? null,
        nightSweats: latestRest?.nightSweats == null ? null : !!latestRest.nightSweats,
        alcoholConsumed: latestRest?.alcoholConsumed == null ? null : !!latestRest.alcoholConsumed,
        sleepSummary,
      };

      const recentMessages = await storageInstance.getChatMessages(userId, 'rest');
      const conversationHistory = formatRecentHistory(recentMessages);

      const { generateRestChatPrompt } = await import('../goePrompts');
      const promptConfig = generateRestChatPrompt(restData, cycleData, message, conversationHistory);
      const promptWithContext = addCrossCardContextToPrompt(promptConfig, await crossCardContext(conversationHistory));
      return await deliverChat(promptWithContext, sessionKey);
    }

    // GENERAL cross-card chat (homescreen GOE88) — pulls context from across the cards
    // (cycle, chart, transits) rather than a single card, routed as goe-chat-general.
    if (cardType === 'general') {
      const recentMessages = await storageInstance.getChatMessages(userId, 'general');
      const conversationHistory = formatRecentHistory(recentMessages);

      const promptConfig = {
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        temperature: 0.2,
        system: HOMESCREEN_CHAT_PROMPT,
        messages: [
          {
            role: "user",
            content: `CONVERSATION HISTORY:\n${conversationHistory}\n\nUSER'S QUESTION: "${message}"`
          }
        ]
      };
      const promptWithContext = addCrossCardContextToPrompt(promptConfig, await crossCardContext(conversationHistory));
      return await deliverChat(promptWithContext, sessionKey);
    }

    // For other card types, use fallback responses
    const responses = {
      sleep: "Your sleep patterns show important connections to your natural rhythms. Let me help you optimize your rest and dream work."
    };

    return responses[cardType as keyof typeof responses] || "I'm here to provide personalized insights. How can I help you today?";

  } catch (error) {
    console.error(`Error generating AI response for ${cardType}:`, error);
    throw error;
  }
}
