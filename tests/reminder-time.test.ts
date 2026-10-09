import { describe,it,expect } from "vitest";
import { timedDueDates,type CalendarEvent } from "../src/lib/calendar";
const event:CalendarEvent={id:"test",title:"test",event_date:"2026-10-10",reminder_time:"13:00",annual:false,message:"test",enabled:true,remind_day:true,remind_before:true,send_owner:true,group_id:null,mention_user_id:null,attachment_ids:[]};
describe("chosen Bangkok reminder time",()=>{
 it("never sends early; catches a delayed tick for up to ten minutes",()=>{
  expect(timedDueDates(event,new Date("2026-10-10T05:59:59Z"))).toEqual([]);
  for(const instant of ["06:00:00","06:00:59","06:09:59"]) expect(timedDueDates(event,new Date("2026-10-10T"+instant+"Z"))).toEqual([{lead:0,occurs:"2026-10-10"}]);
  expect(timedDueDates(event,new Date("2026-10-10T06:10:00Z"))).toEqual([]);
 });
 it("uses the same time on the prior day and honors each toggle",()=>{
  expect(timedDueDates(event,new Date("2026-10-09T06:00:00Z"))).toEqual([{lead:1,occurs:"2026-10-10"}]);
  expect(timedDueDates({...event,remind_before:false},new Date("2026-10-09T06:00:00Z"))).toEqual([]);
  expect(timedDueDates({...event,enabled:false},new Date("2026-10-10T06:00:00Z"))).toEqual([]);
 });
 it("handles midnight and a previous date's 23:59 reminder without duplicates",()=>{
  expect(timedDueDates({...event,reminder_time:"23:59"},new Date("2026-10-10T17:01:00Z"))).toEqual([{lead:0,occurs:"2026-10-10"}]);
  expect(timedDueDates({...event,reminder_time:"00:00"},new Date("2026-10-09T17:00:00Z"))).toEqual([{lead:0,occurs:"2026-10-10"}]);
 });
 it("handles yearly leap days and default 08:00 without interpreting message text",()=>{
  expect(timedDueDates({...event,event_date:"2024-02-29",annual:true},new Date("2028-02-28T06:00:00Z"))).toEqual([{lead:1,occurs:"2028-02-29"}]);
  expect(timedDueDates({...event,event_date:"2024-02-29",annual:true},new Date("2027-02-28T06:00:00Z"))).toEqual([]);
  expect(timedDueDates({...event,...{reminder_time:undefined,message:"13:00"}},new Date("2026-10-10T01:00:00Z"))).toEqual([{lead:0,occurs:"2026-10-10"}]);
 });
});
