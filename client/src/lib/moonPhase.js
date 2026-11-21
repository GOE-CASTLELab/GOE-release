// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { NextMoonQuarter, SearchMoonQuarter } from 'astronomy-engine';
import { getMoonPhase } from '@shared/moonPhase';

const localDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
};

const localCalendarDay = (date, timeZone) => {
  const { year, month, day } = localDateParts(date, timeZone);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

export { getMoonPhase };

export const getNextMajorMoonPhase = (date = new Date()) => {
  let quarter = SearchMoonQuarter(date);
  while (quarter.quarter !== 0 && quarter.quarter !== 2) {
    quarter = NextMoonQuarter(quarter);
  }

  return {
    name: quarter.quarter === 0 ? 'New Moon' : 'Full Moon',
    date: quarter.time.date,
  };
};

export const getDaysToNextPhase = (date = new Date(), timeZone) => {
  const displayTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const next = getNextMajorMoonPhase(date);
  const days = localCalendarDay(next.date, displayTimeZone) - localCalendarDay(date, displayTimeZone);

  if (days === 0) return `${next.name} today`;
  if (days === 1) return `${next.name} tomorrow`;
  return `${next.name} in ${days} days`;
};
