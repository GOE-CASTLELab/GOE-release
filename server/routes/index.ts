// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { createServer, type Server } from "http";
import { config } from "../config";

import { registerAuthRoutes } from "./auth";
import { registerChatRoutes } from "./chat";
import { registerCycleRoutes } from "./cycle";
import { registerAstrologyRoutes } from "./astrology";
import { registerRestRoutes } from "./rest";
import { registerPracticesRoutes } from "./practices";
import { registerMovementRoutes } from "./movement";
import { registerContributionRoutes } from "./contributions";
import { registerReturnPatternRoutes } from "./returnPattern";
import { validateChatDeliveryConfig } from "../chatDelivery";

export async function registerRoutes(app: Express): Promise<Server> {
  // Single-owner instance: no login flow. The owner did is the identity;
  // per-route requireOwner installs it as req.user.claims.sub.

  // Domain route registration — each card owns its own routes
  registerAuthRoutes(app);
  if (config.isChatEnabled) {
    validateChatDeliveryConfig();
    registerChatRoutes(app);
  } else {
    app.all('/api/chat/:cardType', (_req, res) => res.status(404).json({ error: 'Not found' }));
  }
  registerCycleRoutes(app);
  registerAstrologyRoutes(app);
  registerRestRoutes(app);
  registerPracticesRoutes(app);
  registerMovementRoutes(app);
  registerContributionRoutes(app);
  registerReturnPatternRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
