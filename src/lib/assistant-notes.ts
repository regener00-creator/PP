import "server-only";
import { adminNotebooks } from "./admin-notebooks";
import type { ManagedAssistantNote } from "./assistant-notes-types";

export async function adminAssistantNotes(): Promise<ManagedAssistantNote[]> {
  return (await adminNotebooks()).notes;
}
