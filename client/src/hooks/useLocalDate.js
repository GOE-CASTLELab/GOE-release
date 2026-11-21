import { useEffect, useState } from 'react';

export const localDateInTimeZone = (timeZone, now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone });

export const mondayOfLocalWeek = (localDate) => {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
};

export function useLocalDate(timeZone, refreshKey) {
  const [, setLocalDate] = useState(() => localDateInTimeZone(timeZone));

  useEffect(() => {
    const update = () => setLocalDate(localDateInTimeZone(timeZone));
    update();
    const interval = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [timeZone, refreshKey]);

  return localDateInTimeZone(timeZone);
}
