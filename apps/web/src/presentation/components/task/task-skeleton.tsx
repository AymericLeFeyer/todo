/** Squelette de chargement : évite le saut de mise en page à l'arrivée des données. */
export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-3.5">
          <div className="size-5 shrink-0 animate-pulse rounded-full bg-muted" />
          <div
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${55 + ((index * 13) % 35)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
