/** Server-only helpers: pickup timeline events and in-app notifications. */

export async function logPickupEvent(input: {
  donationId: string;
  event: string;
  note?: string | null;
  actorId?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("pickup_events").insert({
    donation_id: input.donationId,
    event: input.event,
    note: input.note ?? null,
    actor_id: input.actorId ?? null,
  });
}

export async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  kind?: string;
  donationId?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    kind: input.kind ?? "info",
    donation_id: input.donationId ?? null,
  });
}
