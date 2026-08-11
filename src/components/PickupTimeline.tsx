import { useQuery } from "@tanstack/react-query";
import { listPickupEvents } from "@/lib/api";

/** Chronological status trail for one donation. */
export function PickupTimeline({ donationId }: { donationId: string }) {
  const events = useQuery({
    queryKey: ["pickup-events", donationId],
    queryFn: () => listPickupEvents(donationId),
  });

  if (events.isLoading) return <p className="mt-3 text-xs text-muted-foreground">Loading history…</p>;
  const rows = events.data ?? [];
  if (rows.length === 0) return null;

  return (
    <ol className="mt-4 space-y-2 border-l border-border pl-4">
      {rows.map((row) => (
        <li key={row.id} className="relative text-xs">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
          <span className="font-semibold capitalize">{row.event}</span>
          <span className="text-muted-foreground"> · {new Date(row.created_at).toLocaleString()}</span>
          {row.note ? <p className="mt-0.5 text-muted-foreground">{row.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
