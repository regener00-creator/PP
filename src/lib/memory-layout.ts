import { z } from "zod";

export const memoryColors = [
  { value: "green", label: "เขียว" },
  { value: "yellow", label: "เหลือง" },
  { value: "red", label: "แดง" },
  { value: "blue", label: "ฟ้า" },
] as const;
export type MemoryColor = typeof memoryColors[number]["value"];
export const memoryLayoutInput = z.array(z.object({
  id: z.uuid(), card_color: z.enum(["green", "yellow", "red", "blue"]).nullable(),
}).strict()).min(1).max(200).refine(items => new Set(items.map(item => item.id)).size === items.length);

export function moveMemory<T extends { id: string }>(items: T[], id: string, target: number): T[] {
  const from = items.findIndex(item => item.id === id);
  if (from < 0 || target < 0 || target >= items.length || from === target) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(target, 0, item);
  return result;
}
