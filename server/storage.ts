import { connectMoonPatternSchema, MoonPatternConflict, type ConnectMoonPattern, type MoonPatternRecord, type MoonPatternRevisionRecord } from '@shared/moonPattern';
import { moonPatterns, moonPatternRevisions } from '@shared/schema';
import { buildCycleContext } from './lib/cycleContext';
import { resolveUserDate } from './lib/userDate';
import { moonCentresEnabled } from './moonCentres';
import {
  calculateCycleInfo,
  calculateMoonCenterBlend,
  cyclePhaseForDay,
  wrappedCycleDay,
  DEFAULT_CYCLE_LENGTH,
} from "@shared/cycleCore";
import { getMoonPhase } from "@shared/moonPhase";
import {
  users,
  userProfiles,
  returnPatternSessions,
  globalState,
  chatConversations,
  chatMessages,
  cycleData,
  birthChart,
  currentSky,
  currentTransits,
  geneKeys,
  humanDesign,
  sleepData,
  fileUploads,
  restRisingSubmissions,
  practices,
  userPracticePreferences,
  type User,
  type UpsertUser,
  type UserProfile,
  type InsertUserProfile,
  type ReturnPatternSession,
  type GlobalState,
  type InsertGlobalState,
  type ChatMessage,
  type InsertChatMessage,
  type ChatConversation,
  type CycleData,
  type InsertCycleData,
  type BirthChart,
  type InsertBirthChart,
  type CurrentSky,
  type InsertCurrentSky,
  type CurrentTransits,
  type InsertCurrentTransits,
  type GeneKeys,
  type InsertGeneKeys,
  type HumanDesign,
  type InsertHumanDesign,
  type SleepData,
  type InsertSleepData,
  type FileUpload,
  type InsertFileUpload,
  type RestRisingSubmission,
  type InsertRestRisingSubmission,
  type Practice,
  type InsertPractice,
  type UserPracticePreference,
  type InsertUserPracticePreference,
  movementLogs,
  type InsertMovementLog,
  type MovementLog,
  type MovementMorningInput,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, gte, isNull, lt, lte, isNotNull, or } from "drizzle-orm";
import { mergeRestRisingRows } from "@shared/restRisingCore";
import { getObjectStore } from './storage/index';

export type ChatConversationSummary = ChatConversation & {
  messageCount: number;
  preview: string | null;
};

// Helper functions for object storage backup
const saveToObjectStorage = async (userId: string, dataType: string, data: any): Promise<void> => {
  try {
    const fileName = `.private/backup_${dataType}_${userId}.json`;

    const backupData = {
      ...data,
      backupTimestamp: new Date().toISOString(),
      dataType
    };

    const objectStore = await getObjectStore();
    await objectStore.save(fileName, Buffer.from(JSON.stringify(backupData, null, 2)), 'application/json');
    console.log(`✅ Private backup saved`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Object storage backup failed (non-critical):`, errorMessage);
    // Don't throw - backup failure shouldn't break main functionality
  }
};

const readFromObjectStorage = async (userId: string, dataType: string): Promise<any> => {
  try {
    const fileName = `.private/backup_${dataType}_${userId}.json`;

    const objectStore = await getObjectStore();
    const contents = await objectStore.read(fileName);
    if (!contents) return null;

    const backupData = JSON.parse(contents.toString());
    console.log(`✅ Private backup recovered`);
    return backupData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Object storage recovery failed:`, errorMessage);
    return null;
  }
};

// S4: cycle length is a rolling average of the last 3–4 real logged gaps, not a
// stored constant. `cycleData.periodData` is the schema's period-history field
// (Array<{ startDate; endDate }>), but no write path in the app populates real
// entries into it yet — it is only ever preserved/echoed through upsertCycleData.
// S4: rolling average active once >=3 logged gaps exist. Until real period-log
// history is queryable, this falls back to the stored cycleLength, then DEFAULT.
function rollingAverageCycleLength(periodData: unknown, storedCycleLength?: number | null): number {
  const entries = Array.isArray(periodData) ? periodData : [];
  const starts = entries
    .map((p: any) => (p && typeof p.startDate === 'string' ? p.startDate : null))
    .filter((d: string | null): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (starts.length >= 4) {
    // Gaps between consecutive logged period starts, most recent 3–4 gaps.
    const gaps: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      gaps.push(Math.round((starts[i] - starts[i - 1]) / (1000 * 60 * 60 * 24)));
    }
    const lastGaps = gaps.slice(-4);
    const avg = lastGaps.reduce((sum, g) => sum + g, 0) / lastGaps.length;
    return Math.round(avg);
  }

  // Cold-start: fewer than 3 logged gaps (4 starts) available.
  return storedCycleLength || DEFAULT_CYCLE_LENGTH;
}

function resolveCycleLength(rawData: { cycleLength?: number | null; periodData?: unknown }): number {
  return rollingAverageCycleLength(rawData.periodData, rawData.cycleLength);
}

export interface IStorage {
  // User operations for the instance owner
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile>;

  // Return Pattern operations
  createReturnPatternSession(userId: string, localDate: string, localTimeBand: string): Promise<ReturnPatternSession>;
  updateReturnPatternSession(userId: string, id: string, activeSecondsDelta: number, close: boolean): Promise<ReturnPatternSession | undefined>;
  getReturnPatternSessionsByDateRange(userId: string, startDate: string, endDate: string): Promise<ReturnPatternSession[]>;
  getReturnPatternSessionBefore(userId: string, before: Date): Promise<ReturnPatternSession | undefined>;
  deleteReturnPatternSessions(userId: string): Promise<number>;
  
