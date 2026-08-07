import Link from "next/link";
import { AlertTriangle, ArrowLeft, CircleAlert, CircleCheckBig, Info } from "lucide-react";
import { he } from "@/lib/i18n/he";
import { buildReportAnalytics, type ReportAlert } from "@/lib/reports/analytics";

type ReportAnalytics = ReturnType<typeof buildReportAnalytics>;

function reportHref(month: string, params: Record<string, string>) {
  const query = new URLSearchParams({ month, view: "list", ...params });
  return `/app/report?${query.toString()}`;
}

function alertCopy(alert: ReportAlert, analytics: ReportAnalytics, groupCount = 1) {
  if (alert.kind === "incomplete") return [he.report.alertIncompleteTitle, he.report.alertIncompleteDetail];
  if (alert.kind === "missingReport") return [groupCount > 1 ? `${groupCount} ${he.report.alertMissingGroupTitle}` : he.report.alertMissingTitle, he.report.alertMissingDetail];
  if (alert.kind === "leaveWork") return [he.report.alertLeaveWorkTitle, he.report.alertLeaveWorkDetail];
  if (alert.kind === "nonWorkday") return [he.report.alertNonWorkTitle, he.report.alertNonWorkDetail];
  if (alert.kind === "overlap") return [he.report.alertOverlapTitle, he.report.alertOverlapDetail];
  const week = analytics.weeks.find((item) => item.key === alert.weekStart);
  return [`${he.report.week} ${week?.number ?? ""} ${he.report.alertWeekTitle}`, he.report.alertWeekDetail];
}

function AlertIcon({ severity }: { severity: ReportAlert["severity"] }) {
  if (severity === "critical") return <CircleAlert aria-hidden size={20} />;
  if (severity === "warning") return <AlertTriangle aria-hidden size={20} />;
  return <Info aria-hidden size={20} />;
}

function AlertRow({ alert, analytics, month, groupCount = 1 }: { alert: ReportAlert; analytics: ReportAnalytics; month: string; groupCount?: number }) {
  const [title, detail] = alertCopy(alert, analytics, groupCount);
  const href = alert.kind === "missingReport" && groupCount > 1
    ? reportHref(month, { status: "missingReport" })
    : alert.kind === "incomplete"
      ? "/app"
      : alert.date
        ? reportHref(month, { editDate: alert.date })
        : alert.weekStart
          ? reportHref(month, { week: alert.weekStart })
          : `/app/entries?month=${month}`;
  const action = alert.kind === "missingReport" && groupCount > 1
    ? he.report.openMissingReports
    : alert.kind === "incomplete"
      ? he.report.openClock
      : alert.date
        ? he.report.openDay
        : alert.weekStart
          ? he.report.openWeek
          : he.report.openEntries;
  const tone = alert.severity === "critical"
    ? "border-[var(--error)]/20 bg-[var(--error-soft)] text-[var(--error)]"
    : alert.severity === "warning"
      ? "border-[var(--warning)]/20 bg-[var(--warning-soft)] text-[var(--warning)]"
      : "border-[var(--primary)]/15 bg-[var(--primary-soft)] text-[var(--primary)]";

  return (
    <Link href={href} className={`group flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition-transform hover:-translate-y-0.5 ${tone}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/75"><AlertIcon severity={alert.severity} /></span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">{title}</strong>
        <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-bold">{action}<ArrowLeft aria-hidden size={15} /></span>
    </Link>
  );
}

export function ReportAlerts({ analytics, month }: { analytics: ReportAnalytics; month: string }) {
  const missingReportAlerts = analytics.alerts.filter((alert) => alert.kind === "missingReport");
  const groupedAlerts: ReportAlert[] = missingReportAlerts.length > 1
    ? [{ ...missingReportAlerts[0], id: "missing-report-group", date: undefined }, ...analytics.alerts.filter((alert) => alert.kind !== "missingReport")]
    : analytics.alerts;
  const visibleAlerts = groupedAlerts.slice(0, 5);
  const hiddenAlerts = groupedAlerts.slice(5);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="dashboard-alerts-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--warning-soft)] text-[var(--warning)]"><AlertTriangle aria-hidden /></span>
        <div><h2 id="dashboard-alerts-title" className="text-xl font-extrabold">{he.report.alertsTitle}</h2><p className="muted mt-1 text-sm">{he.report.alertsDescription}</p></div>
      </div>
      {analytics.alerts.length === 0 ? (
        <div className="mt-5 flex min-h-20 items-center gap-3 rounded-2xl bg-[var(--success-soft)] p-4 text-[var(--success)]"><CircleCheckBig aria-hidden /><strong>{he.report.noAlerts}</strong></div>
      ) : (
        <div className="mt-5 grid gap-2">
          {visibleAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} analytics={analytics} month={month} groupCount={alert.kind === "missingReport" ? missingReportAlerts.length : 1} />)}
          {hiddenAlerts.length > 0 && <details className="rounded-2xl border border-[var(--border-soft)] p-3"><summary className="cursor-pointer font-bold text-[var(--primary)]">{he.report.moreAlerts} ({hiddenAlerts.length})</summary><div className="mt-3 grid gap-2">{hiddenAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} analytics={analytics} month={month} groupCount={alert.kind === "missingReport" ? missingReportAlerts.length : 1} />)}</div></details>}
        </div>
      )}
    </section>
  );
}
