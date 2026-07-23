export function RouteLoading() {
  return (
    <section className="route-loading" role="status" aria-live="polite" aria-label="טוען את העמוד">
      <div className="route-loading-mark" aria-hidden>
        <span className="route-loading-hand" />
      </div>
      <div>
        <p className="route-loading-title">עוד רגע הכול מוכן</p>
        <span className="loading-dots" aria-hidden><i /><i /><i /></span>
      </div>
      <div className="loading-skeleton-grid" aria-hidden>
        <span className="loading-skeleton loading-skeleton-wide" />
        <span className="loading-skeleton" />
        <span className="loading-skeleton" />
      </div>
    </section>
  );
}