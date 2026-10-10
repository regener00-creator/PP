import {beforeEach,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),from:vi.fn(),valid:vi.fn(),write:vi.fn()}));
vi.mock("../src/lib/auth",()=>({requireAdmin:m.auth}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("../src/lib/db",()=>({database:()=>({from:m.from}),dbError:(e:unknown)=>{if(e)throw Error("db");}}));
vi.mock("../src/lib/library",async original=>({...await original<typeof import("../src/lib/library")>(),validateAttachments:m.valid}));
import {saveCalendarEvent} from "../src/app/admin/workspace-actions";
const empty={ok:false,message:""};
const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({title:"นัดตัดขน",event_date:"2026-10-12",message:"ตัดขน",reminder_time:"13:00",send_owner:"on",remind_day:"on"})) f.set(k,v);return f;};
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({id:"admin"});m.valid.mockResolvedValue(true);m.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:()=>q,single:()=>q,insert:(data:unknown)=>{m.write(data);return q;},update:(data:unknown)=>{m.write(data);return q;},then:(resolve:(r:unknown)=>void)=>resolve({error:null,data:table==="owner"?{line_user_id:"U"+"a".repeat(32)}:null})};return q;});});
it("persists explicit time for a new event and its later edit",async()=>{const f=form();expect((await saveCalendarEvent(empty,f)).ok).toBe(true);expect(m.write).toHaveBeenLastCalledWith(expect.objectContaining({reminder_time:"13:00",enabled:true}));f.set("id",crypto.randomUUID());f.set("reminder_time","23:59");expect((await saveCalendarEvent(empty,f)).ok).toBe(true);expect(m.write).toHaveBeenLastCalledWith(expect.objectContaining({reminder_time:"23:59"}));});
it("rejects invalid times before touching recipient or event records",async()=>{for(const time of ['24:00','12:99','13:00:00']){const f=form();f.set('reminder_time',time);expect((await saveCalendarEvent(empty,f)).ok).toBe(false);}expect(m.from).not.toHaveBeenCalled();});
it("retains 08:00 compatibility for an older form without the new field",async()=>{const f=form();f.delete('reminder_time');expect((await saveCalendarEvent(empty,f)).ok).toBe(true);expect(m.write).toHaveBeenLastCalledWith(expect.objectContaining({reminder_time:'08:00'}));});
it("starts independent checks together but never writes before all recipient and attachment checks pass",async()=>{
 const pending:Record<string,(data:unknown)=>void>={};
 m.from.mockImplementation((table:string)=>{
   const q={select:()=>q,eq:()=>q,single:()=>q,maybeSingle:()=>q,insert:m.write,
     then:(resolve:(r:unknown)=>void)=>new Promise<void>(done=>{pending[table]=data=>{resolve({data,error:null});done();};})};
   return q;
 });
 let completeAttachments:(value:boolean)=>void=()=>{};
 m.valid.mockImplementation(()=>new Promise<boolean>(resolve=>{completeAttachments=resolve;}));
 const f=form();f.set('group_id','C'+'a'.repeat(32));f.set('mention_user_id','U'+'b'.repeat(32));
 const result=saveCalendarEvent(empty,f);
 await vi.waitFor(()=>expect(Object.keys(pending).sort()).toEqual(['friends','owner','permissions']));
 expect(m.valid).toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();
 pending.permissions({enabled:true});pending.owner({line_user_id:'U'+'a'.repeat(32)});pending.friends({blocked:true});completeAttachments(true);
 expect((await result).ok).toBe(false);expect(m.write).not.toHaveBeenCalled();
});
