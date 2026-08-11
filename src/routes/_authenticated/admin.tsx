import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminStats,
  listAllCollectors,
  listAllDonations,
  listAllWaste,
  verifyCollector,
  rejectCollector,
  getPickupEvents,
} from "@/lib/api";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("stats");

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
  });

  const { data: collectors } = useQuery({
    queryKey: ["admin", "collectors"],
    queryFn: () => listAllCollectors(),
  });

  const { data: donations } = useQuery({
    queryKey: ["admin", "donations"],
    queryFn: () => listAllDonations(),
  });

  const { data: waste } = useQuery({
    queryKey: ["admin", "waste"],
    queryFn: listAllWaste,
  });

  const { data: pickupEvents } = useQuery({
    queryKey: ["admin", "pickup-events"],
    queryFn: () => getPickupEvents(),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyCollector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "collectors"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectCollector(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "collectors"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage collectors, donations, and platform metrics</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Waste Logged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.total_waste_kg} kg</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Donations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.total_donations}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Approved Collectors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.approved_collectors}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Pending Approval
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending_collectors}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stats">Overview</TabsTrigger>
            <TabsTrigger value="collectors">Collectors</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="waste">Waste Log</TabsTrigger>
            <TabsTrigger value="pickups">Pickup audit</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="stats" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Donation Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Open</span>
                      <Badge variant="outline">{stats.donations_by_status.open}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Claimed</span>
                      <Badge variant="outline">{stats.donations_by_status.claimed}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Collected</span>
                      <Badge variant="outline">{stats.donations_by_status.collected}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Collector Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Approved</span>
                      <Badge className="bg-green-600">{stats.approved_collectors}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending</span>
                      <Badge className="bg-yellow-600">{stats.pending_collectors}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Platform Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Pickups</span>
                      <Badge variant="outline">{stats.total_pickups}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Collectors Tab */}
          <TabsContent value="collectors">
            <Card>
              <CardHeader>
                <CardTitle>Collector Applications</CardTitle>
                <CardDescription>Review and approve collector applications</CardDescription>
              </CardHeader>
              <CardContent>
                {collectors && collectors.length > 0 ? (
                  <div className="space-y-4">
                    {collectors.map((collector: any) => (
                      <div
                        key={collector.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{collector.organization}</h3>
                            <p className="text-sm text-gray-600">User: {collector.user_id}</p>
                            <p className="text-sm text-gray-600">Phone: {collector.contact_phone}</p>
                            {collector.service_area && (
                              <p className="text-sm text-gray-600">Area: {collector.service_area}</p>
                            )}
                            {collector.note && (
                              <p className="text-sm text-gray-700 mt-2 italic">{collector.note}</p>
                            )}
                          </div>
                          <Badge
                            className={
                              collector.status === "approved"
                                ? "bg-green-600"
                                : collector.status === "rejected"
                                ? "bg-red-600"
                                : "bg-yellow-600"
                            }
                          >
                            {collector.status}
                          </Badge>
                        </div>

                        {collector.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => verifyMutation.mutate(collector.id)}
                              disabled={verifyMutation.isPending}
                            >
                              {verifyMutation.isPending ? "Approving..." : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMutation.mutate({ id: collector.id })}
                              disabled={rejectMutation.isPending}
                            >
                              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No collector applications found</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Donations Tab */}
          <TabsContent value="donations">
            <Card>
              <CardHeader>
                <CardTitle>All Donations</CardTitle>
                <CardDescription>View all donation listings on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                {donations && donations.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {donations.map((donation: any) => (
                      <div
                        key={donation.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{donation.title}</h3>
                            <p className="text-sm text-gray-600">{donation.description}</p>
                            <p className="text-sm text-gray-600">
                              {donation.quantity} {donation.unit} of {donation.food_type}
                            </p>
                            <p className="text-sm text-gray-600">{donation.address_line}</p>
                          </div>
                          <Badge
                            className={
                              donation.status === "open"
                                ? "bg-blue-600"
                                : donation.status === "claimed"
                                ? "bg-yellow-600"
                                : "bg-green-600"
                            }
                          >
                            {donation.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No donations found</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Waste Log Tab */}
          <TabsContent value="waste">
            <Card>
              <CardHeader>
                <CardTitle>Waste Logs</CardTitle>
                <CardDescription>All waste entries logged by users</CardDescription>
              </CardHeader>
              <CardContent>
                {waste && waste.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {waste.map((entry: any) => (
                      <div
                        key={entry.id}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900">{entry.item}</h3>
                          <Badge variant="outline">{entry.category}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {entry.quantity} {entry.unit}
                        </p>
                        <p className="text-sm text-gray-600">Reason: {entry.reason}</p>
                        <p className="text-xs text-gray-500">Wasted on: {entry.wasted_on}</p>
                        {entry.note && (
                          <p className="text-sm text-gray-700 mt-2 italic">{entry.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No waste logs found</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pickups">
            <Card>
              <CardHeader>
                <CardTitle>Pickup audit trail</CardTitle>
                <CardDescription>Every listed, claimed, scheduled, and collected event.</CardDescription>
              </CardHeader>
              <CardContent>
                {pickupEvents && pickupEvents.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {pickupEvents.map((event: any) => (
                      <div key={event.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold capitalize">{event.event}</p>
                            <p className="text-sm text-muted-foreground">Donation: {event.donation_id}</p>
                            {event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}
                          </div>
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            <p>{new Date(event.created_at).toLocaleString()}</p>
                            {event.actor_id ? <p>By: {event.actor_id}</p> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No pickup events recorded yet</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");
    if (!roles?.length) throw redirect({ to: "/log" });
  },
  component: AdminPage,
});
