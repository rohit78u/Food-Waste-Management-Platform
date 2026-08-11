import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function listWasteEntries() {
  return request<any[]>("/waste");
}

export async function createWasteEntry(payload: Record<string, unknown>) {
  return request<any>("/waste", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteWasteEntry(id: string) {
  return request<any>(`/waste/${id}`, {
    method: "DELETE",
  });
}

export async function getReportSummary(days: number) {
  return request<any>(`/reports/summary?days=${days}`);
}

export async function listDonations() {
  return request<any[]>("/donations");
}

export async function createDonation(payload: Record<string, unknown>) {
  return request<any>("/donations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteDonation(id: string) {
  return request<any>(`/donations/${id}`, {
    method: "DELETE",
  });
}

export async function getDonationCode(id: string) {
  return request<any>(`/donations/${id}/handover`);
}

export async function createCollectorApplication(payload: Record<string, unknown>) {
  return request<any>("/auth/collector-applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCollectorStatus() {
  return request<any>("/auth/collector-status");
}

export async function listOpenDonations() {
  return request<any[]>("/pickups/open");
}

export async function listMyClaims() {
  return request<any[]>("/pickups/claims");
}

export async function claimDonation(id: string) {
  return request<any>("/pickups/claim", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export async function schedulePickup(id: string, scheduledAt: string) {
  return request<any>("/pickups/schedule", {
    method: "POST",
    body: JSON.stringify({ id, scheduled_at: scheduledAt }),
  });
}

export async function verifyPickupCode(id: string, code: string) {
  return request<any>("/pickups/verify", {
    method: "POST",
    body: JSON.stringify({ id, code }),
  });
}

export async function listPickupEvents(donationId: string) {
  return request<any[]>(`/pickups/events/${donationId}`);
}

export async function listNotifications() {
  return request<any[]>("/pickups/notifications");
}

export async function markNotificationsRead() {
  return request<any>("/pickups/notifications/read", {
    method: "POST",
  });
}

// Admin endpoints
export async function getAdminStats() {
  return request<any>("/admin/stats");
}

export async function listAllCollectors(status?: string) {
  const query = status ? `?status=${status}` : "";
  return request<any[]>(`/admin/collectors${query}`);
}

export async function listAllDonations(status?: string) {
  const query = status ? `?status=${status}` : "";
  return request<any[]>(`/admin/donations${query}`);
}

export async function listAllWaste() {
  return request<any[]>("/admin/waste");
}

export async function verifyCollector(collectorId: string) {
  return request<any>(`/admin/verify-collector/${collectorId}`, {
    method: "POST",
  });
}

export async function rejectCollector(collectorId: string, reason?: string) {
  const body = reason ? { reason } : {};
  return request<any>(`/admin/reject-collector/${collectorId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPickupEvents(donationId?: string) {
  const query = donationId ? `?donation_id=${donationId}` : "";
  return request<any[]>(`/admin/pickup-events${query}`);
}
