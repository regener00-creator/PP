import "server-only";
import { database,dbError } from "./db";
import { required } from "./env";
import { dueDates,thaiDate,type CalendarEvent } from "./calendar";
import { ownerInGroup,mentionOwner,type LineMessage } from "./line";
import { fileMessages,validateAttachments } from "./library";
export async function lineJson(path:string) {
  const response=await fetch(`https://api.line.me/v2/bot/${path}`,{headers:{Authorization:`Bearer ${required("LINE_CHANNEL_ACCESS_TOKEN")}`},cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error("LINE unavailable");
  return response.json();
}
export async function quotaStatus():Promise<{limit:number|null;used:number}|null>{
  try{const [quota,used]=await Promise.all([lineJson("message/quota"),lineJson("message/quota/consumption")]);
    if(!Number.isInteger(used.totalUsage) || (quota.type!=="none" && !Number.isInteger(quota.value)))return null;
    return {limit:quota.type==="none"?null:quota.value,used:used.totalUsage};
  }catch{return null;}
}
export async function pushOnce(target:string,messages:LineMessage[],retryKey:string) {
  // LINE deduplicates this persisted UUID even if our process dies after acceptance.
  for(let attempt=0;attempt<2;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,250));
    try{
      const response=await fetch("https://api.line.me/v2/bot/message/push",{method:"POST",headers:{Authorization:`Bearer ${required("LINE_CHANNEL_ACCESS_TOKEN")}`,"Content-Type":"application/json","X-Line-Retry-Key":retryKey},body:JSON.stringify({to:target,messages}),signal:AbortSignal.timeout(5000)});
      if(response.ok || (response.status===409 && response.headers.has("x-line-accepted-request-id")))return "sent" as const;
      if(response.status<500)return response.status===429?"quota_or_rate_limit":"line_rejected";
    }catch{/* Retry same key once; do not log message content or tokens. */}
  }
  return "delivery_error";
}
export async function sendDueReminders(now=new Date()){
  const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",hour:"2-digit",hourCycle:"h23"}).format(now));
  if(hour!==8)return {sent:0,failed:0,skipped:0,outsideWindow:true};
  const db=database(); const owner=await db.from("owner").select("line_user_id").eq("id",1).single();dbError(owner.error);
  const events=await db.from("calendar_events").select("*").eq("enabled",true).order("id").limit(100);dbError(events.error);
  const totals={sent:0,failed:0,skipped:0};
  for(const event of (events.data||[]) as CalendarEvent[]){
    for(const due of dueDates(event,thaiDate(now))){
      const targets=[...(event.send_owner && owner.data?.line_user_id?[owner.data.line_user_id]:[]),...(event.group_id?[event.group_id]:[])];
      for(const target of targets){
        const claim=await db.rpc("pp_claim_reminder",{p_event:event.id,p_occurs:due.occurs,p_lead:due.lead,p_target:target});dbError(claim.error);
        if(!claim.data)continue;
        const delivery=claim.data as {id:string;retry_key:string;attempts:number;payload:LineMessage[]|null;event_revision:string|null};
        let result="delivery_error";
        try{
          const current=await db.from("calendar_events").select("*").eq("id",event.id).maybeSingle();dbError(current.error);
          const e=current.data as CalendarEvent|null;
          const isGroup=target.startsWith("C");
          const stillDue=e && dueDates(e,thaiDate(now)).some(d=>d.occurs===due.occurs && d.lead===due.lead);
          const freshOwner=await db.from("owner").select("line_user_id").eq("id",1).single();dbError(freshOwner.error);
          if(!e || !stillDue || (delivery.payload && Date.parse(delivery.event_revision||"")!==Date.parse(e.updated_at||"")) || (isGroup?e.group_id!==target:!e.send_owner || freshOwner.data?.line_user_id!==target)) result="changed";
          else{
            let allowed=true;
            if(isGroup){const g=await db.from("permissions").select("enabled").eq("group_id",target).maybeSingle();dbError(g.error);allowed=g.data?.enabled===true;}
            if(!allowed)result="group_disabled";
            else{
              const quota=await quotaStatus();
              const count=isGroup?(await lineJson(`group/${target}/members/count`)).count:1;
              if(!quota || !Number.isInteger(count) || count<1) result="quota_unavailable";
              else if(quota.limit!==null && quota.used+count>quota.limit)result="quota_exhausted";
              else if(!await validateAttachments(e.attachment_ids,isGroup?"shareable":"private"))result="changed";
              else{
                const text=`${due.lead?"เตือนล่วงหน้า 1 วัน · ":""}${e.title}\n${e.message}`;
                let message:LineMessage={type:"text",text};
                if(isGroup && e.mention_user_id){
                  const f=await db.from("friends").select("blocked").eq("group_id",target).eq("line_user_id",e.mention_user_id).maybeSingle();dbError(f.error);
                  if(f.data && !f.data.blocked && await ownerInGroup(target,e.mention_user_id,required("LINE_CHANNEL_ACCESS_TOKEN")))message=mentionOwner(e.mention_user_id,text);
                }
                // Persist the exact request before sending. A reclaimed lease reuses
                // identical URLs, text and recipient with the same LINE retry UUID.
                let messages=delivery.payload;
                const oldMention=messages?.some(m=>m.type==="textV2");
                if(oldMention && message.type!=="textV2")result="changed";
                else{
                  if(!messages){
                    const files=await fileMessages(e.attachment_ids,{parent:e.id,kind:"calendar",group:isGroup?target:null,private:!isGroup});
                    const saved=await db.from("reminder_deliveries").update({payload:[message,...files],event_revision:e.updated_at}).eq("id",delivery.id).eq("attempts",delivery.attempts).eq("status","processing").is("payload",null).select("payload").maybeSingle();dbError(saved.error);
                    messages=saved.data?.payload as LineMessage[]|null;
                  }
                  if(messages)result=await pushOnce(target,messages,delivery.retry_key);
                }
              }
            }
          }
        }catch{/* Do not log private calendar content. */}
        const status=result==="sent"?"sent":["changed","group_disabled","quota_exhausted"].includes(result)?"skipped":"failed";
        const updated=await db.from("reminder_deliveries").update({status,reason:result,...(status!=="failed"?{payload:null}:{}),lease_until:new Date(Date.now()-1).toISOString(),updated_at:new Date().toISOString()}).eq("id",delivery.id).eq("attempts",delivery.attempts);dbError(updated.error);
        totals[status]++;
      }
    }
  }
  return totals;
}
