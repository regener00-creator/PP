"use client";
import { useState, useTransition } from "react";
import { savePlannerGoals } from "@/app/planner/goal-actions";
import {
  goalDirections,
  type ContentGoal,
  type GoalSettings,
} from "@/lib/planner-goals";
import { PlannerDialog } from "./common";
export function GoalManager({
  settings,
  onSaved,
  onClose,
}: {
  settings: GoalSettings;
  onSaved: (settings: GoalSettings) => void;
  onClose: () => void;
}) {
  const [goals, setGoals] = useState(settings.goals);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, start] = useTransition();
  function change(id: string, patch: Partial<ContentGoal>) {
    setDirty(true);
    setGoals((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }
  function close() {
    if (
      !busy &&
      (!dirty || confirm("ยังไม่ได้บันทึกหัวข้อ ต้องการปิดหรือไม่?"))
    )
      onClose();
  }
  return (
    <PlannerDialog title="จัดการหัวข้อเป้าหมาย" onClose={close}>
      <p className="planner-hint">
        ใช้ร่วมกันทุกแบรนด์ · การแก้ไขมีผลกับการคิดครั้งถัดไป
      </p>
      <form
        className="planner-form"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            try {
              const result = await savePlannerGoals(goals, settings.updated_at);
              setNotice(result.message);
              if (result.ok && result.settings) onSaved(result.settings);
            } catch {
              setNotice("เชื่อมต่อไม่สำเร็จ ลองบันทึกอีกครั้ง");
            }
          });
        }}
      >
        <fieldset disabled={busy} className="planner-goal-list">
          {goals.map((goal, index) => (
            <section
              key={goal.id}
              className="planner-goal-row"
              aria-label={"หัวข้อที่ " + (index + 1)}
            >
              <div className="planner-goal-name">
                <label>
                  ชื่อหัวข้อ
                  <input
                    required
                    maxLength={300}
                    value={goal.label}
                    onChange={(e) => change(goal.id, { label: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={goals.length === 1}
                  onClick={() => {
                    setGoals((rows) =>
                      rows.filter((row) => row.id !== goal.id),
                    );
                    setDirty(true);
                  }}
                >
                  ลบหัวข้อ
                </button>
              </div>
              <details>
                <summary>แนวทางสำหรับโครงสำเร็จฟรี</summary>
                <label>
                  ทิศทางคอนเทนต์
                  <select
                    value={goal.direction}
                    onChange={(e) =>
                      change(goal.id, {
                        direction: e.target.value as ContentGoal["direction"],
                      })
                    }
                  >
                    {Object.entries(goalDirections).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ข้อความชวนให้คนทำต่อ
                  <input
                    maxLength={500}
                    value={goal.cta}
                    placeholder={goalDirections[goal.direction].cta}
                    onChange={(e) => change(goal.id, { cta: e.target.value })}
                  />
                </label>
              </details>
            </section>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={goals.length >= 30}
            onClick={() => {
              setGoals((rows) => [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  label: "",
                  direction: "awareness",
                  cta: "",
                },
              ]);
              setDirty(true);
            }}
          >
            เพิ่มหัวข้อ
          </button>
        </fieldset>
        <div className="planner-form-footer">
          <p role="status">{notice}</p>
          <div>
            <button disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกหัวข้อ"}
            </button>
          </div>
        </div>
      </form>
    </PlannerDialog>
  );
}
