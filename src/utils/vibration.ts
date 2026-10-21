export function vibrate(pattern: number | number[]) {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration API error:', e);
    }
  }
}

export const VIBRATION_PATTERNS = {
  SHORT_CLICK: 30,
  WARNING: [100, 50, 100],
  ADDITION_ALERT: [200, 100, 200, 100, 400],
  STAGE_COMPLETE: [400, 150, 400, 150, 600],
};
