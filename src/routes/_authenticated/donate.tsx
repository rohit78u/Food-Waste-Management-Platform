import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, KeyRound, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  cancelDonation,
  createDonation,
  getPickupCode,
  listMyDonations,
  schedulePickup,
  verifyDonationAddress,
} from "@/lib/donations.functions";
import { FOOD_TYPES, UNITS } from "@/lib/foodsave";
import { MapPreview } from "@/components/MapPreview";
import { PickupTimeline } from "@/components/PickupTimeline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/donate")({
  head: () => ({
    meta: [
      { title: "Donate Surplus Food — FoodSave" },
      {
        name: "description",
        content:
          "Post surplus food with a pickup window and map pin. Verified collectors claim it and confirm with your handover code.",
      },
      { property: "og:title", content: "Donate Surplus Food — FoodSave" },
      { property: "og:description", content: "Give surplus food a second life with verified pickups." },
    ],
  }),
  component: DonatePage,
});

function localInput(offsetHours: number) {
  const d = new Date(Date.now() + offsetHours * 3600_000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function DonatePage() {
  const queryClient = useQueryClient();
  const fetchMine = useServerFn(listMyDonations);
  const create = useServerFn(createDonation);
  const cancel = useServerFn(cancelDonation);
  const revealCode = useServerFn(getPickupCode);
  const schedule = useServerFn(schedulePickup);
  const recheckAddress = useServerFn(verifyDonationAddress);


  const [form, setForm] = useState({
    title: "",
    description: "",
    food_type: FOOD_TYPES[0] as string,
    quantity: "2",
    unit: "kg" as string,
    best_before: "",
    pickup_from: localInput(1),
    pickup_until: localInput(5),
    address_line: "",
    city: "",
    contact_phone: "",
    lat: "",
    lng: "",
  });
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<Record<string, string>>({});


  const mine = useQuery({ queryKey: ["my-donations"], queryFn: () => fetchMine() });

  const post = useMutation({
    mutationFn: () =>
      create({
        data: {
          title: form.title,
          description: form.description || null,
          food_type: form.food_type,
          quantity: Number(form.quantity),
          unit: form.unit,
          best_before: form.best_before || null,
          pickup_from: new Date(form.pickup_from).toISOString(),
          pickup_until: new Date(form.pickup_until).toISOString(),
          address_line: form.address_line,
          city: form.city || null,
          contact_phone: form.contact_phone || null,
          lat: Number(form.lat),
          lng: Number(form.lng),
        },
      }),
    onSuccess: () => {
      toast.success("Listed. Verified collectors near you can claim it now.");
      setForm((f) => ({ ...f, title: "", description: "" }));
      queryClient.invalidateQueries({ queryKey: ["my-donations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-donations"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const book = useMutation({
    mutationFn: (input: { id: string; scheduled_at: string }) => schedule({ data: input }),
    onSuccess: (_result, input) => {
      toast.success("Pickup time saved. The collector has been notified.");
      queryClient.invalidateQueries({ queryKey: ["my-donations"] });
      queryClient.invalidateQueries({ queryKey: ["pickup-events", input.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => recheckAddress({ data: { id } }),
    onSuccess: (result, id) => {
      if (result.verified) toast.success(result.reason);
      else toast.error(result.reason);
      queryClient.invalidateQueries({ queryKey: ["my-donations"] });
      queryClient.invalidateQueries({ queryKey: ["pickup-events", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reveal = useMutation({

    mutationFn: (id: string) => revealCode({ data: { id } }),
    onSuccess: (result, id) => {
      if (!result.code) {
        toast.info("A code appears once a collector claims this donation.");
        return;
      }
      setCodes((prev) => ({ ...prev, [id]: result.code as string }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser cannot share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        })),
      () => toast.error("Could not get your location. Enter coordinates manually."),
    );
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-border bg-card p-6">
        <h1 className="text-2xl font-black tracking-tight">Donate surplus food</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your exact address stays hidden until a verified collector claims the listing.
        </p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            post.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="title">Listing title</Label>
            <Input id="title" value={form.title} onChange={set("title")} maxLength={120} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="food_type">Food type</Label>
              <select
                id="food_type"
                value={form.food_type}
                onChange={set("food_type")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.quantity}
                  onChange={set("quantity")}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  value={form.unit}
                  onChange={set("unit")}
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={set("description")}
              maxLength={600}
              rows={3}
              placeholder="Packed in three sealed trays, cooked this morning."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pickup_from">Pickup from</Label>
              <Input
                id="pickup_from"
                type="datetime-local"
                value={form.pickup_from}
                onChange={set("pickup_from")}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pickup_until">Pickup until</Label>
              <Input
                id="pickup_until"
                type="datetime-local"
                value={form.pickup_until}
                onChange={set("pickup_until")}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="best_before">Best before (optional)</Label>
            <Input id="best_before" type="date" value={form.best_before} onChange={set("best_before")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address_line">Pickup address</Label>
            <Input
              id="address_line"
              value={form.address_line}
              onChange={set("address_line")}
              maxLength={300}
              required
              placeholder="12 Rosewood Lane, gate on the left"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={set("city")} maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input
                id="contact_phone"
                value={form.contact_phone}
                onChange={set("contact_phone")}
                maxLength={40}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Map pin</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                aria-label="Latitude"
                placeholder="Latitude"
                value={form.lat}
                onChange={set("lat")}
                required
              />
              <Input
                aria-label="Longitude"
                placeholder="Longitude"
                value={form.lng}
                onChange={set("lng")}
                required
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-1 gap-2 justify-self-start" onClick={useMyLocation}>
              <MapPin className="h-4 w-4" /> Use my current location
            </Button>
          </div>

          {form.lat && form.lng && !Number.isNaN(Number(form.lat)) && !Number.isNaN(Number(form.lng)) ? (
            <MapPreview lat={Number(form.lat)} lng={Number(form.lng)} label="Your pickup pin" />
          ) : null}

          <Button type="submit" disabled={post.isPending} className="mt-1">
            Post donation
          </Button>
        </form>
      </section>

      <section className="min-w-0">
        <h2 className="text-lg font-bold">Your listings</h2>
        {mine.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (mine.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing posted yet.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {(mine.data ?? []).map((donation) => (
              <li key={donation.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{donation.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {donation.quantity} {donation.unit} · {donation.food_type} ·{" "}
                      {new Date(donation.pickup_from).toLocaleString()} –{" "}
                      {new Date(donation.pickup_until).toLocaleTimeString()}
                    </p>
                    {donation.scheduled_at ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                        <CalendarClock className="h-3 w-3" /> Pickup at{" "}
                        {new Date(donation.scheduled_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={donation.status === "collected" ? "secondary" : "default"}>
                      {donation.status}
                    </Badge>
                    <Badge
                      variant={donation.address_verified ? "secondary" : "outline"}
                      className="gap-1"
                    >
                      {donation.address_verified ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                      {donation.address_verified ? "address verified" : "address unverified"}
                    </Badge>
                  </div>
                </div>

                {donation.address_verified_label ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Matched: {donation.address_verified_label}
                  </p>
                ) : null}

                {donation.status === "open" || donation.status === "claimed" ? (
                  <form
                    className="mt-4 flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = schedules[donation.id];
                      if (!value) {
                        toast.error("Pick a pickup date and time first.");
                        return;
                      }
                      book.mutate({ id: donation.id, scheduled_at: new Date(value).toISOString() });
                    }}
                  >
                    <div className="grid gap-2">
                      <Label htmlFor={`schedule-${donation.id}`}>Scheduled pickup time</Label>
                      <Input
                        id={`schedule-${donation.id}`}
                        type="datetime-local"
                        value={
                          schedules[donation.id] ??
                          (donation.scheduled_at
                            ? new Date(
                                new Date(donation.scheduled_at).getTime() -
                                  new Date().getTimezoneOffset() * 60_000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : "")
                        }
                        onChange={(e) =>
                          setSchedules((prev) => ({ ...prev, [donation.id]: e.target.value }))
                        }
                        className="w-56"
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline" disabled={book.isPending}>
                      Save time
                    </Button>
                  </form>
                ) : null}

                {donation.status === "claimed" ? (
                  <div className="mt-4 rounded-xl bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground">
                      Read this code to the collector at handover — they enter it to close the pickup.
                      It was also sent to your notifications.
                    </p>
                    {codes[donation.id] ? (
                      <p className="mt-2 font-mono text-3xl font-black tracking-[0.35em]">
                        {codes[donation.id]}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-2"
                        onClick={() => reveal.mutate(donation.id)}
                      >
                        <KeyRound className="h-4 w-4" /> Show handover code
                      </Button>
                    )}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!donation.address_verified && donation.status !== "collected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => recheck.mutate(donation.id)}
                      disabled={recheck.isPending}
                    >
                      <ShieldCheck className="h-4 w-4" /> Verify address
                    </Button>
                  ) : null}
                  {donation.status === "open" ? (
                    <Button size="sm" variant="ghost" onClick={() => drop.mutate(donation.id)}>
                      Cancel listing
                    </Button>
                  ) : null}
                </div>

                <PickupTimeline donationId={donation.id} />
              </li>
            ))}

          </ul>
        )}
      </section>
    </div>
  );
}
