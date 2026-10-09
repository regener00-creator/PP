import "server-only";
// Compatibility only: no cron, database access or LINE sends after retirement.
export async function sendContentReminders(_now = new Date()) { return { sent: 0, retired: true }; }
