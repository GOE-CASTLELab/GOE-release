import type { IStorage } from '../storage';
import { isDeepStrictEqual } from 'node:util';
import { calculateMovementSplit, type MovementLifeStage, type MovementSignalSnapshot } from '@shared/movementSignal';
import { previousDateString } from '@shared/restRisingCore';
import { resolveUserDate } from './userDate';

type MovementReadStorage = Pick<IStorage, 'getUser' | 'getUserProfile' | 'getCycleContext' | 'getMovementLog' |
  'getMovementLogs' | 'getRestRisingSubmissionForSleepDate' | 'upsertMovementMorning'>;

export async function refreshTodayMovementSignal(storage: MovementReadStorage, userId: string, localDate?: string) {
  const today = await resolveUserDate(userId, storage);
  const date = localDate ?? today;
  const log = await storage.getMovementLog(userId, date);
  if (!log || (log.rmssd == null && log.readinessScore == null)) return log ?? null;
  const [history, rest, profile] = await Promise.all([
    storage.getMovementLogs(userId), // Full owner history; same-phase readings may span cycles.
    storage.getRestRisingSubmissionForSleepDate(userId, previousDateString(date)),
    storage.getUser(userId),
  ]);
  const published = date === today && log.cyclePhase == null && !log.signalContext
    ? await storage.getCycleContext(userId) : null;
  const cyclePhase = log.cyclePhase ?? published?.cyclePhase?.toLowerCase() ?? null;
  const cycleDay = log.cycleDay ?? published?.cycleDay ?? null;
  const stage = date !== today && log.signalContext ? log.signalContext.lifeStage : profile?.lifeStage;
  const lifeStage: MovementLifeStage = stage === 'cycling' || stage === 'perimenopause' || stage === 'postmenopause' ? stage : null;
  const signalContext: MovementSignalSnapshot = {
    ...calculateMovementSplit({
      current: { date, rmssd: log.rmssd, hrvSource: log.hrvSource, cyclePhase },
      history, lifeStage, readinessScore: log.readinessScore, rest: rest ? {
        alcoholConsumed: rest.alcoholConsumed, nightSweats: rest.nightSweats,
        nightWakings: rest.nightWakings === '0' || rest.nightWakings === '1-2' || rest.nightWakings === '3+'
          ? rest.nightWakings : null,
      } : null,
    }),
    lifeStage, cycleDay, cyclePhase,
  };
  const rhythmColour = signalContext.rhythm.rhythmColour;
  const movementColour = signalContext.movement.movementColour;
  if (isDeepStrictEqual(log.signalContext, signalContext)
      && log.rhythmColour === rhythmColour && log.movementColour === movementColour
      && log.movementInstrumentVersion === signalContext.instrumentVersion) return log;
  return storage.upsertMovementMorning({
    userId, date, readinessScore: log.readinessScore, cycleDay, cyclePhase,
    rhythmColour, movementColour, movementInstrumentVersion: signalContext.instrumentVersion, signalContext,
  });
}
