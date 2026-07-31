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
    const { data: row, error } = await context.supabase
      .from("donations")
      .insert({
        ...data,
        donor_id: context.userId,
        approx_lat: coarsen(data.lat),
        approx_lng: coarsen(data.lng),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
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
      .select("id, pickup_until")
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
      .select("id, status, claimed_by")
      .eq("id", data.id)
      .eq("claimed_by", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!donation) throw new Error("You have not claimed this pickup");
    if (donation.status === "collected") return { ok: true, alreadyCollected: true };
    if (donation.status !== "claimed") throw new Error("This pickup is not active");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPickupCode, constantTimeEqual } = await import("@/lib/pickup-code.server");

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
      throw new Error("That code doesn't match. Please check with the donor.");
    }

    await supabaseAdmin
      .from("donations")
      .update({ status: "collected", collected_at: new Date().toISOString() })
      .eq("id", data.id);
    await supabaseAdmin.from("pickup_codes").delete().eq("donation_id", data.id);

    return { ok: true, alreadyCollected: false };
  });
