"use client";

import { useState, type ReactNode } from "react";
import {
  Accessibility,
  Bell,
  BriefcaseBusiness,
  CalendarHeart,
  CalendarRange,
  ChevronLeft,
  Coins,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { he } from "@/lib/i18n/he";

export type SettingsSectionId =
  | "schedule"
  | "leave"
  | "reminders"
  | "compensation"
  | "exceptions"
  | "profile"
  | "accessibility";

export type SettingsSection = {
  id: SettingsSectionId;
  title: string;
  description: string;
  summary: string;
  content: ReactNode;
};

const icons: Record<SettingsSectionId, LucideIcon> = {
  schedule: BriefcaseBusiness,
  leave: CalendarHeart,
  reminders: Bell,
  compensation: Coins,
  exceptions: CalendarRange,
  profile: UserRound,
  accessibility: Accessibility,
};

export function SettingsHub({
  sections,
  initialSection,
}: {
  sections: SettingsSection[];
  initialSection: SettingsSectionId;
}) {
  const [activeId, setActiveId] = useState(initialSection);
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  if (!active) return null;
  const ActiveIcon = icons[active.id];

  function chooseSection(id: SettingsSectionId) {
    setActiveId(id);
    window.history.replaceState(null, "", `/app/settings?section=${id}`);
    window.requestAnimationFrame(() => {
      document.getElementById("active-settings-section")?.focus({ preventScroll: true });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav className="card p-3" aria-label={he.settings.chooseSection}>
        <p className="px-2 pb-2 text-sm font-bold text-[var(--text-secondary)]">
          {he.settings.chooseSection}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {sections.map((section) => {
            const Icon = icons[section.id];
            const selected = section.id === active.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => chooseSection(section.id)}
                aria-pressed={selected}
                className={
                  "group flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2 text-start transition-colors " +
                  (selected
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "bg-[var(--background)] text-[var(--text-primary)] hover:bg-[var(--primary-soft)]")
                }
              >
                <span
                  className={
                    "grid size-10 shrink-0 place-items-center rounded-xl " +
                    (selected
                      ? "bg-white/15 text-white"
                      : "bg-[var(--surface)] text-[var(--primary)]")
                  }
                >
                  <Icon aria-hidden size={20} />
                </span>
                <span className="min-w-0">
                  <b className="block leading-tight">{section.title}</b>
                  <small
                    className={
                      "mt-1 hidden truncate text-xs sm:block lg:block " +
                      (selected ? "text-white/80" : "text-[var(--text-secondary)]")
                    }
                  >
                    {section.summary}
                  </small>
                </span>
                <ChevronLeft
                  aria-hidden
                  size={18}
                  className="ms-auto hidden shrink-0 lg:block"
                />
              </button>
            );
          })}
        </div>
      </nav>

      <section
        id="active-settings-section"
        tabIndex={-1}
        aria-labelledby={`settings-title-${active.id}`}
        className="card grid min-w-0 gap-5 p-5 outline-none sm:p-6"
      >
        <header className="flex items-start gap-3 border-b border-[var(--border-soft)] pb-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <ActiveIcon aria-hidden />
          </span>
          <div>
            <h2 id={`settings-title-${active.id}`} className="text-xl font-extrabold">
              {active.title}
            </h2>
            <p className="muted text-sm">{active.description}</p>
          </div>
        </header>
        {active.content}
      </section>
    </div>
  );
}
