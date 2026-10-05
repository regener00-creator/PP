import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),generate:vi.fn()}));
vi.mock("../src/lib/db",()=>({database:()=>({rpc:mocks.rpc}),dbError:(error:unknown)=>{if(error)throw Error("DB");}}));
vi.mock("ai",()=>({generateText:mocks.generate,Output:{object:(value:unknown)=>value}}));
vi.mock("../src/lib/google-model",()=>({googleModel:()=>"model"}));
import {captureLearningEvent,runLearning,learningPrompt,validatedSuggestions} from "../src/lib/learning";
import {learningReview} from "../src/lib/learning-policy";
const sender=`U${"a".repeat(32)}`,destination=`U${"b".repeat(32)}`,group=`C${"c".repeat(32)}`;
const runId="00000000-0000-4000-8000-000000000001";
const event={type:"message",webhookEventId:"event",timestamp:Date.now(),source:{type:"group",groupId:group,userId:sender},message:{type:"text",id:"m1",text:"เราชอบกาแฟ"}};
const messages=[{event_id:"event",message_id:"m1",sender_id:sender,text:"เราชอบกาแฟ",sent_at:new Date().toISOString(),name:"ฟิ้ง"}];
const item={speaker:"p0",category:"preference",title:"กาแฟ",content:"ฟิ้งชอบกาแฟ",questions:["ฟิ้งชอบอะไร"],evidence:[0]};
describe("learning capture and generation boundaries",()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("AI_ENABLED","true");vi.stubEnv("GOOGLE_VERTEX_API_KEY","test");
    mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="pp_claim_learning"?{reason:"claimed",run_id:runId,group_id:group,messages}:name==="pp_finish_learning"?1:true}));
    mocks.generate.mockResolvedValue({output:{suggestions:[item]},usage:{inputTokens:200,outputTokens:100}});
  });afterEach(()=>vi.unstubAllEnvs());
  it("passes signed group text to consent-gated storage without calling AI inline",async()=>{
    expect(await captureLearningEvent(event,destination)).toBe(true);expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("pp_capture_learning",expect.objectContaining({p_group:group,p_sender:sender,p_text:"เราชอบกาแฟ"}));
  });
  it.each([
    {...event,source:{type:"user",userId:sender}}, {...event,mode:"standby"},
    {...event,message:{type:"image",id:"m1"}}, {...event,source:{type:"group",groupId:group,userId:destination}},
    {...event,message:{...event.message,text:"เงินเดือน 50000"}}, {...event,message:{...event.message,text:"โทร 0812345678"}},
    {...event,message:{...event.message,text:"private ข้อมูล"}}, {...event,message:{...event.message,text:"x".repeat(501)}}
  ])("never captures DM, non-text, sensitive, oversized or bot messages",async input=>{
    expect(await captureLearningEvent(input,destination)).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("honors unsend even when AI is switched off",async()=>{
    vi.stubEnv("AI_ENABLED","false");await captureLearningEvent(event,destination);expect(mocks.rpc).not.toHaveBeenCalled();
    await captureLearningEvent({type:"unsend",source:event.source,unsend:{messageId:"m1"}},destination);
    expect(mocks.rpc).toHaveBeenCalledWith("pp_unsend_learning",{p_group:group,p_message:"m1"});
  });
  it("sends opaque speaker IDs, never LINE IDs, and persists only draft suggestions with verified sources",async()=>{
    expect((await runLearning()).ok).toBe(true);
    const options=mocks.generate.mock.calls[0][0];expect(options.prompt).not.toContain(sender);expect(options.prompt).not.toContain(group);expect(options.prompt).not.toContain("m1");
    expect(options).toMatchObject({maxRetries:0,maxOutputTokens:1000,experimental_telemetry:{isEnabled:false}});
    const finish=mocks.rpc.mock.calls.find(c=>c[0]==="pp_finish_learning")![1];
    expect(finish).toMatchObject({p_run:runId,p_input:200,p_output:100,p_failed:false,p_items:[{sender_id:sender,source_message_ids:["m1"]}]});
    expect(JSON.stringify(finish)).not.toContain('"approved"');
  });
  it.each(["waiting","limit","empty"])("does not call AI when the database says %s",async reason=>{
    mocks.rpc.mockResolvedValue({error:null,data:{reason}});await runLearning();expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("never accepts invented IDs, cross-person evidence, unsafe facts or questions for a different person",()=>{
    for(const bad of [{...item,speaker:"p99"},{...item,evidence:[99]},{...item,content:"เงินเดือน 10000"},{...item,questions:["ปีโป้ชอบอะไร"]},{...item,category:"communication_style"}]){
      expect(validatedSuggestions({suggestions:[bad]},messages,[sender])).toEqual([]);
    }
    expect(validatedSuggestions({suggestions:[item]},messages,[destination])).toEqual([]);
  });
  it("blocks oversized prompts rather than sending unbounded history",()=>{
    expect(()=>learningPrompt(Array(20).fill({...messages[0],text:"ก".repeat(500)}))).toThrow("Learning prompt too large");
  });
  it("filters sensitive input again before provider access",async()=>{
    mocks.rpc.mockResolvedValueOnce({error:null,data:{reason:"claimed",run_id:runId,group_id:group,messages:[{...messages[0],text:"รหัสผ่าน abc"}]}});
    await runLearning();expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("pp_finish_learning",expect.objectContaining({p_input:0,p_output:0,p_items:[]}));
  });
  it("does not expose or persist provider exception details and reserves failure cost conservatively",async()=>{
    mocks.generate.mockRejectedValue(new Error("SECRET_CANARY"));const result=await runLearning();expect(JSON.stringify(result)).not.toContain("SECRET_CANARY");
    expect(mocks.rpc).toHaveBeenCalledWith("pp_finish_learning",expect.objectContaining({p_failed:true,p_input:10000,p_output:1000}));
  });
  it("validates reviewed content independently from model output",()=>{
    expect(learningReview.safeParse({id:runId,title:"กาแฟ",content:"private data",questions:["ฟิ้งชอบอะไร"]}).success).toBe(false);
  });
});
