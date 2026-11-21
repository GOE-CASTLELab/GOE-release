// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import type { Express } from "express";
import { requireOwner } from "../ownerGate";
import { getObjectStore } from "../storage/index";
import { getStorage } from "./shared";

export function registerPracticesRoutes(app: Express) {
  app.get('/media/:audioFileName', requireOwner, async (req, res) => {
    const { audioFileName } = req.params;
    if (!audioFileName || audioFileName.includes('/') || audioFileName.includes('\\') || audioFileName.includes('..')) {
      return res.status(400).json({ error: 'Invalid audio file name' });
    }
    const objectStore = await getObjectStore();
    const key = `practices/audio/${audioFileName}`;
    if (!(await objectStore.exists(key))) {
      return res.status(404).json({ error: 'Audio not found' });
    }
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    await objectStore.download(key, res);
  });

  // Union movement endpoint for menstrual cycle card - gets movements from both CL and CE states
  // NOTE: This must come BEFORE the parametric route to avoid matching conflicts
  app.get('/api/practices/union/movement', requireOwner, async (req, res) => {
    try {
      const storageInstance = getStorage(req);
      const { cyclePhase } = req.query;

      if (!cyclePhase) {
        return res.status(400).json({ error: 'cyclePhase parameter is required' });
      }

      // Get movements from both CL and CE states for the cycle phase
      console.log(`UNION API: Fetching movements for the requested cycle phase`);
      const [clResults, ceResults] = await Promise.all([
        storageInstance.getPracticesByCreativeState('CL', 'movement', cyclePhase as string),
        storageInstance.getPracticesByCreativeState('CE', 'movement', cyclePhase as string)
      ]);

      // Defensive defaults to prevent spreading undefined values
      const clMovements = clResults || [];
      const ceMovements = ceResults || [];
      console.log(`UNION API: CL: ${clMovements.length}, CE: ${ceMovements.length} movements found`);

      // Combine and deduplicate by practice name (some practices may exist in both CL and CE)
      const allMovements = [...clMovements, ...ceMovements];
      const uniqueMovements = allMovements.filter((movement, index, array) =>
        array.findIndex(m => m.name === movement.name) === index
      );

      // Extract just the names for the menstrual cycle card UI (maintains compatibility)
      const movementNames = uniqueMovements.map(movement => movement.name);

      res.json({
        success: true,
        movements: movementNames,
        totalAvailable: uniqueMovements.length,
        cyclePhase: cyclePhase,
        details: uniqueMovements
      });
    } catch (error) {
      console.error('Error fetching union movements:', error);
      res.status(500).json({ error: 'Failed to fetch movements' });
    }
  });

  // Practice Lookup API for CL/CE System
  app.get('/api/practices/:creativeState/:practiceType', requireOwner, async (req: any, res) => {
    try {
      const storageInstance = getStorage(req);
      const { creativeState, practiceType } = req.params;
      const { cyclePhase, afterPracticeId } = req.query;

      // Validate parameters
      if (!['CL', 'CE'].includes(creativeState)) {
        return res.status(400).json({ error: 'Creative state must be CL or CE' });
      }

      if (!['meditation', 'movement'].includes(practiceType)) {
        return res.status(400).json({ error: 'Practice type must be meditation or movement' });
      }

      // Get practices based on CL/CE classification
      const practices = await storageInstance.getPracticesByCreativeState(
        creativeState as 'CL' | 'CE',
        practiceType as 'meditation' | 'movement',
        cyclePhase as string
      );

      if (practices.length === 0) {
        return res.json({
          success: true,
          practices: [],
          message: `No ${practiceType} practices found for ${creativeState} state${cyclePhase ? ` in ${cyclePhase} phase` : ''}`
        });
      }

      // Select a practice deterministically based on date and user ID to ensure consistency
      // This prevents meditation from changing throughout the day for the same user
      const { cycleDay } = req.query;
      let practiceIndex;

      if (cycleDay && !isNaN(Number(cycleDay))) {
        // Use cycle day for consistent selection across days
        practiceIndex = (Number(cycleDay) - 1) % practices.length;
      } else {
        // Fallback: Use date + user ID hash for consistency within the same day
        const userId = (req.user as any)?.claims?.sub || 'anonymous';
        const today = new Date().toDateString();
        const seed = userId + today + creativeState;
        const hash = seed.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        practiceIndex = Math.abs(hash) % practices.length;
      }

      if (typeof afterPracticeId === 'string') {
        const currentIndex = practices.findIndex(practice => practice.id === afterPracticeId);
        if (currentIndex >= 0) practiceIndex = (currentIndex + 1) % practices.length;
      }

      const selectedPractice = practices[practiceIndex];

      // Construct audioUrl if missing but audio_file_name exists
      if (!selectedPractice.audioUrl && selectedPractice.audioFileName) {
        selectedPractice.audioUrl = `/media/${encodeURIComponent(selectedPractice.audioFileName)}`;
      }

      res.json({
        success: true,
        practice: selectedPractice,
        totalAvailable: practices.length
      });
    } catch (error) {
      console.error('Error fetching practices:', error);
      res.status(500).json({ error: 'Failed to fetch practices' });
    }
  });
}
