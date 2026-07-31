import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tipsQuery = queryOptions({
  queryKey: ["tips"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tips")
      .select("id, title, body, category")
      .order("category");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

export const Route = createFileRoute("/tips")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tipsQuery);
  },
  head: () => ({
    meta: [
      { title: "Food Waste Tips — FoodSave" },
      {
        name: "description",
        content:
          "Practical, tested ways to waste less food at home: smarter storage, weekly planning, leftovers and shopping habits.",
      },
      { property: "og:title", content: "Food Waste Tips — FoodSave" },
      {
        property: "og:description",
        content: "Storage, planning, leftovers and shopping tips that actually cut food waste.",
      },
    ],
  }),
  component: TipsPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="mx-auto max-w-6xl px-4 py-16 text-sm text-destructive">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="mx-auto max-w-6xl px-4 py-16 text-sm">No tips yet.</p>
    </AppShell>
  ),
});

function TipsPage() {
  const { data: tips } = useSuspenseQuery(tipsQuery);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data: tried } = useQuery({
    queryKey: ["tip-completions", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("tip_completions").select("tip_id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.tip_id);
    },
  });

  const toggle = useMutation({
    mutationFn: async (tipId: string) => {
      if (!user) throw new Error("Sign in to keep track of the tips you have tried");
      if ((tried ?? []).includes(tipId)) {
        const { error } = await supabase
          .from("tip_completions")
          .delete()
          .eq("tip_id", tipId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("tip_completions")
          .insert({ tip_id: tipId, user_id: user.id });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tip-completions"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const categories = ["all", ...Array.from(new Set(tips.map((t) => t.category)))];
  const visible = tips.filter(
    (tip) =>
      (category === "all" || tip.category === category) &&
      (tip.title + tip.body).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-black tracking-tight">Ways to waste less</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Small changes in storage, planning and leftovers do most of the work. Mark the ones you
          have tried to keep track.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tips"
              className="pl-9"
              maxLength={80}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={c === category ? "default" : "outline"}
                onClick={() => setCategory(c)}
                className="capitalize"
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((tip) => {
            const done = (tried ?? []).includes(tip.id);
            return (
              <article key={tip.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {tip.category}
                </span>
                <h2 className="mt-2 text-base font-bold">{tip.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
                <Button
                  variant={done ? "secondary" : "outline"}
                  size="sm"
                  className="mt-4 gap-2 self-start"
                  onClick={() => toggle.mutate(tip.id)}
                >
                  <Check className="h-4 w-4" />
                  {done ? "Tried this" : "Mark as tried"}
                </Button>
              </article>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No tips match that search.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
