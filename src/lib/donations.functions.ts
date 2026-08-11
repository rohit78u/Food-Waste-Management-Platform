import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coarsen } from "@/lib/foodsave";

const donationSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).optional().nullable(),
  food_type: z.string().trim().min(1).max(60),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().min(1).max(10),
  best_before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  pickup_from: z.string().min(1),
  pickup_until: z.string().min(1),
  address_line: z.string().trim().min(5).max(300),
  city: z.string().trim().max(120).optional().nullable(),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const idSchema = z.object({ id: z.string().uuid() });

export const createDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => donationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyAddressAgainstPin } = await import("@/lib/geocode.server");
    const check = await verifyAddressAgainstPin({
      address: data.address_line,
      city: data.city ?? null,
      lat: data.lat,
      lng: data.lng,
    });

    const { data: row, error } = await context.supabase
      .from("donations")
      .insert({
        ...data,
        donor_id: context.userId,
        approx_lat: coarsen(data.lat),
        approx_lng: coarsen(data.lng),
        address_verified: check.verified,
        address_verified_at: check.verified ? new Date().toISOString() : null,
        address_verified_label: check.label,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { logPickupEvent } = await import("@/lib/pickup-log.server");
    await logPickupEvent({
      donationId: row.id,
      event: "listed",
      note: check.verified ? "Address verified against the map pin." : check.reason,
      actorId: context.userId,
    });

    return { id: row.id, addressVerified: check.verified, addressCheck: check.reason };
  });

/** Re-run address verification for one of the donor's own listings. */
export const verifyDonationAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: donation, error } = await context.supabase
      .from("donations")
      .select("id, address_line, city, lat, lng")
      .eq("id", data.id)
      .eq("donor_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("Donation not found");

    const { verifyAddressAgainstPin } = await import("@/lib/geocode.server");
    const check = await verifyAddressAgainstPin({
      address: donation.address_line,
      city: donation.city,
      lat: donation.lat,
      lng: donation.lng,
    });

    const { error: updateError } = await context.supabase
      .from("donations")
      .update({
        address_verified: check.verified,
        address_verified_at: check.verified ? new Date().toISOString() : null,
        address_verified_label: check.label,
      })
      .eq("id", data.id)
      .eq("donor_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    const { logPickupEvent } = await import("@/lib/pickup-log.server");
    await logPickupEvent({
      donationId: data.id,
      event: check.verified ? "address verified" : "address check failed",
      note: check.reason,
      actorId: context.userId,
    });

    return check;
  });

/** Donor or the claiming collector agrees an exact pickup time. */
export const schedulePickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), scheduled_at: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const when = new Date(data.scheduled_at);
    if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time");

    const { data: donation, error } = await context.supabase
      .from("donations")
      .select("id, donor_id, claimed_by, status, title, pickup_from, pickup_until")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("Donation not found");
    if (donation.donor_id !== context.userId && donation.claimed_by !== context.userId) {
      throw new Error("Only the donor or the assigned collector can schedule this pickup");
    }
    if (donation.status !== "open" && donation.status !== "claimed") {
      throw new Error("This pickup can no longer be rescheduled");
    }
    if (when < new Date(donation.pickup_from) || when > new Date(donation.pickup_until)) {
      throw new Error("Choose a time inside the pickup window");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("donations")
      .update({ scheduled_at: when.toISOString() })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    const { logPickupEvent, notifyUser } = await import("@/lib/pickup-log.server");
    await logPickupEvent({
      donationId: data.id,
      event: "pickup scheduled",
      note: when.toISOString(),
      actorId: context.userId,
    });

    const counterparty =
      context.userId === donation.donor_id ? donation.claimed_by : donation.donor_id;
    if (counterparty) {
      await notifyUser({
        userId: counterparty,
        kind: "schedule",
        donationId: data.id,
        title: "Pickup time set",
        body: `“${donation.title}” is scheduled for ${when.toLocaleString("en-GB", { timeZone: "UTC" })} UTC.`,
      });
    }

    return { scheduled_at: when.toISOString() };
  });

/** Timeline of everything that happened for a donation (donor or claimer only). */
export const listPickupEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("pickup_events")
      .select("id, event, note, created_at")
      .eq("donation_id", data.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMyDonations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("donations")
      .select("*")
      .eq("donor_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("donations")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("donor_id", context.userId)
      .eq("status", "open");
    if (error) throw new Error(error.message);

    const { logPickupEvent } = await import("@/lib/pickup-log.server");
    await logPickupEvent({ donationId: data.id, event: "cancelled", actorId: context.userId });
    return { ok: true };
  });

