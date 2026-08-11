import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchAll(),
    refetchInterval: 30_000,
  });

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => !n.read_at);

  const clear = useMutation({
    mutationFn: () => markRead({ data: { ids: unread.map((n) => n.id).slice(0, 50) } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread.length > 0) clear.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-bold">Notifications</p>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {rows.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
