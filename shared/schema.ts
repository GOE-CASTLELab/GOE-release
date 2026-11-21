import type { MoonPattern } from './moonPattern';
import { sql } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  unique,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  date,
  time,
  uuid,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { MovementSignalSnapshot } from './movementSignal';

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  lifeStage: varchar("life_stage"), // 'cycling' | 'perimenopause' | 'postmenopause' — self-selected, gates night sweats field
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User profiles for extended data
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  birthDate: date("birth_date"),
  birthTime: time("birth_time"),
  birthLocation: varchar("birth_location"),
  timezone: varchar("timezone"),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-owned record of returning to GOE. Exact timestamps remain in the
// owner's instance; the contribution projection emits bounded relative bands.
export const returnPatternSessions = pgTable("return_pattern_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  localDate: date("local_date").notNull(),
  localTimeBand: varchar("local_time_band").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  activeSeconds: integer("active_seconds").default(0).notNull(),
  closedAt: timestamp("closed_at"),
}, (table) => [
  index("idx_return_pattern_owner_date").on(table.userId, table.localDate),
  index("idx_return_pattern_owner_opened").on(table.userId, table.openedAt),
]);

// Global state for modular cards
export const globalState = pgTable("global_state", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  cardType: varchar("card_type").notNull(),
  stateData: jsonb("state_data").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Message types enum
export const messageTypeEnum = pgEnum("message_type", ["user", "agent", "system"]);

// Rest & Rising classification enums
export const cyclePhaseEnum = pgEnum("cycle_phase", ["menstruation", "follicular", "ovulatory", "early luteal", "late luteal"]);

// Creative State classification for AI-powered practice selection
export const creativeStateEnum = pgEnum("creative_state", ["CL", "CE"]); // Creative Lesson / Creative Experience
export const practiceTypeEnum = pgEnum("practice_type", ["meditation", "movement"]);

// AI insight type for daily caching
export const aiInsightTypeEnum = pgEnum("ai_insight_type", ["rest", "rise"]);

// One active conversation per owner/card. Reset archives the active row and
// creates a new one; archived rows remain available as conversation history.
export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  cardType: varchar("card_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  index("idx_chat_conversations_owner_card").on(table.userId, table.cardType),
  uniqueIndex("idx_chat_conversations_one_active")
    .on(table.userId, table.cardType)
    .where(sql`${table.archivedAt} is null`),
]);

// Chat messages for all card types
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  cardType: varchar("card_type").notNull(),
  conversationId: uuid("conversation_id").references(() => chatConversations.id),
  messageType: messageTypeEnum("message_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Birth chart data (populated once, stored permanently)
export const birthChart = pgTable("birth_chart", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rawChartData: jsonb("raw_chart_data").notNull(), // Complete AstroApp response
  transformedData: jsonb("transformed_data").notNull(), // Transformed for prompts
  chartData: jsonb("chart_data").notNull(), // AstroApp chart metadata
  houseCusps: jsonb("house_cusps").notNull(), // Array of house positions
  objects: jsonb("objects").notNull(), // Array of planetary objects
  anthropicResponse: jsonb("anthropic_response"), // Claude's birth chart interpretations (permanent)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Current sky data (updated daily)
export const currentSky = pgTable("current_sky", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  rawSkyData: jsonb("raw_sky_data"), // Raw AstroApp response
  transformedData: jsonb("transformed_data").notNull(), // Transformed for prompts
  anthropicResponse: jsonb("anthropic_response"), // Legacy field
  claudeInterpretations: jsonb("claude_interpretations"), // Claude insights
  createdAt: timestamp("created_at").defaultNow(),
});

// Current transits data (updated daily)
export const currentTransits = pgTable("current_transits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  rawTransitData: jsonb("raw_transit_data"), // Raw AstroApp response
  transformedData: jsonb("transformed_data").notNull(), // Transformed for prompts
  anthropicResponse: jsonb("anthropic_response"), // Legacy field
  claudeInterpretations: jsonb("claude_interpretations"), // Claude insights
  createdAt: timestamp("created_at").defaultNow(),
});

// S12: astrology_data table (legacy, empty, unused) removed from code here.
// The physical Postgres table still exists on disk and needs a manual DROP
// later — this pass only removes code references so nothing reads/writes it.
// All real astrology writes go to birthChart / currentSky / currentTransits.

