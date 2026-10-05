"use client";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
export function PlannerDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useLayoutEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="pp-dialog pp-dialog-wide planner-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <small>CONTENT PLANNER</small>
          <h2 id={id}>{title}</h2>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          ปิด
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function PlannerHeading({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="planner-heading">
      <div>
        <span className="eyebrow">CONTENT PLANNER / {number}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="planner-empty">
      <span className="empty-line" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
