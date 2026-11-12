export function newId(): string {
  return crypto.randomUUID();
}

export function meta(now = Date.now()) {
  return { id: newId(), updatedAt: now, deletedAt: null as number | null };
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
