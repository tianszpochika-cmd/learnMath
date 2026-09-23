export interface LocalDraft { value: string; baseRevision: number; updatedAt: number }

export function draftKey(userId: string | null, attemptId: string, seq: number): string | null {
  if (!userId || !/^[a-zA-Z0-9-]{1,80}$/.test(userId) || !/^[a-zA-Z0-9-]{1,80}$/.test(attemptId) || !Number.isSafeInteger(seq) || seq < 1) return null;
  return `lm.draft:${userId}:${attemptId}:${seq}`;
}

export function parseLocalDraft(value: string | null): LocalDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as Partial<LocalDraft>;
    return typeof draft.value === "string" && Number.isSafeInteger(draft.baseRevision) && typeof draft.updatedAt === "number" && Number.isFinite(draft.updatedAt)
      ? { value: draft.value, baseRevision: draft.baseRevision!, updatedAt: draft.updatedAt }
      : null;
  } catch { return null; }
}

export function draftRecovery(serverValue: string, serverRevision: number, local: LocalDraft | null, active: boolean): "none" | "restore" | "compare" | "copy-only" {
  if (!local || local.value === serverValue) return "none";
  if (!active) return "copy-only";
  return local.baseRevision === serverRevision ? "restore" : "compare";
}
