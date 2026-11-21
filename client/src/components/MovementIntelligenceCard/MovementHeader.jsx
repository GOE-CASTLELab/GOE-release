// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { Activity } from 'lucide-react';
import IntelligenceCardHeader from '@/components/IntelligenceCardHeader';

const MovementHeader = () => (
  <IntelligenceCardHeader
    title="Movement Intelligence"
    subtitle="Movement • Body Intelligence • Energy Patterns"
    description="For tracking and understanding your body's natural movement rhythms"
    icon={Activity}
    gradient="from-amber-400 to-orange-500"
    tagColor="amber"
    useCases={['Movement Coaches', 'Somatic Practitioners', 'Physiotherapists', 'Yoga Studios']}
    coreModules={[
      { label: 'HRV / RMSSD Movement Signal', color: 'amber'  },
      { label: 'Recovery Quality',          color: 'orange' },
      { label: 'Cycle Phase Awareness',     color: 'pink'   },
      { label: 'Life Stage Adaptation',     color: 'gray'   },
    ]}
    worksWithItems={['Training Platforms', 'Health Data APIs', 'Wearable Integrations', 'Recovery Systems']}
  />
);

export default MovementHeader;
