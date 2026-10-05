export type AssistedMemory = {
  id: string; title: string; content: string; answer_variants?: string[]; question_examples: string[]; revision: string;
  attachment_ids: string[]; mention_owner: boolean; expires_at: string | null;
};
export type MemoryConcern = { memory: AssistedMemory; kind: "duplicate" | "related" | "conflict"; reason: string };
export type MemoryReviewState = { ok: boolean; message: string; savedId?: string; receipt?: string; concerns?: MemoryConcern[]; unchecked?: boolean };
export type MemoryIssue = { id: string; kind: string; reason: string; left: AssistedMemory; right: AssistedMemory };
