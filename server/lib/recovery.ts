// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

// Did the rest submission record the inputs recovery quality is derived from?
// Displayers gate on this so an empty submission is never stated as high recovery.
export function hasRecoveryInputs(restSubmission: any): boolean {
  if (!restSubmission) return false;
  return restSubmission.nightSweats != null
    || restSubmission.alcoholConsumed != null
    || (restSubmission.nightWakings != null && restSubmission.nightWakings !== '');
}

// The movement algorithm degrades gracefully: no rest data adds no downgrade.
export function getRecoveryQuality(restSubmission: any): 'high' | 'medium' | 'low' {
  if (!restSubmission) return 'high';
  let flagCount = 0;
  if (restSubmission.nightSweats) flagCount++;
  if (restSubmission.alcoholConsumed) flagCount++;
  if (restSubmission.nightWakings && restSubmission.nightWakings !== '0') flagCount++;
  if (flagCount === 0) return 'high';
  if (flagCount === 1) return 'medium';
  return 'low';
}
