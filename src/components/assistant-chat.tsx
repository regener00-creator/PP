"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import {
  chatWithAssistant,
  confirmChat,
  cancelChat,
} from "@/app/admin/chat/actions";
import type { AssistantReply } from "@/lib/assistant-types";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: AssistantReply["pending"];
};
const examples = [
  "จำว่า ฉันชอบกาแฟไม่หวาน",
  "เตือนฉันพรุ่งนี้เรื่องจ่ายค่าไฟ",
  "มีนัดอะไรบ้าง",
  "ช่วยคิดเมนูมื้อเย็นหน่อย",
];
export function AssistantChat({
  group,
  initial,
}: {
  group: string | null;
  initial: Message[];
}) {
  const [messages, setMessages] = useState(initial),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  const [busy, startTransition] = useTransition(),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);
  function append(
    reply: AssistantReply,
    clearPending = !!reply.pending || !!reply.saved,
  ) {
    setMessages((old) => [
      ...old.map((m) => (clearPending ? { ...m, pending: undefined } : m)),
      { id: crypto.randomUUID(), role: "assistant", ...reply },
    ]);
  }
  function submit(question: string) {
    if (!question.trim() || busy) return;
    setText("");
    setError("");
    const requestId = crypto.randomUUID();
    setMessages((old) => [
      ...old,
      { id: requestId, role: "user", text: question },
    ]);
    startTransition(async () => {
      try {
        append(await chatWithAssistant({ question, requestId, group }));
      } catch {
        setText(question);
        setError("ยังส่งไม่สำเร็จ ลองอีกครั้งครับ");
      }
    });
  }
  return (
    <section className="assistant-chat panel" aria-label="คุยกับเลขา">
      {!messages.length && (
        <div className="chat-welcome">
          <span className="chat-avatar" aria-hidden="true">
            จ
          </span>
          <h2>น้องโจอาอยู่ตรงนี้ครับ</h2>
          <p>ฝากจำ ถามเรื่องที่เคยบอก นัดหมาย หรือคุยกันได้เลย</p>
          <div className="chat-examples">
            {examples.map((e) => (
              <button
                key={e}
                className="secondary"
                disabled={busy}
                onClick={() => setText(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="chat-messages"
        role="log"
        aria-label="บทสนทนา"
        aria-live="polite"
      >
        {messages.map((m) => (
          <article key={m.id} className={`chat-message chat-${m.role}`}>
            <span>{m.role === "user" ? "คุณ" : "น้องโจอา"}</span>
            <p>{m.text}</p>
            {m.pending && (
              <div className="chat-confirm">
                <button
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        append(await confirmChat(m.pending!.id, group));
                      } catch {
                        setError("ยืนยันไม่สำเร็จ ลองใหม่ครับ");
                      }
                    })
                  }
                >
                  ยืนยันบันทึก
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await cancelChat(m.pending!.id, group);
                        append({ text: "ยกเลิกรายการแล้วครับ" }, true);
                      } catch {
                        setError("ยกเลิกไม่สำเร็จ ลองใหม่ครับ");
                      }
                    })
                  }
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </article>
        ))}
        {busy && (
          <p role="status" className="muted">
            น้องโจอากำลังตอบ…
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label className="sr-only" htmlFor="chat-message">
          ข้อความถึงเลขา
        </label>
        <textarea
          id="chat-message"
          maxLength={2000}
          rows={2}
          placeholder="วันนี้ให้ช่วยอะไรดี…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit(text);
            }
          }}
        />
        <button disabled={busy || !text.trim()} type="submit">
          ส่ง
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="chat-footnote">
        Enter เพื่อส่ง · Shift + Enter ขึ้นบรรทัดใหม่ · ตรวจสรุปก่อนยืนยันบันทึก
      </p>
    </section>
  );
}
