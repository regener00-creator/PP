import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {addDays,thaiDate,dueDates,occursOn,type CalendarEvent} from "../src/lib/calendar";
import {prepareUpload,MAX_FILE_BYTES} from "../src/lib/uploads";
const event:CalendarEvent={id:"id",title:"birthday",message:"HBD",event_date:"2026-01-01",annual:true,enabled:true,remind_day:true,remind_before:true,send_owner:true,group_id:null,mention_user_id:null,attachment_ids:[]};
describe("Bangkok calendar boundaries",()=>{
  it("switches dates at Thai midnight, not UTC midnight",()=>{expect(thaiDate(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");expect(thaiDate(new Date("2026-12-31T16:59:59Z"))).toBe("2026-12-31");});
  it("handles annual reminders across years and before the first occurrence",()=>{expect(dueDates(event,"2026-12-31")).toEqual([{lead:1,occurs:"2027-01-01"}]);expect(dueDates(event,"2027-01-01")).toEqual([{lead:0,occurs:"2027-01-01"}]);expect(dueDates(event,"2025-01-01")).toEqual([]);expect(dueDates({...event,enabled:false},"2027-01-01")).toEqual([]);});
  it("keeps one-time dates and February 29 precise",()=>{expect(occursOn({...event,annual:false},"2027-01-01")).toBe(false);expect(addDays("2028-02-28",1)).toBe("2028-02-29");expect(dueDates({...event,event_date:"2024-02-29"},"2027-02-28")).toEqual([]);expect(dueDates({...event,event_date:"2024-02-29"},"2028-02-28")).toEqual([{lead:1,occurs:"2028-02-29"}]);});
});
describe("file upload normalization",()=>{
  it("rejects empty, oversized, active content and forged document types",async()=>{
    for(const f of [new File([],"empty.txt"),new File([new Uint8Array(MAX_FILE_BYTES+1)],"big.txt"),new File(["<svg/>"],"image.svg"),new File(["<html/>"],"page.html"),new File(["bad"],"doc.pdf"),new File(["bad"],"doc.docx"),new File(["bad"],"photo.png")])await expect(prepareUpload(f)).rejects.toThrow();
  });
  it("decodes and reencodes images for LINE, removing metadata",async()=>{
    const source=await sharp({create:{width:1800,height:900,channels:3,background:"red"}}).png().withMetadata().toBuffer();
    const result=await prepareUpload(new File([new Uint8Array(source)],"photo.png"));const meta=await sharp(result.data).metadata();
    expect(result.name).toBe("photo.jpg");expect(result.mime).toBe("image/jpeg");expect(result.data.length).toBeLessThan(1000000);expect(meta.width).toBe(1200);expect(meta.exif).toBeUndefined();
  });
  it("keeps document bytes and neutralizes path/control characters in names",async()=>{
    const result=await prepareUpload(new File(["sample"],"../canary\n.txt"));expect(result.data.toString()).toBe("sample");expect(result.name).not.toMatch(/[\/\n]/);expect(result.mime).toBe("text/plain");
  });
});
