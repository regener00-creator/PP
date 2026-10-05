import {randomUUID} from "node:crypto";
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("../src/lib/db",()=>({database:vi.fn(),dbError:(e:unknown)=>{if(e)throw Error("db");}}));
vi.mock("../src/lib/library",()=>({fileMessages:vi.fn().mockResolvedValue([]),validateAttachments:vi.fn().mockResolvedValue(true)}));
vi.mock("../src/lib/line",async original=>({...await original<typeof import("../src/lib/line")>(),ownerInGroup:vi.fn().mockResolvedValue(true)}));
import {database} from "../src/lib/db";
import {validateAttachments} from "../src/lib/library";
import {pushOnce,sendDueReminders} from "../src/lib/reminders";
const owner="U"+"a".repeat(32),group="C"+"c".repeat(32),now=new Date("2026-10-10T01:30:00Z"),revision="2026-10-01T00:00:00Z";
let event:Record<string,unknown>,current:Record<string,unknown>,delivery:Record<string,unknown>,updates:Record<string,unknown>[],pushes:RequestInit[],used:number,enabled:boolean;
beforeEach(()=>{
  vi.clearAllMocks();process.env.LINE_CHANNEL_ACCESS_TOKEN="test";updates=[];pushes=[];used=0;enabled=true;
  event={id:randomUUID(),title:"birthday",message:"HBD",event_date:"2026-10-10",annual:false,enabled:true,remind_day:true,remind_before:false,send_owner:true,group_id:null,mention_user_id:null,attachment_ids:[],updated_at:revision};current={...event};
  delivery={id:randomUUID(),retry_key:randomUUID(),attempts:1,payload:null,event_revision:null};
  vi.mocked(validateAttachments).mockResolvedValue(true);
  vi.mocked(database).mockImplementation(()=>({rpc:async()=>({data:delivery,error:null}),from:(table:string)=>{
    let data:unknown=table==="owner"?{line_user_id:owner}:table==="permissions"?{enabled}:table==="friends"?{blocked:false}:null;
    const q={select:()=>q,order:()=>q,eq:(key:string)=>{if(table==="calendar_events" && key==="id")data=current;return q;},limit:()=>{data=[event];return q;},single:()=>q,maybeSingle:()=>q,is:()=>q,update:(value:Record<string,unknown>)=>{updates.push(value);data=value;return q;},then:(resolve:(v:unknown)=>void)=>resolve({data,error:null})};return q;
  }} as never));
  vi.stubGlobal("fetch",vi.fn(async(url:string,options:RequestInit)=>{
    if(url.endsWith("/push")){pushes.push(options);return new Response(null,{status:200});}
    return Response.json(url.endsWith("consumption")?{totalUsage:used}:url.endsWith("/count")?{count:10}:{type:"limited",value:300});
  }));
});
afterEach(()=>vi.unstubAllGlobals());
describe("reminder delivery",()=>{
  it("persists the request before sending and marks acceptance",async()=>{
    expect(await sendDueReminders(now)).toEqual({sent:1,failed:0,skipped:0});expect(updates[0].payload).toEqual([{type:"text",text:"birthday\nHBD"}]);expect(pushes).toHaveLength(1);expect(pushes[0].headers).toMatchObject({"X-Line-Retry-Key":delivery.retry_key});expect(updates.at(-1)?.status).toBe("sent");
  });
  it("reuses the persisted payload exactly when a lease is reclaimed",async()=>{
    delivery.payload=[{type:"text",text:"identical saved request"}];delivery.event_revision=revision;delivery.attempts=2;
    await sendDueReminders(now);expect(JSON.parse(String(pushes[0].body)).messages).toEqual(delivery.payload);
  });
  it("cancels a retry if its event was changed or attached sharing was revoked",async()=>{
    delivery.payload=[{type:"text",text:"old"}];delivery.event_revision="2026-09-01";await sendDueReminders(now);expect(pushes).toHaveLength(0);expect(updates.at(-1)?.reason).toBe("changed");
    delivery.payload=null;vi.mocked(validateAttachments).mockResolvedValue(false);await sendDueReminders(now);expect(pushes).toHaveLength(0);
  });
  it("does not send outside the morning window or after disabling a due event",async()=>{
    expect(await sendDueReminders(new Date("2026-10-10T02:00:00Z"))).toMatchObject({outsideWindow:true});expect(database).not.toHaveBeenCalled();current.enabled=false;await sendDueReminders(now);expect(pushes).toHaveLength(0);
  });
  it("checks group approval and recipient-count quota before a group push",async()=>{
    event.send_owner=false;event.group_id=group;current={...event};used=295;
    await sendDueReminders(now);expect(pushes).toHaveLength(0);expect(updates.at(-1)?.reason).toBe("quota_exhausted");
    used=0;enabled=false;await sendDueReminders(now);expect(pushes).toHaveLength(0);expect(updates.at(-1)?.reason).toBe("group_disabled");
  });
  it("treats LINE accepted retry conflicts as success and repeats identical network requests",async()=>{
    const requests:RequestInit[]=[];vi.stubGlobal("fetch",vi.fn(async(_url:string,options:RequestInit)=>{requests.push(options);return requests.length===1?new Response(null,{status:503}):new Response(null,{status:409,headers:{"x-line-accepted-request-id":"accepted"}});}));
    expect(await pushOnce(owner,[{type:"text",text:"test"}],"same-key")).toBe("sent");expect(requests[0].body).toBe(requests[1].body);expect(requests[0].headers).toEqual(requests[1].headers);
  });
  it("does not retry quota exhaustion or unrecognized conflicts",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:429})));expect(await pushOnce(owner,[],"key")).toBe("quota_or_rate_limit");expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockResolvedValue(new Response(null,{status:409}));expect(await pushOnce(owner,[],"key")).toBe("line_rejected");
  });
});
