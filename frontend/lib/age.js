export const MONTHS = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];

// month 1-12; counted from the end of the birth month, so nobody passes too early
export function ageFrom(year, month, now = new Date()) {
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  return Math.floor((months - 1) / 12);
}
