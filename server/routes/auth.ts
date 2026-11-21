// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { insertGlobalStateSchema, insertUserProfileSchema, users } from "@shared/schema";
import { getStorage } from "./shared";
import { db } from "../db";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express) {
  // Auth routes
  app.get('/api/auth/user', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const user = await storageInstance.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user profile as well
      const profile = await storageInstance.getUserProfile(userId);

      res.json({ ...user, profile });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.get('/api/user/profile', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const profile = await storageInstance.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/user/profile', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const profileData = insertUserProfileSchema.parse({ ...req.body, userId });

      // Check if profile exists
      const existing = await storageInstance.getUserProfile(userId);
      let profile;

      if (existing) {
        profile = await storageInstance.updateUserProfile(userId, profileData);
      } else {
        profile = await storageInstance.createUserProfile(profileData);
      }

      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Life stage update — writes to users.lifeStage (gates night sweats field, tags data for brokerage layer)
  app.patch('/api/user/life-stage', requireOwner, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { lifeStage } = req.body;
      const valid = ['cycling', 'perimenopause', 'postmenopause'];
      if (!valid.includes(lifeStage)) {
        return res.status(400).json({ message: 'Invalid life stage value' });
      }
      await db.update(users).set({ lifeStage }).where(eq(users.id, userId));
      res.json({ success: true, lifeStage });
    } catch (error) {
      console.error('Error updating life stage:', error);
      res.status(500).json({ message: 'Failed to update life stage' });
    }
  });

  // Global state routes
  app.get('/api/global-state/:cardType', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { cardType } = req.params;

      const state = await storageInstance.getGlobalState(userId, cardType);
      res.json(state?.stateData || {});
    } catch (error) {
      console.error("Error fetching global state:", error);
      res.status(500).json({ message: "Failed to fetch global state" });
    }
  });

  app.put('/api/global-state/:cardType', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const userId = req.user.claims.sub;
      const { cardType } = req.params;

      const stateData = insertGlobalStateSchema.parse({
        userId,
        cardType,
        stateData: req.body
      });

      const state = await storageInstance.upsertGlobalState(stateData);
      res.json(state);
    } catch (error) {
      console.error("Error updating global state:", error);
      res.status(500).json({ message: "Failed to update global state" });
    }
  });
}
