// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { Star } from 'lucide-react';
import IntelligenceCardHeader from '@/components/IntelligenceCardHeader';

const AstrologyHeader = ({ onCoreModulesInfo }) => (
  <IntelligenceCardHeader
    title="Astrological Forecast Intelligence"
    subtitle="Birth Chart Analysis • Gene Keys & Human Design Guidance"
    description="For understanding your cosmic blueprint and aligned timing"
    icon={Star}
    gradient="from-purple-400 to-purple-600"
    tagColor="indigo"
    useCases={['Astrology Readings', 'Life Coaching', 'Spiritual Guidance', 'Timing Consultations']}
    coreModules={[
      { label: 'Natal Chart Analysis',        color: 'purple' },
      { label: 'Current Sky / Daily Transits', color: 'indigo' },
      { label: 'Planetary Day Intelligence',   color: 'blue'   },
      { label: 'Powered by AstroApp',          color: 'indigo', href: 'https://astroapp.com' },
    ]}
    worksWithItems={['Astrology Apps', 'Spiritual Platforms', 'Coaching Websites', 'Wellness Centers']}
    onCoreModulesInfo={onCoreModulesInfo}
  />
);

export default AstrologyHeader;
