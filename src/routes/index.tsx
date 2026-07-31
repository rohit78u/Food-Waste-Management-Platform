import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, HandHeart, KeyRound, LineChart } from "lucide-react";
import heroImage from "@/assets/hero-kitchen.jpg";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodSave — Track Food Waste & Donate Surplus" },
      {
        name: "description",
        content:
          "Log daily food waste, see your CO2 and water impact, and hand surplus food to verified collectors with a one-time pickup code.",
      },
      { property: "og:title", content: "FoodSave — Track Food Waste & Donate Surplus" },
      {
        property: "og:description",
        content: "Waste less at home, and give the rest a second life through verified pickups.",
      },
    ],
  }),
  component: Index,
});

const STEPS = [
  {
    icon: ClipboardList,
    title: "Log what gets binned",
    body: "Thirty seconds per entry: item, amount, and why it went. Patterns show up within a week.",
  },
  {
    icon: LineChart,
    title: "See the real cost",
    body: "Every entry converts into CO2e, water, and money so the habit has a number attached.",
  },
  {
    icon: HandHeart,
    title: "Donate the surplus",
    body: "Post food you cannot use with a pickup window and a map pin. Verified collectors claim it.",
  },
  {
    icon: KeyRound,
    title: "Confirm with a code",
    body: "At handover the donor reads out a six-digit code. The collector enters it and the pickup closes.",
  },
];

function Index() {
  return (
    <AppShell>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
            Waste less, share more
          </span>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Every meal you rescue is water, land and money saved.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            FoodSave turns kitchen habits into numbers you can act on — and gives whatever you
            cannot eat a route to someone who can, through verified collectors and a one-time
            pickup code.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/log">Start logging</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/donate">Donate surplus food</Link>
            </Button>
          </div>
        </div>

        <img
          src={heroImage}
          alt="Fresh vegetables, bread and herbs laid out on a wooden kitchen table beside a crate of surplus produce"
          width={1600}
          height={1104}
          className="w-full rounded-3xl border border-border object-cover shadow-lg"
        />
      </section>

      <section className="border-y border-border/70 bg-secondary/30">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-bold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <h2 className="max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            Collecting food for a community kitchen or food bank?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-90">
            Apply for a collector account. Once approved you can browse open donations near you,
            claim a pickup, and close it out with the donor's handover code.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7">
            <Link to="/pickups">Apply as a collector</Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
