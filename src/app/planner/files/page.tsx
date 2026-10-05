import Files from "@/app/admin/files/page";
import { PlannerHeading } from "@/components/planner/common";
export default async function PlannerFiles() {
  return (
    <>
      <PlannerHeading
        number="04"
        title="รูปและไฟล์"
        description="คลังไฟล์ร่วมกับ MEMORY · เลือกแนบให้แต่ละชิ้นงานได้"
      />
      <Files />
    </>
  );
}