// Cycle data for menstrual tracking
export const cycleData = pgTable("cycle_data", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  cycleStartDate: date("cycle_start_date").notNull(),
  cycleLength: integer("cycle_length").notNull().default(28),
  moonCenterStartDate: date("moon_center_start_date"),
  periodEndDate: date("period_end_date"),
  periodData: jsonb("period_data"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Optional moon-centre connection, independent of menstrual records. No seed or
// migration from the legacy date-only anchor; explicit owner connection only.
export const moonPatterns = pgTable("moon_patterns", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  pattern: jsonb("pattern").$type<MoonPattern>().notNull(),
  revision: integer("revision").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Append-only history used by contribution windows. Earlier overwritten
// patterns are deliberately not reconstructed at cutover.
export const moonPatternRevisions = pgTable("moon_pattern_revisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  revision: integer("revision").notNull(),
  effectiveDate: date("effective_date").notNull(),
  pattern: jsonb("pattern").$type<MoonPattern>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("moon_pattern_revision_owner_unique").on(table.userId, table.revision)]);

// Sleep and dream data
export const sleepData = pgTable("sleep_data", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sleepDate: date("sleep_date").notNull(),
  bedtime: time("bedtime"),
  wakeTime: time("wake_time"),
  sleepQuality: integer("sleep_quality"),
  dreamNotes: text("dream_notes"),
  sleepMetrics: jsonb("sleep_metrics"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gene Keys data
export const geneKeys = pgTable("gene_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  // Core Spheres (All 11 spheres) - Each stored as jsonb with gate/line/transformation AND full text interpretation
  lifesWork: jsonb("lifes_work").notNull(), // { gate: "21", line: "3", transformation: "Control → Authority → Valor", content: "full text..." }
  evolution: jsonb("evolution").notNull(),
  radiance: jsonb("radiance").notNull(),
  purpose: jsonb("purpose").notNull(),
  vocation: jsonb("vocation").notNull(),
  culture: jsonb("culture").notNull(),
  pearl: jsonb("pearl").notNull(),
  iq: jsonb("iq").notNull(), // IQ sphere - mental intelligence
  eq: jsonb("eq").notNull(), // EQ sphere - emotional intelligence  
  sq: jsonb("sq").notNull(), // SQ sphere - spiritual intelligence
  attraction: jsonb("attraction").notNull(), // Attraction sphere - magnetic field
  // Profile and sequences
  profile: varchar("profile"), // e.g., "3/6"
  activationSequence: jsonb("activation_sequence"),
  venusSequence: jsonb("venus_sequence"),
  earthSequence: jsonb("earth_sequence"),
  harmonySequence: jsonb("harmony_sequence"), // array of spheres, each { gate, line, title, transformation, content }
  // Raw chart data for visual recreation
  fullChartData: jsonb("full_chart_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Human Design data
export const humanDesign = pgTable("human_design", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  // Basic HD info with full text interpretations
  type: varchar("type").notNull(), // Generator, Projector, etc.
  strategy: varchar("strategy").notNull(),
  authority: varchar("authority").notNull(),
  profile: varchar("profile").notNull(), // e.g., "3/6"
  definition: varchar("definition"), // Split, Single, etc.
  notSelfTheme: varchar("not_self_theme"),
  signature: varchar("signature"),
  incarnationCross: varchar("incarnation_cross"),
  // Interpretations stored as jsonb: { title, subtitle, content }
  typeStrategyInterpretation: jsonb("type_strategy_interpretation"),
  authorityInterpretation: jsonb("authority_interpretation"),
  profileInterpretation: jsonb("profile_interpretation"),
  definitionInterpretation: jsonb("definition_interpretation"),
  incarnationCrossInterpretation: jsonb("incarnation_cross_interpretation"),
  notSelfThemeInterpretation: jsonb("not_self_theme_interpretation"),
  signatureInterpretation: jsonb("signature_interpretation"),
  // Centers (9 centers with defined/undefined status AND interpretations)
  centers: jsonb("centers").notNull(), // {head: {defined: true, interpretation: "text..."}, etc.}
  // Gates and channels
  definedGates: jsonb("defined_gates").notNull(), // Array of gate numbers with details
  channels: jsonb("channels").notNull(), // Array of defined channels
  // Planetary positions for both Design and Personality
  designPositions: jsonb("design_positions").notNull(),
  personalityPositions: jsonb("personality_positions").notNull(),
  // Raw chart data for visual recreation
  fullChartData: jsonb("full_chart_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File uploads
export const fileUploads = pgTable("file_uploads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(),
  filePath: varchar("file_path").notNull(),
  processedData: jsonb("processed_data"),
  uploadDate: timestamp("upload_date").defaultNow(),
});

// Rest & Rising daily submissions
export const restRisingSubmissions = pgTable("rest_rising_submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sleepDate: date("sleep_date").notNull(), // The evening's calendar date - shared anchor for both Rest and Rising
  submissionDate: date("submission_date").notNull(),
  // Rest tab data (Evening Reflection)
  restTime: time("rest_time"), // Time to Rest
  energyAssessment: varchar("energy_assessment"), // Raw dropdown selection
  energyAssessmentClassification: varchar("energy_assessment_classification"), // resourced/activated/depleted
  restReflection: text("rest_reflection"), // Sacred Rest Practice free text
  // Rising tab data (Reflect on your rest and awakening)
  riseTime: time("rise_time"), // Rise Time from time picker
  sleepProcess: varchar("sleep_process"), // Raw dropdown selection  
  sleepProcessClassification: varchar("sleep_process_classification"), // resourced/activated/depleted
  wakingState: varchar("waking_state"), // Raw dropdown selection
  wakingStateClassification: varchar("waking_state_classification"), // resourced/activated/depleted
  dreamFragment: text("dream_fragment"), // Dream content from Rising Integration Practice
  morningReflection: text("morning_reflection"), // Morning reflection from Rising Integration Practice
  // Cycle context at time of submission
  cyclePhase: varchar("cycle_phase"), // menstruation/follicular/ovulatory/luteal
  cycleDay: integer("cycle_day"), // Day in cycle when submitted
  // SharedIntelligenceProfile fields — stored at submission for historical trend analysis
  nervousSystemState: varchar("nervous_system_state"), // 'resourced' | 'activated' | 'depleted' — synthesized from energy + sleep + waking
  moonPhase: varchar("moon_phase"),     // Lunar phase at time of submission
  moonCenter: varchar("moon_center"),   // GOE somatic centre at time of submission
  nightWakings: varchar("night_wakings"), // '0' | '1-2' | '3+' — from Rising form
  nightSweats: boolean("night_sweats"), // Perimenopause-gated — only captured when lifeStage = perimenopause/postmenopause
  alcoholConsumed: boolean("alcohol_consumed"), // From Evening REST form
  // AI insight caching fields
  submissionType: aiInsightTypeEnum("submission_type"), // rest or rise insight type
  localDate: date("local_date"), // User's local date for daily caching
  timezone: varchar("timezone"), // User's timezone for date calculations
  input: jsonb("input"), // Original input data for cache validation
  inputHash: varchar("input_hash"), // SHA256 hash of canonicalized input
  aiWisdom: text("ai_wisdom"), // AI-generated wisdom/interpretation text
  aiCreativeState: creativeStateEnum("ai_creative_state"), // CL/CE classification from AI
  aiRecommendations: jsonb("ai_recommendations"), // Meditation/movement selections and IDs
  model: varchar("model"), // AI model used (e.g., "claude-3-sonnet")
  promptVersion: varchar("prompt_version"), // Version of prompt used
  tokens: integer("tokens"), // Token count for API usage tracking
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for common queries  
  index("idx_user_submission_date").on(table.userId, table.submissionDate),
  index("idx_user_cycle_phase").on(table.userId, table.cyclePhase, table.submissionDate),
  // Unique index for daily AI insight caching (prevent duplicates)
  index("idx_user_insight_daily").on(table.userId, table.submissionType, table.localDate),
]);

// Practices system for AI-powered meditation and movement selection
export const practices = pgTable("practices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceType: practiceTypeEnum("practice_type").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  // CL/CE classification (Creative Lesson/Creative Experience)
  creativeState: creativeStateEnum("creative_state").notNull(),
  // Cycle phase applicability (for movements only)
  cyclePhases: jsonb("cycle_phases"), // Array of applicable phases: ["menstruation", "follicular", etc.]
  // Audio/media content
  audioUrl: varchar("audio_url"), // For meditation audio files
  audioFileName: varchar("audio_file_name"), // Original filename
  // Practice metadata
  duration: integer("duration"), // Duration in minutes
  instructions: text("instructions"), // Detailed practice instructions
  wisdom: text("wisdom"), // Default wisdom text (can be overridden by AI)
  tags: jsonb("tags"), // Array of practice tags for filtering
  isActive: varchar("is_active").default("true"), // Soft delete capability
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for practice lookup
  index("idx_practice_type_creative_state").on(table.practiceType, table.creativeState),
  index("idx_creative_state_active").on(table.creativeState, table.isActive),
]);

// User practice preferences for future personalization
export const userPracticePreferences = pgTable("user_practice_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  practiceId: varchar("practice_id").references(() => practices.id).notNull(),
  // Preference metrics
  preferenceScore: integer("preference_score").default(0), // -2 to +2 scale
  usageCount: integer("usage_count").default(0),
  lastUsed: timestamp("last_used"),
  // User customizations
  customDuration: integer("custom_duration"), // User's preferred duration override
  personalNotes: text("personal_notes"), // User's private notes about this practice
  isHidden: varchar("is_hidden").default("false"), // User can hide practices they don't want
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint - one preference record per user per practice
  index("idx_user_practice_unique").on(table.userId, table.practiceId),
  index("idx_user_preferences").on(table.userId, table.preferenceScore),
]);

// Schema exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertUserProfile = typeof userProfiles.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;

export type InsertReturnPatternSession = typeof returnPatternSessions.$inferInsert;
export type ReturnPatternSession = typeof returnPatternSessions.$inferSelect;

export type InsertGlobalState = typeof globalState.$inferInsert;
export type GlobalState = typeof globalState.$inferSelect;

export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertChatConversation = typeof chatConversations.$inferInsert;
export type ChatConversation = typeof chatConversations.$inferSelect;

export type InsertCycleData = typeof cycleData.$inferInsert;
export type CycleData = typeof cycleData.$inferSelect;

export type InsertBirthChart = typeof birthChart.$inferInsert;
export type BirthChart = typeof birthChart.$inferSelect;

export type InsertCurrentSky = typeof currentSky.$inferInsert;
export type CurrentSky = typeof currentSky.$inferSelect;

export type InsertCurrentTransits = typeof currentTransits.$inferInsert;
export type CurrentTransits = typeof currentTransits.$inferSelect;

export type InsertSleepData = typeof sleepData.$inferInsert;
export type SleepData = typeof sleepData.$inferSelect;

export type InsertFileUpload = typeof fileUploads.$inferInsert;
export type FileUpload = typeof fileUploads.$inferSelect;

export type InsertRestRisingSubmission = typeof restRisingSubmissions.$inferInsert;
export type RestRisingSubmission = typeof restRisingSubmissions.$inferSelect;

export type InsertPractice = typeof practices.$inferInsert;
export type Practice = typeof practices.$inferSelect;

export type InsertUserPracticePreference = typeof userPracticePreferences.$inferInsert;
export type UserPracticePreference = typeof userPracticePreferences.$inferSelect;

export type InsertGeneKeys = typeof geneKeys.$inferInsert;
export type GeneKeys = typeof geneKeys.$inferSelect;

export type InsertHumanDesign = typeof humanDesign.$inferInsert;
export type HumanDesign = typeof humanDesign.$inferSelect;

// Insert schemas for validation
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGlobalStateSchema = createInsertSchema(globalState).omit({
  id: true,
  lastUpdated: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertCycleDataSchema = createInsertSchema(cycleData).omit({
  id: true,
  lastUpdated: true,
});

export const insertBirthChartSchema = createInsertSchema(birthChart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCurrentSkySchema = createInsertSchema(currentSky).omit({
  id: true,
  createdAt: true,
});

export const insertCurrentTransitsSchema = createInsertSchema(currentTransits).omit({
  id: true,
  createdAt: true,
});

export const insertSleepDataSchema = createInsertSchema(sleepData).omit({
  id: true,
  createdAt: true,
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  uploadDate: true,
});

export const insertRestRisingSubmissionSchema = createInsertSchema(restRisingSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertGeneKeysSchema = createInsertSchema(geneKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHumanDesignSchema = createInsertSchema(humanDesign).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPracticeSchema = createInsertSchema(practices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPracticePreferenceSchema = createInsertSchema(userPracticePreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Movement Intelligence logs — one record per user per day
// Morning read (RMSSD + subjective) upserted first; workout details added later same day
export const movementLogs = pgTable('movement_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),                    // YYYY-MM-DD — daily anchor
  rmssd: integer('rmssd'),                         // ms, derived by the selected HRV source
  sdnn: integer('sdnn'),                           // ms, sample SD of accepted NN intervals; absent for manual readings
  hrvSource: varchar('hrv_source'),                // camera_ppg | bluetooth_rr | manual | future adapter id
  hrvQuality: integer('hrv_quality'),              // source quality score, 0–100 when available
  hrvIntervals: jsonb('hrv_intervals'),             // accepted beat-to-beat intervals; no camera frames
  hrvCapturedAt: timestamp('hrv_captured_at'),
  readinessScore: integer('readiness_score'),      // 1–10 subjective
  rhythmColour: varchar('rhythm_colour'),          // 0.3.0 HRV-only colour; null while observing/missing
  movementColour: varchar('movement_colour'),      // 0.3.0 readiness + Rest/Rising colour
  movementInstrumentVersion: varchar('movement_instrument_version'),
  signalContext: jsonb('signal_context').$type<MovementSignalSnapshot>(),
  practiceName: varchar('practice_name'),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),                            // pre/during/post/insights — data brokerage ready
  practiceSignal: varchar('practice_signal'),      // green|yellow|orange|red — practice category colour
  cycleDay: integer('cycle_day'),                  // cycle day at time of log
  cyclePhase: varchar('cycle_phase'),              // menstruation|follicular|ovulatory|luteal
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_movement_user_date').on(table.userId, table.date),
]);

export type InsertMovementLog = typeof movementLogs.$inferInsert;
export type MovementLog = typeof movementLogs.$inferSelect;
export type MovementMorningInput = Pick<MovementLog, 'userId' | 'date' | 'readinessScore'> &
  Partial<Pick<MovementLog, 'rmssd' | 'sdnn' | 'hrvSource' | 'hrvQuality' | 'hrvIntervals' | 'hrvCapturedAt' |
    'cycleDay' | 'cyclePhase' | 'rhythmColour' | 'movementColour' | 'movementInstrumentVersion' | 'signalContext'>>;

export const insertMovementLogSchema = createInsertSchema(movementLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// GOEsky planet sky readings — collective, date-keyed, no user ID
// Persists across server restarts and deployments
export const goeskyPlanetReadings = pgTable(
  "goesky_planet_readings",
  {
    id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    date:      varchar("date").notNull(),    // YYYY-MM-DD
    planet:    varchar("planet").notNull(),  // Sun | Moon | Mercury | ...
    sign:      varchar("sign"),
    degree:    varchar("degree"),
    reading:   text("reading").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_goesky_planet_readings_date_planet").on(table.date, table.planet)]
);

// Personal sky insights — per-user, per-date, per-planet plain-text readings in GOE register
// Replaces JSON blob claudeInterpretations; allows individual planet generation + caching
export const personalSkyInsights = pgTable(
  "personal_sky_insights",
  {
    id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId:     varchar("user_id").references(() => users.id).notNull(),
    date:       varchar("date").notNull(),       // YYYY-MM-DD
    planet:     varchar("planet").notNull(),     // Sun | Moon | Mercury | ...
    sign:       varchar("sign"),
    degree:     varchar("degree"),
    retrograde: boolean("retrograde").default(false),
    insight:    text("insight").notNull(),
    createdAt:  timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_personal_sky_insights_user_date").on(table.userId, table.date),
    unique("uq_personal_sky_insights_user_date_planet").on(table.userId, table.date, table.planet),
  ]
);

// Personal weekly sky read — persists across server restarts (replaces in-memory weeklyReadCache)
export const personalWeeklyReads = pgTable(
  "personal_weekly_reads",
  {
    id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId:    varchar("user_id").references(() => users.id).notNull(),
    weekKey:   varchar("week_key").notNull(),  // Monday date, YYYY-MM-DD
    text:      text("text").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("uq_personal_weekly_reads_user_week").on(table.userId, table.weekKey),
  ]
);

// Personal design thread — weekly Human Design + Gene Keys threads, one per user per week
// HD = "how to move this week"; Gene Keys = "what to work with this week"
export const personalDesignThreads = pgTable(
  "personal_design_threads",
  {
    id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId:      varchar("user_id").references(() => users.id).notNull(),
    weekKey:     varchar("week_key").notNull(),  // Monday date, YYYY-MM-DD
    humanDesign: text("human_design").notNull(),
    geneKeys:    text("gene_keys").notNull(),
    createdAt:   timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("uq_personal_design_threads_user_week").on(table.userId, table.weekKey),
  ]
);
