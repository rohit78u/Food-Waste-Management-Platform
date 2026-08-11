import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, MapPin } from "lucide-react";
import { applyAsCollector, getCollectorStatus } from "@/lib/collectors.functions";
import { claimDonation, listMyClaims, listOpenDonations, verifyPickupCode } from "@/lib/donations.functions";
import { MapPreview } from "@/components/MapPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pickups")({
  head: () => ({
    meta: [
      { title: "Collector Pickups — FoodSave" },
      {
        name: "description",
        content:
          "Verified collectors browse open food donations, claim a pickup and confirm collection with the donor's six-digit code.",
      },
      { property: "og:title", content: "Collector Pickups — FoodSave" },
      { property: "og:description", content: "Claim nearby donations and close them with a handover code." },
    ],
  }),
  component: PickupsPage,
});

function PickupsPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getCollectorStatus);
  const apply = useServerFn(applyAsCollector);
  const fetchOpen = useServerFn(listOpenDonations);
  const fetchClaims = useServerFn(listMyClaims);
  const claim = useServerFn(claimDonation);
  const verify = useServerFn(verifyPickupCode);

  const status = useQuery({ queryKey: ["collector-status"], queryFn: () => fetchStatus() });
  const isCollector = status.data?.isCollector ?? false;

  const open = useQuery({
    queryKey: ["open-donations"],
    queryFn: () => fetchOpen(),
    enabled: isCollector,
  });
  const claims = useQuery({
    queryKey: ["my-claims"],
    queryFn: () => fetchClaims(),
    enabled: isCollector,
  });

  const [application, setApplication] = useState({
    organization: "",
    contact_phone: "",
    service_area: "",
    note: "",
  });
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});

  const submitApplication = useMutation({
    mutationFn: () =>
      apply({
        data: {
          organization: application.organization,
          contact_phone: application.contact_phone,
          service_area: application.service_area || null,
          note: application.note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Application sent. We'll review it shortly.");
      queryClient.invalidateQueries({ queryKey: ["collector-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claimOne = useMutation({
    mutationFn: (id: string) => claim({ data: { id } }),
    onSuccess: () => {
      toast.success("Claimed. The donor now has a handover code for you.");
      queryClient.invalidateQueries({ queryKey: ["open-donations"] });
      queryClient.invalidateQueries({ queryKey: ["my-claims"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirm = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) => verify({ data: { id, code } }),
    onSuccess: () => {
      toast.success("Pickup confirmed. Thank you!");
      queryClient.invalidateQueries({ queryKey: ["my-claims"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isCollector) {
    const pending = status.data?.application?.status === "pending";
    const rejected = status.data?.application?.status === "rejected";
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-black tracking-tight">Become a verified collector</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Collectors see exact pickup addresses, so every account is reviewed before approval.
        </p>

        {pending ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Application under review</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We received your request for {status.data?.application?.organization}. You'll get access as
              soon as it is approved.
            </p>
          </div>
        ) : (
          <form
            className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              submitApplication.mutate();
            }}
          >
            {rejected ? (
              <p className="text-sm text-destructive">
                Your previous application was not approved. You can submit an updated one.
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="organization">Organisation</Label>
              <Input
                id="organization"
                value={application.organization}
                onChange={(e) => setApplication((a) => ({ ...a, organization: e.target.value }))}
                maxLength={160}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input
                id="contact_phone"
                value={application.contact_phone}
                onChange={(e) => setApplication((a) => ({ ...a, contact_phone: e.target.value }))}
                maxLength={40}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="service_area">Service area</Label>
              <Input
                id="service_area"
                value={application.service_area}
                onChange={(e) => setApplication((a) => ({ ...a, service_area: e.target.value }))}
                maxLength={160}
                placeholder="North side, within 10 km"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Anything else?</Label>
              <Textarea
                id="note"
                value={application.note}
                onChange={(e) => setApplication((a) => ({ ...a, note: e.target.value }))}
                maxLength={600}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={submitApplication.isPending}>
              Submit application
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-black tracking-tight">Pickups</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open listings show an approximate area. The exact address appears once you claim it.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Open donations</h2>
        {(open.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing open right now. Check back later.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {(open.data ?? []).map((donation: Record<string, unknown>) => (
              <li key={String(donation.id)} className="rounded-2xl border border-border bg-card p-5">
                <p className="font-semibold">{String(donation.title)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {String(donation.quantity)} {String(donation.unit)} · {String(donation.food_type)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pickup {new Date(String(donation.pickup_from)).toLocaleString()} –{" "}
                  {new Date(String(donation.pickup_until)).toLocaleTimeString()}
                </p>
                {donation.city ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {String(donation.city)} (approximate)
                  </p>
                ) : null}
                {donation.approx_lat && donation.approx_lng ? (
                  <MapPreview
                    lat={Number(donation.approx_lat)}
                    lng={Number(donation.approx_lng)}
                    span={0.03}
                    label="Approximate pickup area"
                    className="mt-3"
                  />
                ) : null}
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => claimOne.mutate(String(donation.id))}
                  disabled={claimOne.isPending}
                >
                  Claim pickup
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold">Your claims</h2>
        {(claims.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No active claims.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {(claims.data ?? []).map((donation) => (
              <li key={donation.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{donation.title}</p>
                    <p className="mt-1 text-sm">{donation.address_line}</p>
                    {donation.contact_phone ? (
                      <p className="mt-1 text-xs text-muted-foreground">{donation.contact_phone}</p>
                    ) : null}
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
                    <Badge variant={donation.address_verified ? "secondary" : "outline"} className="gap-1">
                      {donation.address_verified ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                      {donation.address_verified ? "address verified" : "address unverified"}
                    </Badge>
                  </div>
                </div>

                {donation.lat && donation.lng ? (
                  <MapPreview
                    lat={Number(donation.lat)}
                    lng={Number(donation.lng)}
                    label="Exact pickup location"
                    className="mt-3 max-w-md"
                  />
                ) : null}

                {donation.status === "claimed" ? (
                  <>
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
                        <Label htmlFor={`schedule-${donation.id}`}>Proposed pickup time</Label>
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

                    <form
                      className="mt-4 flex flex-wrap items-end gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        confirm.mutate({ id: donation.id, code: codeInputs[donation.id] ?? "" });
                      }}
                    >
                      <div className="grid gap-2">
                        <Label htmlFor={`code-${donation.id}`}>Handover code</Label>
                        <Input
                          id={`code-${donation.id}`}
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          placeholder="000000"
                          value={codeInputs[donation.id] ?? ""}
                          onChange={(e) =>
                            setCodeInputs((prev) => ({
                              ...prev,
                              [donation.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                            }))
                          }
                          className="w-40 font-mono tracking-[0.3em]"
                          required
                        />
                      </div>
                      <Button type="submit" disabled={confirm.isPending}>
                        Confirm collection
                      </Button>
                    </form>
                  </>
                ) : null}

                <PickupTimeline donationId={donation.id} />
              </li>
            ))}

          </ul>
        )}
      </section>
    </div>
  );
}
