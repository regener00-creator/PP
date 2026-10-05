import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("../src/lib/auth",()=>({requireAdmin:vi.fn()}));
vi.mock("../src/lib/db",()=>({database:vi.fn()}));
vi.mock("../src/lib/learning",()=>({runLearning:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {requireAdmin} from "../src/lib/auth";
import {database} from "../src/lib/db";
import {runLearning} from "../src/lib/learning";
import {setLearningGroup,setLearningFriend,approveLearning,removeLearning,summarizeLearning} from "../src/app/admin/learning/actions";
const initial={ok:false,message:""};
describe("learning admin authorization",()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockRejectedValue(Error("unauthorized"));});
  it.each([()=>setLearningGroup(initial,new FormData()),()=>setLearningFriend(initial,new FormData()),()=>approveLearning(initial,new FormData()),()=>removeLearning(initial,new FormData()),()=>summarizeLearning()])("requires admin before any data read, mutation or paid call",async action=>{
    await expect(action()).rejects.toThrow("unauthorized");expect(database).not.toHaveBeenCalled();expect(runLearning).not.toHaveBeenCalled();
  });
  it("never allows the submitted form to move a suggestion to another group or person",async()=>{
    vi.mocked(requireAdmin).mockResolvedValue(undefined as never);
    const rpc=vi.fn().mockResolvedValue({data:true,error:null});vi.mocked(database).mockReturnValue({rpc} as never);
    const form=new FormData();Object.entries({id:"00000000-0000-4000-8000-000000000001",title:"กาแฟ",content:"ฟิ้งชอบกาแฟ",questions:"ฟิ้ง ชอบอะไร",group_id:"injected",sender_id:"injected",status:"approved"}).forEach(([k,v])=>form.set(k,v));
    expect((await approveLearning(initial,form)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("pp_review_learning",{p_id:"00000000-0000-4000-8000-000000000001",p_title:"กาแฟ",p_content:"ฟิ้งชอบกาแฟ",p_questions:["ฟิ้ง ชอบอะไร"],p_aliases:["ฟิ้งชอบอะไร"]});
  });
});
