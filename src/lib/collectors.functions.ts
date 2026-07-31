import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const applicationSchema = z.object({
  organization: z.string().trim().min(2).max(160),
  contact_phone: z.string().trim().min(5).max(40),
  service_area: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(600).optional().nullable(),
});

export const getCollectorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: application }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase
        .from("collector_applications")
        .select("id, organization, status, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      roles: (roles ?? []).map((r) => r.role as string),
      isCollector: (roles ?? []).some((r) => r.role === "collector"),
      application: application ?? null,
    };
  });

export const applyAsCollector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collector_applications")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
