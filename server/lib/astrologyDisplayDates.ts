/** Format event timestamps using the instance's timezone database, not a visitor's browser. */
export function withAstrologyDisplayDates(rows: any[], timeZone: string): any[] {
  const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone });
  const long = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone });
  return rows.map((row) => {
    const movement = row.retrogradeMovement;
    const values = [row.signEntry, row.signExit, row.retrogradeStart, row.retrogradeEnd,
      row.signMovement?.nextSignAt, movement?.crossingAt, movement?.directAt, movement?.nextSignAt,
      row.windowStart, row.windowEnd, row.exactAt, ...(row.exactDates || [])];
    const displayDates: Record<string, { short: string; long: string }> = {};
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) continue;
      displayDates[value] = { short: short.format(date), long: long.format(date) };
    }
    return { ...row, displayTimeZone: timeZone, displayDates };
  });
}
