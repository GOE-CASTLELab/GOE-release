// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { RequestHandler } from "express";

const ownerId = process.env.OWNER_ID || process.env.OWNER_DID;

export const OWNER_ID = ownerId;

export const requireOwner: RequestHandler = (req, _res, next) => {
  if (!ownerId) {
    throw new Error(
      "OWNER_ID is not set. A single-owner GOE instance requires OWNER_ID in the environment."
    );
  }
  (req as any).user = { claims: { sub: ownerId } };
  next();
};
