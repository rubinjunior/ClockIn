"use client";

import { useActionState, useEffect, useRef } from "react";
import { Archive, Plus, Tags } from "lucide-react";
import { archiveWorkCategory, saveWorkCategory, type CategoryActionState } from "@/actions/category-actions";
import { he } from "@/lib/i18n/he";

const initialState: CategoryActionState = {};

export function WorkCategoriesSettings({ categories, autoOpen }: { categories: Array<{ id: string; name: string; is_active: boolean }>; autoOpen: boolean }) {
  const [state, action, pending] = useActionState(saveWorkCategory, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const active = categories.filter((category) => category.is_active);

  return (
    <div id="work-categories" className="scroll-mt-6 border-t border-[var(--border-soft)] pt-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Tags aria-hidden size={20} /></span>
        <div><h3 className="font-extrabold">{he.categories.title}</h3><p className="muted text-sm">{he.categories.description}</p></div>
      </div>
      <p className="muted mb-3 text-sm">{he.categories.countedOnce}</p>
      {active.length ? (
        <ul className="mb-4 grid gap-2" aria-label={he.categories.active}>
          {active.map((category) => (
            <li key={category.id} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-[var(--background)] px-3 py-2">
              <span className="font-bold">{category.name}</span>
              <form action={archiveWorkCategory}>
                <input type="hidden" name="id" value={category.id} />
                <button type="submit" className="grid size-11 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--error-soft)] hover:text-[var(--error)]" aria-label={he.categories.archive + ": " + category.name}>
                  <Archive aria-hidden size={18} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : <p className="muted mb-4 rounded-2xl bg-[var(--background)] p-4 text-sm">{he.categories.empty}</p>}
      <details open={autoOpen} className="rounded-2xl border border-[var(--border-soft)] p-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-[var(--primary)]"><Plus aria-hidden size={18} />{he.categories.add}</summary>
        <form ref={formRef} action={action} className="mt-3 grid gap-3">
          <div className="field">
            <label htmlFor="category-name">{he.categories.newName}</label>
            <input ref={inputRef} id="category-name" className="input" name="name" maxLength={40} placeholder={he.categories.example} required />
          </div>
          {state.message && <p role={state.ok ? "status" : "alert"} className={"rounded-xl p-3 text-sm " + (state.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--error-soft)] text-[var(--error)]")}>{state.message}</p>}
          <button className="button-primary" disabled={pending}>{pending ? he.entries.saving : he.categories.save}</button>
        </form>
      </details>
    </div>
  );
}