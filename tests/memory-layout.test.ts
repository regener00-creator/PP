import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("../src/lib/auth",()=>({requireAdmin:vi.fn()}));
vi.mock("../src/lib/db",()=>({database:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { requireAdmin } from "../src/lib/auth";
import { database } from "../src/lib/db";
import { revalidatePath } from "next/cache";
import { saveMemoryLayout } from "../src/app/admin/memory-layout-actions";
const id="00000000-0000-4000-8000-000000000001";
describe("memory presentation write boundary",()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue(undefined as never);});
  it("requires admin before validation or DB access",async()=>{
    vi.mocked(requireAdmin).mockRejectedValue(new Error("unauthorized"));
    await expect(saveMemoryLayout([])).rejects.toThrow("unauthorized");expect(database).not.toHaveBeenCalled();
  });
  it.each([[],[{id,card_color:"purple"}],[{id,card_color:null},{id,card_color:"blue"}],[{id,card_color:"red",visibility:"shareable"}],[{id:"invalid",card_color:"green"}]].map(input=>[input]))("rejects malformed or over-scoped writes",async input=>{
    expect((await saveMemoryLayout(input)).ok).toBe(false);expect(database).not.toHaveBeenCalled();
  });
  it("sends only ordered IDs and colours to a single atomic transaction",async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null});vi.mocked(database).mockReturnValue({rpc} as never);
    const input=[{id,card_color:"green"}];expect((await saveMemoryLayout(input)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("pp_save_memory_layout",{p_items:input});expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });
  it("does not report success on a stale or failed write",async()=>{
    const rpc=vi.fn().mockResolvedValue({error:{message:"PP_STALE_LAYOUT"}});vi.mocked(database).mockReturnValue({rpc} as never);
    expect((await saveMemoryLayout([{id,card_color:null}])).ok).toBe(false);expect(revalidatePath).not.toHaveBeenCalled();
  });
});
