// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
import { Moon } from 'lucide-react';
import IntelligenceCardHeader from '@/components/IntelligenceCardHeader';

const RestHeader = () => (
  <IntelligenceCardHeader
    title="Rest & Restore Intelligence"
    subtitle="Nervous System + Cyclical Rest"
    description="Sleep intelligence that honours your natural rhythms — bridging ancient wisdom with nervous system science."
    icon={Moon}
    gradient="from-indigo-400 to-indigo-600"
    tagColor="blue"
    useCases={["Sleep Coaches", "Wellness Platforms", "Retreat Websites", "Meditation Centers"]}
    coreModules={[
      { label: 'Nervous System Protocol' },
      { label: 'Cyclical Rest' },
      { label: 'Life Stage Adaptation' },
      { label: 'Moon Phase Integration' },
    ]}
    worksWithItems={["Cyclical Intelligence", "Movement Intelligence", "Astrology Intelligence"]}
  />
);

export default RestHeader;
