import { readContributionConfig } from "./contributionConfig";
import { loadContributionState } from "./contributionState";
import { sendContributionOnce } from "./contributionService";
import type { ContributionDataSource } from "./contributionProjection";

export async function runContributionScheduleCheck(
  source: ContributionDataSource,
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<"disabled" | "awaiting_first_send" | "not_due" | "sent" | "failed"> {
  const config = readContributionConfig(env);
  if (!config.enabled || config.schedule !== "biweekly") return "disabled";
  const state = loadContributionState(env);
  if (!state.lastAcceptedAt) return "awaiting_first_send";
  const dueAt = new Date(state.lastAcceptedAt).getTime() + 14 * 24 * 60 * 60 * 1000;
  if (now.getTime() < dueAt) return "not_due";
  const result = await sendContributionOnce(source, userId, env, fetcher);
  return result.body.accepted === true ? "sent" : "failed";
}

export function startContributionScheduler(source: ContributionDataSource, userId: string | undefined): void {
  if (!userId) return;
  const check = () => runContributionScheduleCheck(source, userId).catch((error) =>
    console.error("Contribution schedule check failed:", error instanceof Error ? error.message : String(error)),
  );
  const initial = setTimeout(check, 60_000);
  initial.unref();
  const recurring = setInterval(check, 6 * 60 * 60 * 1000);
  recurring.unref();
}
