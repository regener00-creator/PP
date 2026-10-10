import "server-only";
import { cache } from "react";
import { requireAdmin } from "./auth";
import { database, dbError } from "./db";
import type { ManagedAssistantNote } from "./assistant-notes-types";
import type { AssistantEvent } from "./assistant-types";
import type { CalendarDelivery } from "./calendar";

type NotebookSnapshot = {
  notes: ManagedAssistantNote[];
  events: AssistantEvent[];
  deliveries: CalendarDelivery[];
};

// Share one permission-filtered snapshot within this render only. Never cache
// notebook contents across requests, users, or permission changes.
export const adminNotebooks = cache(async (): Promise<NotebookSnapshot> => {
  await requireAdmin();
  const result = await database().rpc("pp_admin_notebooks");
  dbError(result.error, "admin:notebooks");
  if (!result.data || !Array.isArray(result.data.notes) || !Array.isArray(result.data.events) || !Array.isArray(result.data.deliveries)) {
    throw new Error("Invalid notebook snapshot");
  }
  return result.data as NotebookSnapshot;
});
