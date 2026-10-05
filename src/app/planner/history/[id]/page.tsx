import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireAdmin} from "@/lib/auth";
import {database,dbError} from "@/lib/db";
import type {Generation} from "@/lib/planner-types";
import {PlannerHeading} from "@/components/planner/common";
export default async function GenerationHistory({params}:{params:Promise<{id:string}>}){await requireAdmin();const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const r=await database().from("content_generations").select("*").eq("id",id).maybeSingle();dbError(r.error);if(!r.data)notFound();const g=r.data as Generation;
 return <><PlannerHeading number="01" title="ประวัติการช่วยคิด" description={g.request.brief.topic}/><p>{new Date(g.created_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})} · {g.engine==="ai"?"Gemini":"สูตรสำเร็จ"}</p>{g.status!=="complete"?<div className="planner-panel"><p>{g.status==="pending"?"คำขอนี้ยังไม่มีผลลัพธ์ที่บันทึกสำเร็จ":"คำขอนี้ไม่สำเร็จ สามารถสร้างรอบใหม่ได้"}</p></div>:g.result?.draft?<section className="planner-panel">{Object.entries({caption:"Caption",script:"สคริปต์",shots:"Shot list",hashtags:"Hashtag",visual:"แนวทางภาพ"}).map(([key,label])=><div key={key}><h2>{label}</h2><p style={{whiteSpace:"pre-wrap"}}>{g.result!.draft![key as keyof typeof g.result.draft]}</p></div>)}</section>:<Link className="button" href={`/planner?generation=${g.id}`}>เปิดชุดไอเดียนี้</Link>}<p className="planner-hint">ประวัตินี้เก็บร่างตอนที่สร้างไว้ การแก้ชิ้นงานภายหลังไม่เปลี่ยนร่างนี้</p><Link className="button secondary" href="/planner">กลับไปช่วยคิดคอนเทนต์</Link></>;
}
