// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

let activeRefresh: Promise<boolean> | null = null;

function configuredScriptPath(): string | null {
  if (process.env.AGENT_FEED_REFRESH !== 'on') return null;
  return process.env.AGENT_FEED_REFRESH_SCRIPT
    || path.resolve(process.cwd(), 'setup/agent-feed/run-feed.sh');
}

async function runRefresh(scriptPath: string): Promise<boolean> {
  try {
    await access(scriptPath);
  } catch {
    // An agent feed is optional for an open-loop instance. No configured script
    // means the card save remains valid and no external file is touched.
    return false;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: process.env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve(true);
      else reject(new Error(`agent feed refresh exited ${code}: ${stderr.trim()}`));
    });
  });
}

// Serialises overlapping saves so each successful response can await one complete,
// atomic rewrite before the person's next agent turn.
export function refreshAgentFeedAfterSave(): Promise<boolean> {
  const scriptPath = configuredScriptPath();
  if (!scriptPath) return Promise.resolve(false);
  const refresh = (activeRefresh || Promise.resolve(false)).catch(() => false)
    .then(() => runRefresh(scriptPath));
  activeRefresh = refresh;
  void refresh.finally(() => { if (activeRefresh === refresh) activeRefresh = null; }).catch(() => {});
  return refresh;
}

export async function refreshAgentFeedWithoutBreakingSave(): Promise<boolean> {
  try {
    return await refreshAgentFeedAfterSave();
  } catch (error) {
    console.warn('[agent-feed] saved card data but failed to refresh USER.md:', error);
    return false;
  }
}
