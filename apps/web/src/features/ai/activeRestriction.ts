/** A client-side extra restriction while a server-confirmed attempt is active. */
export function activeAttemptRestricted(storage: Pick<Storage, "getItem">, userId: string | null): boolean {
  if (!userId) return true;
  try {
    const raw = storage.getItem(`lm.web.activeAttempt:${userId}`);
    if (!raw) return false;
    const value = JSON.parse(raw) as Record<string, unknown>;
    return value.restricted === true && typeof value.attemptId === "string" && value.attemptId.length > 0;
  } catch {
    return true;
  }
}
