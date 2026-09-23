import { describe, expect, it } from "vitest";
import { clearUserDrafts } from "./auth";

describe("logout draft cleanup", () => {
  it("removes only current user's unsynced draft keys", () => {
    const values = new Map([
      ["lm.draft:7:attempt-1:1", "answer"],
      ["lm.draft:7:attempt-1:2", "answer"],
      ["lm.draft:8:attempt-2:1", "other user"],
      ["other-project:data", "preserve"]
    ]);
    const storage = {
      get length() { return values.size; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      removeItem(key: string) { values.delete(key); }
    };
    clearUserDrafts(storage, "7");
    expect([...values.keys()]).toEqual(["lm.draft:8:attempt-2:1", "other-project:data"]);
  });
});
