import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Droplets, Factory, Scale, Wallet } from "lucide-react";
import { listWasteEntries } from "@/lib/waste.functions";
import { formatNumber, impactOf, toKilograms } from "@/lib/foodsave";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Impact Reports — FoodSave" },
      {
        name: "description",
        content:
          "See your food waste by week and category, plus the CO2, water and money behind every kilogram.",
      },
      { property: "og:title", content: "Impact Reports — FoodSave" },
      { property: "og:description", content: "Weekly trends, top categories and environmental impact." },
    ],
  }),
  component: ReportsPage,
});

const RANGES = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
] as const;

const PIE_COLORS = [
  "hsl(var(--chart-1, 142 55% 38%))",
  "#7aa93c",
  "#e0a338",
  "#c46b4b",
  "#4c8f7b",
  "#8a7fb5",
];

function ReportsPage() {
  const fetchEntries = useServerFn(listWasteEntries);
  const [range, setRange] = useState<number>(30);
  const entries = useQuery({ queryKey: ["waste-entries"], queryFn: () => fetchEntries() });

  const rows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return (entries.data ?? [])
      .filter((entry) => new Date(entry.wasted_on) >= cutoff)
      .map((entry) => {
        const kg = toKilograms(Number(entry.quantity), entry.unit);
        return { ...entry, kg, ...impactOf(entry.category, kg) };
      });
  }, [entries.data, range]);

  const totals = rows.reduce(
    (acc, row) => ({
      kg: acc.kg + row.kg,
      co2: acc.co2 + row.co2,
      water: acc.water + row.water,
      money: acc.money + row.money,
    }),
    { kg: 0, co2: 0, water: 0, money: 0 },
  );

  const byCategory = Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, row) => {
      acc[row.category] ??= { name: row.category, value: 0 };
      acc[row.category].value += row.kg;
      return acc;
    }, {}),
  ).map((slice) => ({ ...slice, value: Number(slice.value.toFixed(2)) }));

  const byDay = Object.values(
    rows.reduce<Record<string, { day: string; kg: number }>>((acc, row) => {
      acc[row.wasted_on] ??= { day: row.wasted_on, kg: 0 };
      acc[row.wasted_on].kg += row.kg;
      return acc;
    }, {}),
  )
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((point) => ({ ...point, kg: Number(point.kg.toFixed(2)) }));

  const cards = [
    { icon: Scale, label: "Food wasted", value: `${formatNumber(totals.kg, 2)} kg` },
    { icon: Factory, label: "CO2 equivalent", value: `${formatNumber(totals.co2, 1)} kg` },
    { icon: Droplets, label: "Water footprint", value: `${formatNumber(totals.water, 0)} L` },
    { icon: Wallet, label: "Value binned", value: `${formatNumber(totals.money, 2)}` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Your impact</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimates use average footprints per food category — directional, not laboratory grade.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={range === option.key ? "default" : "outline"}
              onClick={() => setRange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-5">
            <card.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No entries in this period yet. Log a few days to see the trend.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Waste per day (kg)</h2>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={38} />
                  <Tooltip />
                  <Bar dataKey="kg" fill="#3f8f4f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">By category</h2>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {byCategory.map((slice, index) => (
                      <Cell key={slice.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
