import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  addWasteEntry,
  deleteWasteEntry,
  listWasteEntries,
} from "@/lib/waste.functions";
import { UNITS, WASTE_CATEGORIES, WASTE_REASONS, impactOf, toKilograms, formatNumber } from "@/lib/foodsave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/log")({
  head: () => ({
    meta: [
      { title: "Log Food Waste — FoodSave" },
      {
        name: "description",
        content: "Record what went in the bin today: item, amount, reason and date, then watch the pattern.",
      },
      { property: "og:title", content: "Log Food Waste — FoodSave" },
      { property: "og:description", content: "Thirty seconds per entry to see where your food waste goes." },
    ],
  }),
  component: LogPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function LogPage() {
  const queryClient = useQueryClient();
  const fetchEntries = useServerFn(listWasteEntries);
  const addEntry = useServerFn(addWasteEntry);
  const removeEntry = useServerFn(deleteWasteEntry);

  const [item, setItem] = useState("");
  const [category, setCategory] = useState<string>("produce");
  const [quantity, setQuantity] = useState("0.5");
  const [unit, setUnit] = useState<string>("kg");
  const [reason, setReason] = useState<string>("spoiled");
  const [wastedOn, setWastedOn] = useState(today());
  const [note, setNote] = useState("");

  const entries = useQuery({ queryKey: ["waste-entries"], queryFn: () => fetchEntries() });

  const create = useMutation({
    mutationFn: () =>
      addEntry({
        data: {
          item,
          category,
          quantity: Number(quantity),
          unit,
          reason,
          wasted_on: wastedOn,
          note: note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Logged. That is one more data point to work with.");
      setItem("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["waste-entries"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeEntry({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waste-entries"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-card p-6">
        <h1 className="text-2xl font-black tracking-tight">Log food waste</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Be honest rather than precise — a rough weight is enough to spot the pattern.
        </p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="item">What was it?</Label>
            <Input
              id="item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Half a bag of spinach"
              maxLength={120}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {WASTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Why?</Label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {WASTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Amount</Label>
              <Input
                id="quantity"
                type="number"
                step="0.05"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wastedOn">Date</Label>
            <Input
              id="wastedOn"
              type="date"
              value={wastedOn}
              max={today()}
              onChange={(e) => setWastedOn(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          <Button type="submit" disabled={create.isPending} className="mt-1">
            Add entry
          </Button>
        </form>
      </section>

      <section className="min-w-0">
        <h2 className="text-lg font-bold">Recent entries</h2>
        {entries.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading your log…</p>
        ) : (entries.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing logged yet. Your first entry starts the baseline.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {(entries.data ?? []).map((entry) => {
              const kg = toKilograms(Number(entry.quantity), entry.unit);
              const impact = impactOf(entry.category, kg);
              return (
                <li
                  key={entry.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{entry.item}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {entry.category} · {entry.reason} · {entry.wasted_on}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.quantity} {entry.unit} · {formatNumber(impact.co2, 2)} kg CO2e ·{" "}
                      {formatNumber(impact.water, 0)} L water
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${entry.item}`}
                    onClick={() => remove.mutate(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
