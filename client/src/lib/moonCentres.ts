// Optional personal moon-centre practice. Forks start with this switched off.
// This is a build-time flag; rebuild after changing it in the root .env.
export const moonCentresEnabled = import.meta.env?.VITE_MOON_CENTRES_ENABLED === 'true';