  // Global state operations
  getGlobalState(userId: string, cardType: string): Promise<GlobalState | undefined>;
  upsertGlobalState(state: InsertGlobalState): Promise<GlobalState>;
  
  // Chat operations
  getChatMessages(userId: string, cardType: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getActiveChatConversation(userId: string, cardType: string): Promise<ChatConversation>;
  getChatConversations(userId: string, cardType: string): Promise<ChatConversation[]>;
  getChatConversationMessages(userId: string, cardType: string, conversationId: string, limit?: number): Promise<ChatMessage[]>;
  resetChatConversation(userId: string, cardType: string): Promise<ChatConversation>;
  
  getMoonPattern(userId: string): Promise<MoonPatternRecord | undefined>;
  getMoonPatternHistory(userId: string): Promise<MoonPatternRevisionRecord[]>;
  connectMoonPattern(userId: string, input: ConnectMoonPattern): Promise<MoonPatternRecord>;

  // Cycle data operations
  getCycleData(userId: string): Promise<CycleData | undefined>;
  getCycleContext(userId: string): Promise<any | undefined>;
  upsertCycleData(data: InsertCycleData): Promise<CycleData>;
  
  // New astrology operations
  getBirthChart(userId: string): Promise<BirthChart | undefined>;
  createBirthChart(data: InsertBirthChart): Promise<BirthChart>;
  updateBirthChart(userId: string, data: Partial<InsertBirthChart>): Promise<BirthChart>;
  
  getCurrentSky(userId: string, date?: string): Promise<CurrentSky | undefined>;
  upsertCurrentSky(data: InsertCurrentSky): Promise<CurrentSky>;
  
  getCurrentTransits(userId: string, date?: string): Promise<CurrentTransits | undefined>;
  upsertCurrentTransits(data: InsertCurrentTransits): Promise<CurrentTransits>;
  
  // Sleep data operations
  getSleepData(userId: string, date?: string): Promise<SleepData[]>;
  createSleepData(data: InsertSleepData): Promise<SleepData>;
  
  // Rest & Rising submission operations
  getRestRisingSubmissions(userId: string, cyclePhase?: string): Promise<RestRisingSubmission[]>;
  createRestRisingSubmission(data: InsertRestRisingSubmission): Promise<RestRisingSubmission>;
  getRestRisingSubmissionsByDateRange(userId: string, startDate: string, endDate: string): Promise<RestRisingSubmission[]>;
  getRestRisingSubmissionForSleepDate(userId: string, sleepDate: string): Promise<RestRisingSubmission | undefined>;
  
  // Daily AI insight caching operations
  getDailyInsight(userId: string, type: 'rest' | 'rise', localDate: string): Promise<RestRisingSubmission | undefined>;
  upsertDailyInsight(data: InsertRestRisingSubmission): Promise<RestRisingSubmission>;
  
  // File upload operations
  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  getFileUpload(id: string): Promise<FileUpload | undefined>;
  
  // Gene Keys operations
  getGeneKeys(userId: string): Promise<GeneKeys | undefined>;
  createGeneKeys(data: InsertGeneKeys): Promise<GeneKeys>;
  updateGeneKeys(userId: string, data: Partial<InsertGeneKeys>): Promise<GeneKeys>;
  
  // Human Design operations
  getHumanDesign(userId: string): Promise<HumanDesign | undefined>;
  createHumanDesign(data: InsertHumanDesign): Promise<HumanDesign>;
  updateHumanDesign(userId: string, data: Partial<InsertHumanDesign>): Promise<HumanDesign>;
  
  // Practice operations for CL/CE system
  getPracticesByCreativeState(creativeState: 'CL' | 'CE', practiceType: 'meditation' | 'movement', cyclePhase?: string): Promise<Practice[]>;
  createPractice(data: InsertPractice): Promise<Practice>;
  getUserPracticePreference(userId: string, practiceId: string): Promise<UserPracticePreference | undefined>;
  upsertUserPracticePreference(data: InsertUserPracticePreference): Promise<UserPracticePreference>;

  // Movement Intelligence operations
  getMovementLog(userId: string, date: string): Promise<MovementLog | undefined>;
  getMovementLogs(userId: string, daysBack?: number): Promise<MovementLog[]>;
  getMovementCalendar(userId: string, year: number, month: number): Promise<MovementLog[]>;
  upsertMovementHrv(data: { userId: string; date: string; rmssd: number; sdnn?: number; hrvSource: string; hrvQuality?: number; hrvIntervals?: number[]; hrvCapturedAt?: Date }): Promise<MovementLog>;
  upsertMovementMorning(data: MovementMorningInput): Promise<MovementLog>;
  upsertMovementWorkout(userId: string, date: string, workout: { practiceName: string; durationMinutes: number; notes?: string; practiceSignal?: string | null }): Promise<MovementLog>;
  getMovementWorkoutsForDate(userId: string, date: string): Promise<MovementLog[]>;
  getLatestMovementWorkout(userId: string): Promise<MovementLog | null>;
  updateMovementNotes(userId: string, date: string, notes: string): Promise<MovementLog | null>;
  updateMovementSessionNotes(userId: string, id: string, notes: string): Promise<MovementLog | null>;
  getLatestRestRisingSubmission(userId: string): Promise<RestRisingSubmission | undefined>;

}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [newProfile] = await db
      .insert(userProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile> {
    const [updatedProfile] = await db
      .update(userProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updatedProfile;
  }

  async createReturnPatternSession(userId: string, localDate: string, localTimeBand: string): Promise<ReturnPatternSession> {
    const [session] = await db
      .insert(returnPatternSessions)
      .values({ userId, localDate, localTimeBand })
      .returning();
    return session;
  }

  async updateReturnPatternSession(userId: string, id: string, activeSecondsDelta: number, close: boolean): Promise<ReturnPatternSession | undefined> {
    const now = new Date();
    const [session] = await db
      .update(returnPatternSessions)
      .set({
        activeSeconds: sql`${returnPatternSessions.activeSeconds} + ${activeSecondsDelta}`,
        lastActiveAt: now,
        ...(close ? { closedAt: now } : {}),
      })
      .where(and(eq(returnPatternSessions.userId, userId), eq(returnPatternSessions.id, id)))
      .returning();
    return session;
  }

  async getReturnPatternSessionsByDateRange(userId: string, startDate: string, endDate: string): Promise<ReturnPatternSession[]> {
    return db
      .select()
      .from(returnPatternSessions)
      .where(and(eq(returnPatternSessions.userId, userId), gte(returnPatternSessions.localDate, startDate), lte(returnPatternSessions.localDate, endDate)))
      .orderBy(asc(returnPatternSessions.openedAt));
  }

  async getReturnPatternSessionBefore(userId: string, before: Date): Promise<ReturnPatternSession | undefined> {
    const [session] = await db
      .select()
      .from(returnPatternSessions)
      .where(and(eq(returnPatternSessions.userId, userId), lt(returnPatternSessions.openedAt, before)))
      .orderBy(desc(returnPatternSessions.openedAt))
      .limit(1);
    return session;
  }

  async deleteReturnPatternSessions(userId: string): Promise<number> {
    const removed = await db
      .delete(returnPatternSessions)
      .where(eq(returnPatternSessions.userId, userId))
      .returning({ id: returnPatternSessions.id });
    return removed.length;
  }

  // Global state operations
  async getGlobalState(userId: string, cardType: string): Promise<GlobalState | undefined> {
    const [state] = await db
      .select()
      .from(globalState)
      .where(and(eq(globalState.userId, userId), eq(globalState.cardType, cardType)));
    return state;
  }

  async upsertGlobalState(state: InsertGlobalState): Promise<GlobalState> {
    const [newState] = await db
      .insert(globalState)
      .values(state)
      .onConflictDoUpdate({
        target: [globalState.userId, globalState.cardType],
        set: {
          stateData: state.stateData,
          lastUpdated: new Date(),
        },
      })
      .returning();
    return newState;
  }

  // Chat operations
  async getActiveChatConversation(userId: string, cardType: string): Promise<ChatConversation> {
    return db.transaction(async (tx: any) => {
      const [active] = await tx
        .select()
        .from(chatConversations)
        .where(and(
          eq(chatConversations.userId, userId),
          eq(chatConversations.cardType, cardType),
          isNull(chatConversations.archivedAt),
        ))
        .limit(1);

      if (active) return active;

      const [created] = await tx
        .insert(chatConversations)
        .values({ userId, cardType })
        .returning();

      // Adopt messages created before conversation threads existed so the
      // current chat survives the migration unchanged.
      await tx
        .update(chatMessages)
        .set({ conversationId: created.id })
        .where(and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.cardType, cardType),
          isNull(chatMessages.conversationId),
        ));

      return created;
    });
  }

