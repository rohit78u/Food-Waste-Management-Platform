REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_open_donations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_donations() TO authenticated, service_role;
CREATE POLICY "pickup_codes_no_access" ON public.pickup_codes FOR SELECT TO authenticated USING (false);