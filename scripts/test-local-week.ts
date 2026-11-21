import assert from 'node:assert/strict';
import { mondayOfLocalWeek as serverWeek } from '../server/lib/userDate';
import { localDateInTimeZone, mondayOfLocalWeek as clientWeek } from '../client/src/hooks/useLocalDate.js';

for (const [date, monday] of [
  ['2026-10-04', '2026-09-28'],
  ['2026-10-05', '2026-10-05'],
  ['2027-01-01', '2026-12-28'],
  ['2027-01-04', '2027-01-04'],
]) {
  assert.equal(serverWeek(date), monday);
  assert.equal(clientWeek(date), monday);
}

for (const instant of ['2026-10-05T04:30:00Z', '2027-03-15T05:30:00Z']) {
  const now = new Date(instant);
  assert.equal(clientWeek(localDateInTimeZone('America/Edmonton', now)), serverWeek(
    now.toLocaleDateString('en-CA', { timeZone: 'America/Edmonton' }),
  ));
}

assert.equal(localDateInTimeZone('America/Edmonton', new Date('2026-10-05T04:30:00Z')), '2026-10-04');
assert.equal(localDateInTimeZone('Europe/London', new Date('2026-10-05T04:30:00Z')), '2026-10-05');
assert.equal(clientWeek(localDateInTimeZone('America/Edmonton', new Date('2026-10-05T04:30:00Z'))), '2026-09-28');
assert.equal(clientWeek(localDateInTimeZone('Europe/London', new Date('2026-10-05T04:30:00Z'))), '2026-10-05');

console.log('Local daily and weekly date boundaries pass.');