/** Donor-only: reveal the handover code for one of their claimed donations. */
export const getPickupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: donation, error } = await context.supabase
      .from("donations")
      .select("id, donor_id, status")
      .eq("id", data.id)
      .eq("donor_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("Donation not found");
    if (donation.status !== "claimed") return { code: null as string | null, expires_at: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("pickup_codes")
      .select("code_plain, expires_at")
      .eq("donation_id", data.id)
      .maybeSingle();
    return { code: row?.code_plain ?? null, expires_at: row?.expires_at ?? null };
  });

/** Collector board: open listings with approximate location only. */
export const listOpenDonations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_open_donations");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("donations")
      .select("*")
      .eq("claimed_by", context.userId)
      .order("pickup_until", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const claimDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isCollector } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "collector",
    });
    if (!isCollector) throw new Error("Only verified collectors can claim pickups");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generatePickupCode, hashPickupCode } = await import("@/lib/pickup-code.server");

    const { data: claimed, error } = await supabaseAdmin
      .from("donations")
      .update({
        status: "claimed",
        claimed_by: context.userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "open")
      .select("id, pickup_until, donor_id, title")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claimed) throw new Error("This donation is no longer available");

    const code = generatePickupCode();
    const codeHash = await hashPickupCode(code, claimed.id);
    const expires = new Date(claimed.pickup_until);
    expires.setHours(expires.getHours() + 2);

    await supabaseAdmin.from("pickup_codes").upsert({
      donation_id: claimed.id,
      code_hash: codeHash,
      code_plain: code,
      expires_at: expires.toISOString(),
      attempts: 0,
    });

    const { logPickupEvent, notifyUser } = await import("@/lib/pickup-log.server");
    await logPickupEvent({
      donationId: claimed.id,
      event: "claimed",
      note: "A verified collector claimed this pickup.",
      actorId: context.userId,
    });
    await logPickupEvent({ donationId: claimed.id, event: "handover code issued" });
    await notifyUser({
      userId: claimed.donor_id,
      kind: "otp",
      donationId: claimed.id,
      title: "Your handover code",
      body: `A collector claimed “${claimed.title}”. Share code ${code} only at handover.`,
    });

    return { ok: true };
  });

export const verifyPickupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: donation, error } = await context.supabase
      .from("donations")
      .select("id, status, claimed_by, donor_id, title")
      .eq("id", data.id)
      .eq("claimed_by", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("You have not claimed this pickup");
    if (donation.status === "collected") return { ok: true, alreadyCollected: true };
    if (donation.status !== "claimed") throw new Error("This pickup is not active");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPickupCode, constantTimeEqual } = await import("@/lib/pickup-code.server");
    const { logPickupEvent, notifyUser } = await import("@/lib/pickup-log.server");

    const { data: row } = await supabaseAdmin
      .from("pickup_codes")
      .select("code_hash, expires_at, attempts")
      .eq("donation_id", data.id)
      .maybeSingle();
    if (!row) throw new Error("No pickup code has been issued yet");
    if (row.attempts >= 8) throw new Error("Too many incorrect attempts. Ask the donor for a new code.");
    if (new Date(row.expires_at) < new Date()) throw new Error("This pickup code has expired");

    const attempt = await hashPickupCode(data.code, data.id);
    if (!constantTimeEqual(attempt, row.code_hash)) {
      await supabaseAdmin
        .from("pickup_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("donation_id", data.id);
      await logPickupEvent({
        donationId: data.id,
        event: "incorrect code entered",
        actorId: context.userId,
      });
      throw new Error("That code doesn't match. Please check with the donor.");
    }

    await supabaseAdmin
      .from("donations")
      .update({ status: "collected", collected_at: new Date().toISOString() })
      .eq("id", data.id);
    await supabaseAdmin.from("pickup_codes").delete().eq("donation_id", data.id);

    await logPickupEvent({
      donationId: data.id,
      event: "collected",
      note: "Handover code verified.",
      actorId: context.userId,
    });
    await notifyUser({
      userId: donation.donor_id,
      kind: "collected",
      donationId: data.id,
      title: "Pickup completed",
      body: `“${donation.title}” was collected and the handover code is now retired.`,
    });

    return { ok: true, alreadyCollected: false };
  });
