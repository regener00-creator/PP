import "server-only";
// Compatibility exports are deliberately inert, even with AI_ENABLED=true.
// Gemini for manually authored memories and Content Planner remains independent.
export async function captureLearningEvent(
  _input: unknown,
  _destination: string,
): Promise<boolean> {
  return false;
}
export async function runLearning(): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: "นำระบบเรียนรู้จากกลุ่มออกแล้ว" };
}
