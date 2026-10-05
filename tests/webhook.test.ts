import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/bot", () => ({ processEvent: vi.fn() }));
vi.mock("../src/lib/friend-discovery", () => ({ discoverGroupFriends: vi.fn() }));
vi.mock("../src/lib/learning",()=>({captureLearningEvent:vi.fn(),runLearning:vi.fn()}));
vi.mock("next/server",()=>({after:vi.fn()}));
import { discoverGroupFriends } from "../src/lib/friend-discovery";
import {captureLearningEvent} from "../src/lib/learning";
import {after} from "next/server";
import { processEvent } from "../src/lib/bot";
import { POST } from "../src/app/api/line/webhook/route";
const destination = `U${"a".repeat(32)}`;
function request(body: string, signed = true) {
  return new Request("http://localhost/api/line/webhook", { method: "POST", body, headers: signed ? { "x-line-signature": createHmac("sha256", "test-secret").update(body).digest("base64") } : {} });
}
describe("webhook HTTP contract", () => {
  beforeEach(() => { process.env.LINE_CHANNEL_SECRET = "test-secret"; vi.mocked(processEvent).mockReset(); vi.mocked(discoverGroupFriends).mockReset();vi.mocked(captureLearningEvent).mockReset();vi.mocked(after).mockReset(); });
  it("supports LINE verification with empty events", async () => expect((await POST(request(JSON.stringify({ destination, events: [] })))).status).toBe(200));
  it("rejects unsigned requests before processing", async () => { expect((await POST(request("{}", false))).status).toBe(401); expect(processEvent).not.toHaveBeenCalled(); expect(discoverGroupFriends).not.toHaveBeenCalled(); });
  it("rejects malformed signed JSON", async () => expect((await POST(request("{"))).status).toBe(400));
  it("queues one bounded learning run only after verified text capture",async()=>{
    await POST(request("{}",false));expect(captureLearningEvent).not.toHaveBeenCalled();expect(after).not.toHaveBeenCalled();
    vi.mocked(captureLearningEvent).mockResolvedValue(true);
    expect((await POST(request(JSON.stringify({destination,events:[{},{}]})))).status).toBe(200);
    expect(after).toHaveBeenCalledTimes(1);
  });
  it("asks LINE to redeliver failures while processing other events", async () => {
    vi.mocked(processEvent).mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce();
    expect((await POST(request(JSON.stringify({ destination, events: [{}, {}] })))).status).toBe(503);
    expect(processEvent).toHaveBeenCalledTimes(2);
  });
  it("bounds request body even without content-length", async () => expect((await POST(request("x".repeat(1024 * 1024 + 1)))).status).toBe(413));
  it("passes verified events to directory discovery without bypassing reply rules", async () => {
    const event = { type: "message", message: { type: "sticker", id: "1" } };
    expect((await POST(request(JSON.stringify({ destination, events: [event] })))).status).toBe(200);
    expect(discoverGroupFriends).toHaveBeenCalledWith(event, destination);
    expect(processEvent).toHaveBeenCalledWith(event, destination);
  });
  it("awaits discovery even if replying has already failed", async () => {
    let done!: () => void;
    vi.mocked(discoverGroupFriends).mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    vi.mocked(processEvent).mockRejectedValue(new Error("temporary"));
    let returned = false;
    const response = POST(request(JSON.stringify({ destination, events: [{}] }))).then(value => { returned = true; return value; });
    await vi.waitFor(() => expect(discoverGroupFriends).toHaveBeenCalled());
    expect(returned).toBe(false); done(); expect((await response).status).toBe(503);
  });
});
