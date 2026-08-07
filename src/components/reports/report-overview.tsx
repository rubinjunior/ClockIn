import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  Gauge,
  ListChecks,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { formatMinutes } from "@/lib/formatting";
import { he } from "@/lib/i18n/he";
import { buildReportAnalytics, type ReportWeek } from "@/lib/reports/analytics";

type ReportAnalytics = ReturnType<typeof buildReportAnalytics>;

export type CompositionItem = {
  key: string;
  label: string;
  minutes: number;
  days: number;
  href: string;
};

function reportHref(month: string, params: Record<string, string>) {
  const query = new URLSearchParams({ month, view: "list", ...params });
  return "?" + query.toString();
}

function weekState(week: ReportWeek) {
  if (week.status === "current") return { label: he.report.weekCurrent, className: "bg-[var(--primary-soft)] text-[var(--primary)]" };
  if (week.status === "future") return { label: he.report.weekFuture, className: "bg-[var(--surface-muted)] text-[var(--text-secondary)]" };
  return { label: he.report.weekCompleted, className: "bg-[var(--success-soft)] text-[var(--success)]" };
}

export function ReportOverview({
  analytics,
  month,
  composition,
}: {
  analytics: ReportAnalytics;
  month: string;
  composition: CompositionItem[];
}) {
  const positive = analytics.balanceToDateMinutes >= 0;

  return (
    <div className="grid gap-6">
      <section className="card overflow-hidden p-5 sm:p-6" aria-labelledby="report-dashboard-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--primary)]">{he.report.reportDashboard}</p>
            <h2 id="report-dashboard-title" className="mt-1 text-xl font-extrabold">{he.report.balanceToDate}</h2>
            <p className="muted mt-1 text-sm">{he.report.positionSubtitle}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${positive ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
            {positive ? he.report.onTrack : he.report.behindTarget}
          </span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_repeat(4,1fr)]">
          <div className={`rounded-3xl p-5 ${positive ? "bg-[var(--success-soft)]" : "bg-[var(--warning-soft)]"}`}>
            <p className="text-sm font-bold">{he.report.balanceToDate}</p>
            <p className={`metric-value mt-2 text-4xl font-extrabold ${positive ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{formatMinutes(analytics.balanceToDateMinutes)}</p>
            <p className="muted mt-2 text-xs">{he.report.worked}: {formatMinutes(analytics.workedToDateMinutes)}</p>
          </div>
          <Metric icon={BriefcaseBusiness} label={he.report.worked} value={formatMinutes(analytics.workedToDateMinutes)} />
          <Metric icon={Target} label={he.report.targetToDateLabel} value={formatMinutes(analytics.targetToDateMinutes)} />
          <Metric icon={Gauge} label={he.report.monthlyTarget} value={formatMinutes(analytics.fullTargetMinutes)} />
          <Metric icon={CalendarClock} label={he.report.daysRemaining} value={String(analytics.remainingWorkdays)} detail={he.report.workdaysUnit} />
        </div>

        <div className="mt-4 grid gap-3 rounded-3xl border border-[var(--border-soft)] bg-[var(--background)]/70 p-4 sm:grid-cols-3">
          <Metric compact icon={TrendingUp} label={he.report.dailyAverageNeeded} value={analytics.remainingWorkdays > 0 ? formatMinutes(analytics.requiredDailyAverageMinutes) : "—"} detail={analytics.remainingWorkdays > 0 ? he.report.forecastTitle : he.report.monthAlreadyComplete} />
          <Metric compact icon={BriefcaseBusiness} label={he.report.remainingWork} value={formatMinutes(analytics.remainingRequiredMinutes)} />
          <Metric compact icon={CalendarCheck2} label={he.report.projectedBalance} value={analytics.projectedBalanceMinutes == null ? "—" : formatMinutes(analytics.projectedBalanceMinutes)} detail={analytics.projectedBalanceMinutes == null ? he.report.projectionUnavailable : undefined} />
        </div>

      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="weekly-summary-title">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><ListChecks aria-hidden /></span>
          <div><h2 id="weekly-summary-title" className="text-xl font-extrabold">{he.report.weeklySummary}</h2><p className="muted mt-1 text-sm">{he.report.weeklyDescription}</p></div>
        </div>
        <div className="mt-5 grid gap-3 md:hidden">
          {analytics.weeks.map((week) => <WeekCard key={week.key} week={week} href={reportHref(month, { week: week.key })} />)}
        </div>
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-[var(--border-soft)] md:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--primary-soft)] text-[var(--primary)]"><tr><th className="p-3 text-start">{he.report.week}</th><th className="p-3 text-center">{he.report.presence}</th><th className="p-3 text-center">{he.report.target}</th><th className="p-3 text-center">{he.report.difference}</th><th className="p-3 text-center">{he.report.status}</th></tr></thead>
            <tbody>{analytics.weeks.map((week) => {
              const state = weekState(week);
              return <tr key={week.key} className="border-t border-[var(--border-soft)]">
                <td className="p-0"><Link className="block min-h-12 p-3 font-bold text-[var(--primary)]" href={reportHref(month, { week: week.key })}>{he.report.week} {week.number}</Link></td>
                <td className="p-3 text-center"><MinuteValue minutes={week.workedMinutes + week.creditedMinutes} /></td>
                <td className="p-3 text-center"><MinuteValue minutes={week.expectedMinutes} /></td>
                <td className="p-3 text-center font-bold"><MinuteValue minutes={week.balanceMinutes} /></td>
                <td className="p-3 text-center"><span className={`rounded-full px-3 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>


      <section aria-labelledby="composition-title">
        <div className="mb-3"><h2 id="composition-title" className="text-xl font-extrabold">{he.report.compositionTitle}</h2><p className="muted mt-1 text-sm">{he.report.compositionDescription}</p></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {composition.map((item) => {
            const percentage = analytics.workedToDateMinutes > 0 ? Math.round(item.minutes / analytics.workedToDateMinutes * 100) : 0;
            return <Link key={item.key} href={item.href} className="card interactive-card min-w-0 p-4">
              <div className="mb-4 grid size-10 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><BriefcaseBusiness aria-hidden size={20} /></div>
              <p className="truncate text-sm font-bold">{item.label}</p>
              <p className="metric-value mt-1 text-xl font-extrabold">{formatMinutes(item.minutes)}</p>
              <p className="muted mt-1 text-xs">{item.days} {he.report.daysUnit} · {percentage}% {he.report.shareOfWork}</p>
            </Link>;
          })}
          <Link href="/app/settings?newCategory=1#work-categories" aria-label={he.report.addCategoryCard} className="grid min-h-[132px] place-items-center rounded-3xl border-2 border-dashed border-[var(--border-soft)] text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"><Plus aria-hidden size={32} /></Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, compact = false }: { icon: typeof Gauge; label: string; value: string; detail?: string; compact?: boolean }) {
  return <div className={`min-w-0 ${compact ? "flex items-center gap-3" : "rounded-3xl border border-[var(--border-soft)] bg-white p-4"}`}>
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] ${compact ? "size-10" : "mb-3 size-10"}`}><Icon aria-hidden size={20} /></span>
    <span className="min-w-0"><span className="muted block text-xs">{label}</span><strong className="metric-value mt-0.5 block text-lg">{value}</strong>{detail && <span className="muted block text-xs">{detail}</span>}</span>
  </div>;
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div><dt className="muted text-xs">{label}</dt><dd className="metric-value mt-1 font-bold">{value}</dd></div>;
}

function WeekCard({ week, href }: { week: ReportWeek; href: string }) {
  const state = weekState(week);
  return <Link href={href} className="rounded-2xl border border-[var(--border-soft)] p-4">
    <div className="flex items-center justify-between gap-3"><strong>{he.report.week} {week.number}</strong><span className={`rounded-full px-3 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></div>
    <dl className="mt-3 grid grid-cols-3 gap-2 text-center"><Definition label={he.report.presence} value={formatMinutes(week.workedMinutes + week.creditedMinutes)} /><Definition label={he.report.target} value={formatMinutes(week.expectedMinutes)} /><Definition label={he.report.difference} value={formatMinutes(week.balanceMinutes)} /></dl>
  </Link>;
}

function MinuteValue({ minutes }: { minutes: number }) {
  return <span className="metric-value inline-flex min-w-[6.5ch] justify-center text-center" dir="ltr">{formatMinutes(minutes)}</span>;
}
