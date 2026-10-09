// One-time user-authorized operation. Never part of npm build or a public route.
import { pathToFileURL } from "node:url";

const GROUP = "C1f3fc9a298ed97a230bbb1b4145bbb15";
const PROJECT = "prj_bzMPDuGQnEgjqSL3LGrPYqs2AI3c";

export async function leaveTestGroup({ token, fetcher = fetch }) {
  if (!token) throw new Error("LINE token unavailable");
  const url = `https://api.line.me/v2/bot/group/${GROUP}`;
  const options = () => ({
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
    cache: "no-store",
  });
  let left, check;
  try {
    left = await fetcher(`${url}/leave`, { ...options(), method: "POST" });
    if (left.status !== 200 && left.status !== 404)
      throw new Error("LINE leave rejected");
    check = await fetcher(`${url}/summary`, { ...options(), method: "GET" });
  } catch {
    throw new Error("LINE group operation failed");
  }
  if (check.status !== 404) throw new Error("LINE group absence not verified");
  return { leftStatus: left.status, summaryStatus: check.status };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== "--leave-test-group" ||
        process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production" ||
        (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID !== PROJECT))
      throw new Error("Authorized Vercel production operation required");
    console.log(JSON.stringify({ code: "PP_TEST_GROUP_LEFT", ...await leaveTestGroup({
      token: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    }) }));
  } catch {
    console.error(JSON.stringify({ code: "PP_TEST_GROUP_LEAVE_FAILED" }));
    process.exitCode = 1;
  }
}
