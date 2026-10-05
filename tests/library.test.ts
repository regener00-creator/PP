import {randomUUID} from "node:crypto";
import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("../src/lib/db",()=>({database:vi.fn(),dbError:(e:unknown)=>{if(e)throw Error("db");}}));
vi.mock("../src/lib/auth",()=>({requireAdmin:vi.fn()}));
import {database} from "../src/lib/db";
import {requireAdmin} from "../src/lib/auth";
import {fileMessages,memoryFiles,signFileLink,verifyFileLink,publicFileAllowed,validateAttachments} from "../src/lib/library";
import {GET} from "../src/app/api/files/[id]/route";
import {POST} from "../src/app/api/files/route";
const file=randomUUID(),parent=randomUUID(),owner="U"+"b".repeat(32),group="C"+"c".repeat(32);
let rows:Record<string,unknown>;let selects:string[];
beforeEach(()=>{
  vi.clearAllMocks();process.env.CRON_SECRET="test-".repeat(10);selects=[];
  rows={files:[{id:file,name:"test.jpg",mime:"image/jpeg",visibility:"shareable"}],memories:{attachment_ids:[file],visibility:"shareable",expires_at:null},owner:{line_user_id:owner},permissions:{enabled:true},friends:{blocked:false}};
  vi.mocked(database).mockImplementation(()=>({from:(table:string)=>{
    const q={select:(s:string)=>{selects.push(s);return q;},eq:()=>q,in:()=>q,limit:()=>q,single:()=>q,maybeSingle:()=>q,then:(resolve:(value:unknown)=>void)=>resolve({data:rows[table],error:null})};return q;
  }} as never));
});
describe("attachment privacy",()=>{
  it("restricts planner file links to the chosen enabled group and live attachment",async()=>{
    rows.files={visibility:"shareable"};
    rows.content_items={attachment_ids:[file],archived:false,group_id:group};
    const scope=verifyFileLink(signFileLink({file,parent,kind:"content",group}))!;
    expect(await publicFileAllowed(scope)).toBe(true);
    rows.content_items={attachment_ids:[file],archived:true,group_id:group};expect(await publicFileAllowed(scope)).toBe(false);
    rows.content_items={attachment_ids:[file],archived:false,group_id:"C"+"d".repeat(32)};expect(await publicFileAllowed(scope)).toBe(false);
    rows.content_items={attachment_ids:[],archived:false,group_id:group};expect(await publicFileAllowed(scope)).toBe(false);
    rows.content_items={attachment_ids:[file],archived:false,group_id:null};expect(await publicFileAllowed({...scope,group:null})).toBe(false);
  });
  function files(count:number,visibility="shareable") {
    return Array.from({length:count},(_,i)=>({id:randomUUID(),name:`file-${i}.jpg`,mime:"image/jpeg",visibility}));
  }
  it("accepts ten real attachments but rejects eleven, duplicates and missing files",async()=>{
    const list=files(10);rows.files=list;const ids=list.map(f=>f.id);
    expect(await validateAttachments(ids,"shareable")).toBe(true);
    expect(await validateAttachments([...ids,randomUUID()],"shareable")).toBe(false);
    expect(await validateAttachments([...ids.slice(0,9),ids[0]],"shareable")).toBe(false);
    rows.files=list.slice(0,9);expect(await validateAttachments(ids,"private")).toBe(false);
  });
  it.each([4,5,10])("delivers all %i images in order within LINE's five-message reply limit",async count=>{
    const list=files(count),ids=list.map(f=>f.id);rows.files=[...list].reverse();
    const messages=await fileMessages(ids,{parent,kind:"memory",group,private:false});
    expect(messages.length+1).toBeLessThanOrEqual(5);
    const first=messages[0];
    const urls=first.type==="flex"?first.contents.contents.map(b=>b.hero?.url):messages.map(m=>m.type==="image"?m.originalContentUrl:undefined);
    expect(urls).toHaveLength(count);
    expect(urls.map(url=>new URL(url!).pathname.split("/").pop())).toEqual(ids);
    for(const [i,url] of urls.entries())expect(verifyFileLink(new URL(url!).searchParams.get("key")!)).toMatchObject({file:ids[i],parent,group,kind:"memory"});
    if(count>4){expect(first.type).toBe("flex");expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(50*1024);}
  });
  it("rejects oversized attachment delivery instead of silently dropping files",async()=>{
    await expect(fileMessages(files(11).map(f=>f.id),{parent,kind:"memory",group,private:false})).rejects.toThrow();
    expect(database).not.toHaveBeenCalled();
  });
  it("keeps all ten private files behind owner login with no previews or signed links",async()=>{
    const list=files(10);rows.files=list;
    const messages=await fileMessages(list.map(f=>f.id),{parent,kind:"calendar",group:null,private:true});
    const first=messages[0];expect(first.type).toBe("flex");if(first.type!=="flex")throw Error("Expected gallery");
    expect(first.contents.contents).toHaveLength(10);
    expect(first.contents.contents.every(b=>!b.hero)).toBe(true);
    expect(first.contents.contents.map(b=>b.footer.contents[0].action.uri)).toEqual(list.map(f=>`https://pp-theta-beryl.vercel.app/api/files/${f.id}`));
    expect(JSON.stringify(messages)).not.toContain("?key=");
  });
  it("handles mixed images and documents, excluding deleted and newly private files from groups",async()=>{
    const list=files(10);list[1].mime="application/pdf";list[1].name="document.pdf";list[8].visibility="private";rows.files=list.slice(0,9);
    const messages=await fileMessages(list.map(f=>f.id),{parent,kind:"memory",group,private:false});
    const first=messages[0];expect(first.type).toBe("flex");if(first.type!=="flex")throw Error("Expected gallery");
    expect(first.contents.contents).toHaveLength(8);
    expect(first.contents.contents[0].hero).toBeDefined();expect(first.contents.contents[1].hero).toBeUndefined();
    expect(JSON.stringify(messages)).toContain("document.pdf");
    expect(JSON.stringify(messages)).not.toContain(list[8].id);expect(JSON.stringify(messages)).not.toContain(list[9].id);
    expect(await fileMessages(list.map(f=>f.id),{parent,kind:"memory",group,private:true})).toEqual([]);
  });
  it("rejects modified, expired and invalid signed links",()=>{
    const link=signFileLink({file,parent,kind:"memory",group},1000);expect(verifyFileLink(link,1001)?.file).toBe(file);expect(verifyFileLink(link,86401000)).toBeNull();expect(verifyFileLink(link+"x",1001)).toBeNull();expect(verifyFileLink("invalid",1001)).toBeNull();
  });
  it("private files use an authenticated owner link with no bearer access token",async()=>{
    const messages=await fileMessages([file],{parent,kind:"memory",group:null,private:true});expect(messages[0].type).toBe("template");expect(JSON.stringify(messages)).toContain(`/api/files/${file}`);expect(JSON.stringify(messages)).not.toContain("?key=");
  });
  it("only shareable JPEGs render inline; private files never reach groups",async()=>{
    expect((await fileMessages([file],{parent,kind:"memory",group,private:false}))[0].type).toBe("image");
    rows.files=[{id:file,name:"secret.jpg",mime:"image/jpeg",visibility:"private"}];
    expect(await fileMessages([file],{parent,kind:"memory",group,private:false})).toEqual([]);
    expect(await validateAttachments([file],"shareable")).toBe(false);expect(await validateAttachments([file,file],"private")).toBe(false);
  });
  it("revokes public downloads when the file, memory or group becomes private/disabled",async()=>{
    const scope={file,parent,kind:"memory" as const,group,expires:Date.now()+1000};rows.files={visibility:"shareable"};
    expect(await publicFileAllowed(scope)).toBe(true);rows.files={visibility:"private"};expect(await publicFileAllowed(scope)).toBe(false);
    rows.files={visibility:"shareable"};rows.memories={attachment_ids:[file],visibility:"private"};expect(await publicFileAllowed(scope)).toBe(false);
    rows.memories={attachment_ids:[file],visibility:"shareable"};rows.permissions={enabled:false};expect(await publicFileAllowed(scope)).toBe(false);
  });
  it("shares public attachments in a friend's DM while keeping legacy private files owner-only",async()=>{
    rows.friends=[];
    expect((await memoryFiles(parent,"U"+"f".repeat(32),null))[0].type).toBe("image");
    rows.memories={attachment_ids:[file],visibility:"private"};expect(await memoryFiles(parent,"U"+"f".repeat(32),null)).toEqual([]);
    rows.memories={attachment_ids:[file],visibility:"private"};expect((await memoryFiles(parent,owner,null))[0].type).toBe("template");
    expect(selects.some(s=>s.includes("content"))).toBe(false);
  });
  it("does not expose a private file's name or link to a friend even when attached to a shareable memory",async()=>{
    rows.friends=[];rows.files=[{id:file,name:"PRIVATE_CANARY.jpg",visibility:"private",mime:"image/jpeg"}];
    expect(await memoryFiles(parent,"U"+"f".repeat(32),null)).toEqual([]);
  });
  it("stops direct-chat attachment retrieval for a blocked friend",async()=>{
    rows.friends=[{id:"blocked"}];expect(await memoryFiles(parent,"U"+"f".repeat(32),null)).toEqual([]);
  });
  it("does not retrieve private or expired memory files in a group",async()=>{
    rows.memories={attachment_ids:[file],visibility:"private"};expect(await memoryFiles(parent,owner,group)).toEqual([]);
    rows.memories={attachment_ids:[file],visibility:"shareable",expires_at:"2000-01-01"};expect(await memoryFiles(parent,owner,group)).toEqual([]);
  });
  it("requires login for a tokenless file download before querying data",async()=>{
    vi.mocked(requireAdmin).mockRejectedValueOnce(Error("login"));await expect(GET(new Request(`https://pp.test/api/files/${file}`),{params:Promise.resolve({id:file})})).rejects.toThrow("login");expect(database).not.toHaveBeenCalled();
  });
  it("rejects cross-file token reuse before downloading anything",async()=>{
    const key=signFileLink({file:randomUUID(),parent,kind:"memory",group});const r=await GET(new Request(`https://pp.test/api/files/${file}?key=${key}`),{params:Promise.resolve({id:file})});expect(r.status).toBe(403);expect(database).not.toHaveBeenCalled();
  });
  it("rejects cross-site uploads before authentication or file parsing",async()=>{const r=await POST(new Request("https://pp.test/api/files",{method:"POST",headers:{origin:"https://other.test"}}));expect(r.status).toBe(403);expect(requireAdmin).not.toHaveBeenCalled();});
});