  async getChatMessages(userId: string, cardType: string, limit = 50): Promise<ChatMessage[]> {
    const conversation = await this.getActiveChatConversation(userId, cardType);
    return await db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.cardType, cardType),
        eq(chatMessages.conversationId, conversation.id),
      ))
      .orderBy(desc(chatMessages.timestamp))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const conversation = message.conversationId
      ? null
      : await this.getActiveChatConversation(message.userId, message.cardType);
    const [newMessage] = await db
      .insert(chatMessages)
      .values({ ...message, conversationId: message.conversationId ?? conversation!.id })
      .returning();
    return newMessage;
  }

  async getChatConversations(userId: string, cardType: string): Promise<ChatConversationSummary[]> {
    await this.getActiveChatConversation(userId, cardType);
    return db
      .select({
        id: chatConversations.id,
        userId: chatConversations.userId,
        cardType: chatConversations.cardType,
        startedAt: chatConversations.startedAt,
        archivedAt: chatConversations.archivedAt,
        messageCount: sql<number>`count(${chatMessages.id})`.mapWith(Number),
        preview: sql<string | null>`(
          select ${chatMessages.content}
          from ${chatMessages}
          where ${chatMessages.conversationId} = ${chatConversations.id}
          order by ${chatMessages.timestamp} asc
          limit 1
        )`,
      })
      .from(chatConversations)
      .leftJoin(chatMessages, eq(chatMessages.conversationId, chatConversations.id))
      .where(and(
        eq(chatConversations.userId, userId),
        eq(chatConversations.cardType, cardType),
      ))
      .groupBy(
        chatConversations.id,
        chatConversations.userId,
        chatConversations.cardType,
        chatConversations.startedAt,
        chatConversations.archivedAt,
      )
      .orderBy(desc(chatConversations.startedAt));
  }

  async getChatConversationMessages(userId: string, cardType: string, conversationId: string, limit = 50): Promise<ChatMessage[]> {
    const [conversation] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, userId),
        eq(chatConversations.cardType, cardType),
      ))
      .limit(1);
    if (!conversation) return [];

    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.timestamp))
      .limit(limit);
  }

  async resetChatConversation(userId: string, cardType: string): Promise<ChatConversation> {
    return db.transaction(async (tx: any) => {
      const now = new Date();
      await tx
        .update(chatConversations)
        .set({ archivedAt: now })
        .where(and(
          eq(chatConversations.userId, userId),
          eq(chatConversations.cardType, cardType),
          isNull(chatConversations.archivedAt),
        ));

      // Preserve any pre-migration rows even if reset is the first request
      // made after the schema change.
      const legacyMessages = await tx
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.cardType, cardType),
          isNull(chatMessages.conversationId),
        ))
        .limit(1);
      if (legacyMessages.length > 0) {
        const [legacyConversation] = await tx
          .insert(chatConversations)
          .values({ userId, cardType, archivedAt: now })
          .returning();
        await tx
          .update(chatMessages)
          .set({ conversationId: legacyConversation.id })
          .where(and(
            eq(chatMessages.userId, userId),
            eq(chatMessages.cardType, cardType),
            isNull(chatMessages.conversationId),
          ));
      }

      const [created] = await tx
        .insert(chatConversations)
        .values({ userId, cardType })
        .returning();
      return created;
    });
  }

  // Cycle data operations with backup redundancy
  async getCycleData(userId: string): Promise<CycleData | undefined> {
    try {
      // Try database first
      const [data] = await db
        .select()
        .from(cycleData)
        .where(eq(cycleData.userId, userId))
        .orderBy(desc(cycleData.lastUpdated))
        .limit(1);
      
      if (data) {
        console.log(`✅ Cycle data retrieved from database`);
        return data;
      }
      
      // If no data in database, try object storage backup
      console.log(`ℹ️ No cycle data in database, checking private backup`);
      const backupData = await readFromObjectStorage(userId, 'cycle_data');
      
      if (backupData) {
        console.log(`🔄 Restoring cycle data from private backup`);
        return backupData; // Return backup data directly to avoid infinite loop
      }
      
      return undefined;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Database error for cycle data, trying private backup`, errorMessage);
      // If database completely fails, try backup
      const backupData = await readFromObjectStorage(userId, 'cycle_data');
      return backupData || undefined;
    }
  }

  async getMoonPattern(userId: string): Promise<MoonPatternRecord | undefined> {
    const [row] = await db.select().from(moonPatterns).where(eq(moonPatterns.userId, userId));
    return row ? { ...row.pattern, revision: row.revision } : undefined;
  }

  async getMoonPatternHistory(userId: string): Promise<MoonPatternRevisionRecord[]> {
    let rows = await db.select().from(moonPatternRevisions).where(eq(moonPatternRevisions.userId, userId)).orderBy(asc(moonPatternRevisions.revision));
    if (!rows.length) {
      const current = await this.getMoonPattern(userId);
      if (current) {
        const { revision, ...pattern } = current;
        const effectiveDate = await resolveUserDate(userId, this);
        await db.insert(moonPatternRevisions).values({ userId, revision, effectiveDate, pattern }).onConflictDoNothing();
        rows = await db.select().from(moonPatternRevisions).where(eq(moonPatternRevisions.userId, userId)).orderBy(asc(moonPatternRevisions.revision));
      }
    }
    return rows.map((row: typeof moonPatternRevisions.$inferSelect) => ({ revision: row.revision, effectiveDate: row.effectiveDate, pattern: row.pattern }));
  }

  async connectMoonPattern(userId: string, input: ConnectMoonPattern): Promise<MoonPatternRecord> {
    const { expectedRevision, pattern } = connectMoonPatternSchema.parse(input);
    const revision = expectedRevision + 1;
    const effectiveDate = await resolveUserDate(userId, this);
    const row = await db.transaction(async (tx: any) => {
      const rows = expectedRevision === 0
        ? await tx.insert(moonPatterns).values({ userId, pattern, revision }).onConflictDoNothing({ target: moonPatterns.userId }).returning()
        : await tx.update(moonPatterns).set({ pattern, revision, updatedAt: new Date() }).where(and(eq(moonPatterns.userId, userId), eq(moonPatterns.revision, expectedRevision))).returning();
      if (!rows[0]) throw new MoonPatternConflict();
      await tx.insert(moonPatternRevisions).values({ userId, revision, effectiveDate, pattern });
      return rows[0];
    });
    return { ...row.pattern, revision: row.revision };
  }

  async getCycleContext(userId: string): Promise<any | undefined> {
    const [rawData, pattern] = await Promise.all([this.getCycleData(userId), this.getMoonPattern(userId)]);
    const asOfDate = (rawData as any)?.asOfDate || await resolveUserDate(userId, this);
    return buildCycleContext(rawData, pattern, asOfDate, rawData ? resolveCycleLength(rawData) : DEFAULT_CYCLE_LENGTH);
  }

  async upsertCycleData(data: InsertCycleData): Promise<CycleData> {
    try {
      // Check if cycle data exists for user (this uses database-first lookup)
      let result: CycleData;
      
      const [existingData] = await db
        .select()
        .from(cycleData)
        .where(eq(cycleData.userId, data.userId))
        .orderBy(desc(cycleData.lastUpdated))
        .limit(1);
      
      if (existingData) {
        // CRITICAL: Preserve existing periodData if not explicitly provided in the update
        // This prevents accidental data loss when only updating other fields like cycleStartDate
        const preservedPeriodData = data.periodData !== undefined ? data.periodData : existingData.periodData;

        // S8: period_end_date must track cycle_start_date. When a new period start is
        // logged (cycleStartDate advances to a different date than the stored one), the
        // old periodEndDate belongs to the previous cycle and must be cleared — the new
        // period's end isn't known yet. Callers always echo the previously-fetched
        // periodEndDate on every PUT (see useCycleData.ts), so presence alone can't
        // signal an intentional end-date write; the cycleStartDate change is the signal.
        const isNewPeriodStart = data.cycleStartDate !== undefined && data.cycleStartDate !== existingData.cycleStartDate;
        const nextPeriodEndDate = isNewPeriodStart ? null : data.periodEndDate;

        const [updated] = await db
          .update(cycleData)
          .set({ ...data, periodData: preservedPeriodData, periodEndDate: nextPeriodEndDate, lastUpdated: new Date() })
          .where(eq(cycleData.userId, data.userId))
          .returning();
        result = updated;
        console.log(`✅ Cycle data updated in database (period history preserved: ${preservedPeriodData !== null})`);
      } else {
        const [newData] = await db
          .insert(cycleData)
          .values(data)
          .returning();
        result = newData;
        console.log(`✅ New cycle data created in database`);
      }
      
      // DUAL-WRITE: Also save to object storage as backup
      await saveToObjectStorage(data.userId, 'cycle_data', result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to save cycle data to database`, errorMessage);
      throw error;
    }
  }

  // New astrology operations
  async getBirthChart(userId: string): Promise<BirthChart | undefined> {
    const [data] = await db
      .select()
      .from(birthChart)
      .where(eq(birthChart.userId, userId))
      .limit(1);
    return data;
  }

  async createBirthChart(data: InsertBirthChart): Promise<BirthChart> {
    const [newChart] = await db
      .insert(birthChart)
      .values(data)
      .returning();
    return newChart;
  }

  async updateBirthChart(userId: string, data: Partial<InsertBirthChart>): Promise<BirthChart> {
    const [updated] = await db
      .update(birthChart)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(birthChart.userId, userId))
      .returning();
    return updated;
  }

  async getCurrentSky(userId: string, date?: string): Promise<CurrentSky | undefined> {
    let query = db
      .select()
      .from(currentSky)
      .where(eq(currentSky.userId, userId));

    if (date) {
      const [data] = await db
        .select()
        .from(currentSky)
        .where(and(eq(currentSky.userId, userId), eq(currentSky.date, date)))
        .orderBy(desc(currentSky.createdAt))
        .limit(1);
      return data;
    } else {
      const [data] = await db
        .select()
        .from(currentSky)
        .where(eq(currentSky.userId, userId))
        .orderBy(desc(currentSky.createdAt))
        .limit(1);
      return data;
    }
  }

  async upsertCurrentSky(data: InsertCurrentSky): Promise<CurrentSky> {
    // Check if sky data exists for this user and date
    const existing = await this.getCurrentSky(data.userId, data.date);
    
    if (existing) {
      const [updated] = await db
        .update(currentSky)
        .set(data)
        .where(and(eq(currentSky.userId, data.userId), eq(currentSky.date, data.date)))
        .returning();
      return updated;
    } else {
      const [newData] = await db
        .insert(currentSky)
        .values(data)
        .returning();
      return newData;
    }
  }

  async getCurrentTransits(userId: string, date?: string): Promise<CurrentTransits | undefined> {
    if (date) {
      const [data] = await db
        .select()
        .from(currentTransits)
        .where(and(eq(currentTransits.userId, userId), eq(currentTransits.date, date)))
        .orderBy(desc(currentTransits.createdAt))
        .limit(1);
      return data;
    } else {
      const [data] = await db
        .select()
        .from(currentTransits)
        .where(eq(currentTransits.userId, userId))
        .orderBy(desc(currentTransits.createdAt))
        .limit(1);
      return data;
    }
  }

  async upsertCurrentTransits(data: InsertCurrentTransits): Promise<CurrentTransits> {
    // Check if transits data exists for this user and date
    const existing = await this.getCurrentTransits(data.userId, data.date);
    
    if (existing) {
      const [updated] = await db
        .update(currentTransits)
        .set(data)
        .where(and(eq(currentTransits.userId, data.userId), eq(currentTransits.date, data.date)))
        .returning();
      return updated;
    } else {
      const [newData] = await db
        .insert(currentTransits)
        .values(data)
        .returning();
      return newData;
    }
  }

  // Sleep data operations
  async getSleepData(userId: string, date?: string): Promise<SleepData[]> {
    if (date) {
      return await db
        .select()
        .from(sleepData)
        .where(and(eq(sleepData.userId, userId), eq(sleepData.sleepDate, date)))
        .orderBy(desc(sleepData.sleepDate));
    } else {
      return await db
        .select()
        .from(sleepData)
        .where(eq(sleepData.userId, userId))
        .orderBy(desc(sleepData.sleepDate));
    }
  }

  async createSleepData(data: InsertSleepData): Promise<SleepData> {
    const [newData] = await db
      .insert(sleepData)
      .values(data)
      .returning();
    return newData;
  }

  // Rest & Rising submission operations
  async getRestRisingSubmissions(userId: string, cyclePhase?: string): Promise<RestRisingSubmission[]> {
    if (cyclePhase) {
      return await db
        .select()
        .from(restRisingSubmissions)
        .where(and(eq(restRisingSubmissions.userId, userId), eq(restRisingSubmissions.cyclePhase, cyclePhase)))
        .orderBy(desc(restRisingSubmissions.submissionDate), desc(restRisingSubmissions.createdAt));
    } else {
      return await db
        .select()
        .from(restRisingSubmissions)
        .where(eq(restRisingSubmissions.userId, userId))
        .orderBy(desc(restRisingSubmissions.submissionDate), desc(restRisingSubmissions.createdAt));
    }
  }

  async createRestRisingSubmission(data: InsertRestRisingSubmission): Promise<RestRisingSubmission> {
    const [newSubmission] = await db
      .insert(restRisingSubmissions)
      .values(data)
      .returning();
    return newSubmission;
  }

  async getRestRisingSubmissionsByDateRange(userId: string, startDate: string, endDate: string): Promise<RestRisingSubmission[]> {
    return await db
      .select()
      .from(restRisingSubmissions)
      .where(
        and(
          eq(restRisingSubmissions.userId, userId),
          and(
            sql`${restRisingSubmissions.sleepDate} >= ${startDate}`,
            sql`${restRisingSubmissions.sleepDate} <= ${endDate}`
          )
        )
      )
      .orderBy(desc(restRisingSubmissions.sleepDate), desc(restRisingSubmissions.createdAt));
  }

  async getRestRisingSubmissionForSleepDate(userId: string, sleepDate: string): Promise<RestRisingSubmission | undefined> {
    const rows = await db
      .select()
      .from(restRisingSubmissions)
      .where(and(eq(restRisingSubmissions.userId, userId), eq(restRisingSubmissions.sleepDate, sleepDate)))
      .orderBy(desc(restRisingSubmissions.createdAt));
    return mergeRestRisingRows(rows);
  }

  // Daily AI insight caching operations
  async getDailyInsight(userId: string, type: 'rest' | 'rise', localDate: string): Promise<RestRisingSubmission | undefined> {
    const [insight] = await db
      .select()
      .from(restRisingSubmissions)
      .where(
        and(
          eq(restRisingSubmissions.userId, userId),
          eq(restRisingSubmissions.submissionType, type),
          eq(restRisingSubmissions.localDate, localDate)
        )
      )
      .limit(1);
    return insight;
  }

  async upsertDailyInsight(data: InsertRestRisingSubmission): Promise<RestRisingSubmission> {
    const existing = await this.getDailyInsight(
      data.userId, 
      data.submissionType as 'rest' | 'rise', 
      data.localDate!
    );
    
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(restRisingSubmissions)
        .set({ 
          ...data, 
          updatedAt: new Date()
        })
        .where(eq(restRisingSubmissions.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record
      const [newInsight] = await db
        .insert(restRisingSubmissions)
        .values(data)
        .returning();
      return newInsight;
    }
  }

  // File upload operations
  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    const [newUpload] = await db
      .insert(fileUploads)
      .values(upload)
      .returning();
    return newUpload;
  }

  async getFileUpload(id: string): Promise<FileUpload | undefined> {
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.id, id));
    return upload;
  }
  
  // Gene Keys operations
  async getGeneKeys(userId: string): Promise<GeneKeys | undefined> {
    const [data] = await db
      .select()
      .from(geneKeys)
      .where(eq(geneKeys.userId, userId));
    return data;
  }
  
  async createGeneKeys(data: InsertGeneKeys): Promise<GeneKeys> {
    const [newData] = await db
      .insert(geneKeys)
      .values(data)
      .returning();
    return newData;
  }
  
  async updateGeneKeys(userId: string, data: Partial<InsertGeneKeys>): Promise<GeneKeys> {
    const [updated] = await db
      .update(geneKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(geneKeys.userId, userId))
      .returning();
    return updated;
  }
  
  // Human Design operations
  async getHumanDesign(userId: string): Promise<HumanDesign | undefined> {
    const [data] = await db
      .select()
      .from(humanDesign)
      .where(eq(humanDesign.userId, userId));
    return data;
  }
  
  async createHumanDesign(data: InsertHumanDesign): Promise<HumanDesign> {
    const [newData] = await db
      .insert(humanDesign)
      .values(data)
      .returning();
    return newData;
  }
  
  async updateHumanDesign(userId: string, data: Partial<InsertHumanDesign>): Promise<HumanDesign> {
    const [updated] = await db
      .update(humanDesign)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(humanDesign.userId, userId))
      .returning();
    return updated;
  }

  // Practice operations for CL/CE system
  async getPracticesByCreativeState(
    creativeState: 'CL' | 'CE', 
    practiceType: 'meditation' | 'movement', 
    cyclePhase?: string
  ): Promise<Practice[]> {
    try {
      // Build all conditions in a single array
      const conditions = [
        eq(practices.creativeState, creativeState),
        eq(practices.practiceType, practiceType),
        eq(practices.isActive, 'true') // Schema uses varchar for isActive
      ];

      // For movement practices, filter by cycle phase if provided
      if (practiceType === 'movement' && cyclePhase) {
        // Normalize cyclePhase comparison (trim and consistent casing)
        const normalizedPhase = cyclePhase.trim();
        console.log(`STORAGE: Looking for matching ${creativeState} ${practiceType} practices`);
        
        // Use PostgreSQL JSONB containment operator for array checking
        conditions.push(
          sql`${practices.cyclePhases} @> ${JSON.stringify([normalizedPhase])}`
        );
      }

      // Execute query with all conditions combined
      const results = await db
        .select()
        .from(practices)
        .where(and(...conditions));

      console.log(`STORAGE: Found ${results.length} matching ${creativeState} ${practiceType} practices`);
      
      // Always return an array (never undefined)
      return results || [];
    } catch (error) {
      console.error(`Error in getPracticesByCreativeState for ${creativeState} ${practiceType}:`, error);
      // Return empty array on error to prevent spreading issues
      return [];
    }
  }

  async createPractice(data: InsertPractice): Promise<Practice> {
    const [practice] = await db
      .insert(practices)
      .values(data)
      .returning();
    return practice;
  }

  async getUserPracticePreference(userId: string, practiceId: string): Promise<UserPracticePreference | undefined> {
    const [preference] = await db
      .select()
      .from(userPracticePreferences)
      .where(
        and(
          eq(userPracticePreferences.userId, userId),
          eq(userPracticePreferences.practiceId, practiceId)
        )
      );
    return preference;
  }

  async upsertUserPracticePreference(data: InsertUserPracticePreference): Promise<UserPracticePreference> {
    const [preference] = await db
      .insert(userPracticePreferences)
      .values(data)
      .onConflictDoUpdate({
        target: [userPracticePreferences.userId, userPracticePreferences.practiceId],
        set: {
          preferenceScore: data.preferenceScore,
          usageCount: sql`${userPracticePreferences.usageCount} + 1`,
          lastUsed: new Date(),
          customDuration: data.customDuration,
          personalNotes: data.personalNotes,
          isHidden: data.isHidden,
          updatedAt: new Date()
        }
      })
      .returning();
    return preference;
  }

  // Movement Intelligence operations
  async getMovementLog(userId: string, date: string): Promise<MovementLog | undefined> {
    const rows = await db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, userId), eq(movementLogs.date, date)));
    return rows.find((r: MovementLog) => r.readinessScore != null || r.rmssd != null)
      ?? rows.find((r: MovementLog) => !r.practiceName) ?? rows[0];
  }

  async getMovementLogs(userId: string, daysBack?: number): Promise<MovementLog[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (daysBack ?? 0));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, userId), daysBack === undefined ? undefined : gte(movementLogs.date, cutoffStr), or(isNotNull(movementLogs.readinessScore), isNotNull(movementLogs.rmssd))))
      .orderBy(desc(movementLogs.date));
  }

  async getMovementCalendar(userId: string, year: number, month: number): Promise<MovementLog[]> {
    // month is 1-indexed (January = 1)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate(); // last day of month
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    return db
      .select()
      .from(movementLogs)
      .where(
        and(
          eq(movementLogs.userId, userId),
          gte(movementLogs.date, startDate),
          lte(movementLogs.date, endDate)
        )
      )
      .orderBy(movementLogs.date);
  }

  async upsertMovementHrv(data: { userId: string; date: string; rmssd: number; sdnn?: number; hrvSource: string; hrvQuality?: number; hrvIntervals?: number[]; hrvCapturedAt?: Date }): Promise<MovementLog> {
    const rows = await db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, data.userId), eq(movementLogs.date, data.date)));
    const existing = rows.find((row: MovementLog) => row.readinessScore != null || row.rmssd != null)
      ?? rows.find((row: MovementLog) => !row.practiceName);
    const values = {
      rmssd: data.rmssd,
      sdnn: data.sdnn ?? null,
      hrvSource: data.hrvSource,
      hrvQuality: data.hrvQuality ?? null,
      hrvIntervals: data.hrvIntervals ?? null,
      hrvCapturedAt: data.hrvCapturedAt ?? new Date(),
      rhythmColour: null,
      movementColour: null,
      movementInstrumentVersion: null,
      signalContext: null,
      updatedAt: new Date(),
    };
    if (existing) {
      const [log] = await db.update(movementLogs).set(values).where(eq(movementLogs.id, existing.id)).returning();
      return log;
    }
    const [log] = await db.insert(movementLogs).values({ userId: data.userId, date: data.date, ...values }).returning();
    return log;
  }

  async upsertMovementMorning(data: MovementMorningInput): Promise<MovementLog> {
    // Attach readiness to today's HRV anchor row when one already exists.
    const rows = await db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, data.userId), eq(movementLogs.date, data.date)));
    const existing = rows.find((r: MovementLog) => r.readinessScore != null || r.rmssd != null)
      ?? rows.find((r: MovementLog) => !r.practiceName);

    if (existing) {
      const [log] = await db
        .update(movementLogs)
        .set({
          ...(data.rmssd !== undefined ? { rmssd: data.rmssd } : {}),
          ...(data.sdnn !== undefined ? { sdnn: data.sdnn } : {}),
          ...(data.hrvSource !== undefined ? { hrvSource: data.hrvSource } : {}),
          ...(data.hrvQuality !== undefined ? { hrvQuality: data.hrvQuality } : {}),
          ...(data.hrvIntervals !== undefined ? { hrvIntervals: data.hrvIntervals } : {}),
          ...(data.hrvCapturedAt !== undefined ? { hrvCapturedAt: data.hrvCapturedAt } : {}),
          readinessScore: data.readinessScore,
          rhythmColour: data.rhythmColour ?? null,
          movementColour: data.movementColour ?? null,
          movementInstrumentVersion: data.movementInstrumentVersion ?? null,
          signalContext: data.signalContext ?? null,
          ...(data.cycleDay !== undefined ? { cycleDay: data.cycleDay } : {}),
          ...(data.cyclePhase !== undefined ? { cyclePhase: data.cyclePhase } : {}),
          updatedAt: new Date(),
        })
        .where(eq(movementLogs.id, existing.id))
        .returning();
      return log;
    }

    const [log] = await db
      .insert(movementLogs)
      .values({
        userId: data.userId,
        date: data.date,
        ...(data.rmssd !== undefined ? { rmssd: data.rmssd } : {}),
        ...(data.sdnn !== undefined ? { sdnn: data.sdnn } : {}),
        ...(data.hrvSource !== undefined ? { hrvSource: data.hrvSource } : {}),
        ...(data.hrvQuality !== undefined ? { hrvQuality: data.hrvQuality } : {}),
        ...(data.hrvIntervals !== undefined ? { hrvIntervals: data.hrvIntervals } : {}),
        ...(data.hrvCapturedAt !== undefined ? { hrvCapturedAt: data.hrvCapturedAt } : {}),
        readinessScore: data.readinessScore,
        rhythmColour: data.rhythmColour ?? null,
        movementColour: data.movementColour ?? null,
        movementInstrumentVersion: data.movementInstrumentVersion ?? null,
        signalContext: data.signalContext ?? null,
        ...(data.cycleDay !== undefined ? { cycleDay: data.cycleDay } : {}),
        ...(data.cyclePhase !== undefined ? { cyclePhase: data.cyclePhase } : {}),
      })
      .returning();
    return log;
  }

  async upsertMovementWorkout(userId: string, date: string, workout: { practiceName: string; durationMinutes: number; notes?: string; practiceSignal?: string | null }): Promise<MovementLog> {
    // INSERT new session row — multiple sessions per day are allowed
    const [log] = await db
      .insert(movementLogs)
      .values({
        userId,
        date,
        practiceName: workout.practiceName,
        durationMinutes: workout.durationMinutes,
        notes: workout.notes ?? null,
        practiceSignal: workout.practiceSignal ?? null,
      })
      .returning();
    return log;
  }

  async getMovementWorkoutsForDate(userId: string, date: string): Promise<MovementLog[]> {
    return db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, userId), eq(movementLogs.date, date), isNotNull(movementLogs.practiceName)))
      .orderBy(desc(movementLogs.createdAt));
  }

  async getLatestMovementWorkout(userId: string): Promise<MovementLog | null> {
    const results = await db
      .select()
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, userId), isNotNull(movementLogs.practiceName)))
      .orderBy(desc(movementLogs.createdAt))
      .limit(1);
    return results[0] ?? null;
  }

  async updateMovementNotes(userId: string, date: string, notes: string): Promise<MovementLog | null> {
    // Find the HRV anchor row (has readinessScore), fall back to first row
    const rows = await db
      .select({ id: movementLogs.id })
      .from(movementLogs)
      .where(and(eq(movementLogs.userId, userId), eq(movementLogs.date, date)));
    const target = rows.find((_: { id: string }, i: number) => i === 0); // first row (anchor preferred via getMovementLog order)
    if (!target) {
      const [created] = await db
        .insert(movementLogs)
        .values({ userId, date, notes })
        .returning();
      return created ?? null;
    }
    const [log] = await db
      .update(movementLogs)
      .set({ notes, updatedAt: new Date() })
      .where(eq(movementLogs.id, target.id))
      .returning();
    return log ?? null;
  }

  async updateMovementSessionNotes(userId: string, id: string, notes: string): Promise<MovementLog | null> {
    const [log] = await db
      .update(movementLogs)
      .set({ notes, updatedAt: new Date() })
      .where(and(eq(movementLogs.id, id), eq(movementLogs.userId, userId)))
      .returning();
    return log ?? null;
  }

  async getLatestRestRisingSubmission(userId: string): Promise<RestRisingSubmission | undefined> {
    const [latest] = await db
      .select()
      .from(restRisingSubmissions)
      .where(eq(restRisingSubmissions.userId, userId))
      .orderBy(desc(restRisingSubmissions.sleepDate), desc(restRisingSubmissions.createdAt))
      .limit(1);
    if (!latest) return undefined;
    return this.getRestRisingSubmissionForSleepDate(userId, latest.sleepDate);
  }

}

export const storage = new DatabaseStorage();
