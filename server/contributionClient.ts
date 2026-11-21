// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.

import type { ContributionEnvelope } from "@shared/contributionContract";

export type BrokerageResponse = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

export async function fetchContributionAuthorization(
  endpoint: string,
  credential: string,
  fetcher: typeof fetch = fetch,
): Promise<BrokerageResponse> {
  const url = new URL("/api/contributions/authorization", endpoint);
  try {
    const response = await fetcher(url, {
      headers: { authorization: `Bearer ${credential}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok && body.ok === true, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: { reason: "The brokerage authorization service could not be reached." } };
  }
}

export async function submitContribution(
  endpoint: string,
  credential: string,
  envelope: ContributionEnvelope,
  fetcher: typeof fetch = fetch,
): Promise<BrokerageResponse> {
  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, status: 0, body: { reason: "The brokerage service could not be reached." } };
  }
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: response.ok && body.accepted === true, status: response.status, body };
}
