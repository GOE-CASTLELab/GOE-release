// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { Calendar } from 'lucide-react';
import IntelligenceCardHeader from '@/components/IntelligenceCardHeader';
import { moonCentresEnabled } from '@/lib/moonCentres';

const CyclicalHeader = ({ onCoreModulesInfo }) => (
  <IntelligenceCardHeader
    title="Female Cyclical Intelligence"
    subtitle={moonCentresEnabled ? "Life Phase Transition • Cycle Tracking • Kundalini Moon Centres" : "Life Phase Transition • Cycle Tracking"}
    description="For tracking and understanding your natural patterns"
    icon={Calendar}
    gradient="from-rose-400 to-rose-600"
    tagColor="pink"
    useCases={['Wellness Tracking', 'Fertility Planning', 'Hormone Coaching', 'Therapy Support']}
    coreModules={[
      { label: 'Cycle Phase Tracking',          color: 'pink'   },
      { label: 'Life Phase Transitions',        color: 'rose'   },
      ...(moonCentresEnabled ? [{ label: 'Kundalini Moon Centre Mapping', color: 'indigo' }] : []),
      { label: 'Hormonal Pattern Intelligence', color: 'purple' },
    ]}
    worksWithItems={['Health Apps', 'Wellness Platforms', 'Clinical Services', 'Fertility Centres']}
    onCoreModulesInfo={onCoreModulesInfo}
  />
);

export default CyclicalHeader;
