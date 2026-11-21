export const normalizeStaticChartResponse = (value) => {
  if (!value || typeof value !== 'object' || typeof value.message === 'string') return null;
  return value;
};

export const STAR_PEARL_ROLES = [
  'brand', 'creativity', 'pearl', 'culture', 'stability', 'vocation', 'relating',
];

export const starPearlCardId = (role) => `star-pearl-${role}`;
