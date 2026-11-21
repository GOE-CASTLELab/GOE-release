import assert from 'node:assert/strict';
import { shouldRunAutomaticAstrologyRefresh } from '../server/lib/astrologyRefreshGate';

assert.equal(
  shouldRunAutomaticAstrologyRefresh({ NODE_ENV: 'production' }),
  true,
  'personal production instances refresh by default',
);
assert.equal(
  shouldRunAutomaticAstrologyRefresh({
    NODE_ENV: 'production',
    ASTROAPP_REFRESH_ENABLED: 'false',
  }),
  false,
  'an explicit false disables recurring paid calls in production',
);
assert.equal(
  shouldRunAutomaticAstrologyRefresh({ NODE_ENV: 'development' }),
  false,
  'development never runs the recurring refresh',
);

console.log('astrology refresh gate tests passed');
