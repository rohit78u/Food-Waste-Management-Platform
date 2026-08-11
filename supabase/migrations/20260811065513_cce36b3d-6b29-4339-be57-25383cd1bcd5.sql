ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS address_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS address_verified_label text;

CREATE TABLE public.pickup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  event text NOT NULL,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_events TO authenticated;
GRANT ALL ON public.pickup_events TO service_role;
ALTER TABLE public.pickup_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pickup_events_select_participants ON public.pickup_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.id = pickup_events.donation_id
      AND (d.donor_id = auth.uid() OR d.claimed_by = auth.uid())
  ));
CREATE INDEX pickup_events_donation_idx ON public.pickup_events (donation_id, created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donation_id uuid REFERENCES public.donations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);