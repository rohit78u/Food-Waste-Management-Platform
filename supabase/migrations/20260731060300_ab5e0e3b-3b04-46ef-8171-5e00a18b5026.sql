-- ENUMS
CREATE TYPE public.app_role AS ENUM ('donor','collector','admin');
CREATE TYPE public.donation_status AS ENUM ('open','claimed','collected','cancelled','expired');
CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- new user trigger: profile + donor role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'donor') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COLLECTOR APPLICATIONS
CREATE TABLE public.collector_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  service_area TEXT,
  note TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.collector_applications TO authenticated;
GRANT ALL ON public.collector_applications TO service_role;
ALTER TABLE public.collector_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_select_own_or_admin" ON public.collector_applications FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "apps_insert_own" ON public.collector_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "apps_update_admin" ON public.collector_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER collector_applications_updated_at BEFORE UPDATE ON public.collector_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WASTE ENTRIES
CREATE TABLE public.waste_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  reason TEXT NOT NULL,
  wasted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_entries TO authenticated;
GRANT ALL ON public.waste_entries TO service_role;
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waste_own_all" ON public.waste_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX waste_entries_user_date_idx ON public.waste_entries (user_id, wasted_on DESC);
CREATE TRIGGER waste_entries_updated_at BEFORE UPDATE ON public.waste_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DONATIONS
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  food_type TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  best_before DATE,
  pickup_from TIMESTAMPTZ NOT NULL,
  pickup_until TIMESTAMPTZ NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT,
  contact_phone TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  approx_lat DOUBLE PRECISION NOT NULL,
  approx_lng DOUBLE PRECISION NOT NULL,
  status public.donation_status NOT NULL DEFAULT 'open',
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "donations_select_donor" ON public.donations FOR SELECT TO authenticated USING (auth.uid() = donor_id);
CREATE POLICY "donations_select_claimer" ON public.donations FOR SELECT TO authenticated USING (auth.uid() = claimed_by AND public.has_role(auth.uid(),'collector'));
CREATE POLICY "donations_insert_own" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_id);
CREATE POLICY "donations_update_donor" ON public.donations FOR UPDATE TO authenticated USING (auth.uid() = donor_id) WITH CHECK (auth.uid() = donor_id);
CREATE INDEX donations_status_idx ON public.donations (status, pickup_until);
CREATE TRIGGER donations_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- safe public-ish listing for verified collectors (hides exact address)
CREATE OR REPLACE FUNCTION public.list_open_donations()
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, food_type TEXT, quantity NUMERIC,
  unit TEXT, best_before DATE, pickup_from TIMESTAMPTZ, pickup_until TIMESTAMPTZ,
  city TEXT, approx_lat DOUBLE PRECISION, approx_lng DOUBLE PRECISION, created_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.title, d.description, d.food_type, d.quantity, d.unit, d.best_before,
         d.pickup_from, d.pickup_until, d.city, d.approx_lat, d.approx_lng, d.created_at
  FROM public.donations d
  WHERE d.status = 'open'
    AND d.pickup_until > now()
    AND public.has_role(auth.uid(), 'collector')
  ORDER BY d.pickup_until ASC;
$$;
REVOKE ALL ON FUNCTION public.list_open_donations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_open_donations() TO authenticated, service_role;

-- PICKUP CODES (server-only)
CREATE TABLE public.pickup_codes (
  donation_id UUID PRIMARY KEY REFERENCES public.donations(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_plain TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.pickup_codes TO service_role;
ALTER TABLE public.pickup_codes ENABLE ROW LEVEL SECURITY;

-- TIPS
CREATE TABLE public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tips TO anon, authenticated;
GRANT ALL ON public.tips TO service_role;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tips_public_read" ON public.tips FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.tip_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.tips(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tip_id)
);
GRANT SELECT, INSERT, DELETE ON public.tip_completions TO authenticated;
GRANT ALL ON public.tip_completions TO service_role;
ALTER TABLE public.tip_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tip_completions_own" ON public.tip_completions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.tips (title, body, category) VALUES
('Shop with a list','Plan meals for the week and buy only what those meals need. A list cuts impulse buys, the biggest source of forgotten food.','planning'),
('Do a fridge audit first','Before shopping, photograph your fridge shelves. You will stop buying the third jar of mustard and start cooking what is already there.','planning'),
('Store herbs like flowers','Trim the stems and stand soft herbs in a glass of water in the fridge, loosely covered. They last two weeks instead of three days.','storage'),
('Keep bananas away from everything','Bananas release ethylene that ripens neighbours fast. Store them alone, and separate apples from leafy greens too.','storage'),
('Freeze in portions, not blocks','Flat-freeze soups, sauces and mince in single-meal bags. Thawing is quicker and you only defrost what you will eat.','storage'),
('Learn the label difference','"Best before" is about quality, "use by" is about safety. Most best-before food is perfectly good days or weeks later.','planning'),
('Run a leftovers night','Set one evening a week where dinner comes entirely from what is already open in the fridge.','leftovers'),
('Make stock from scraps','Keep a freezer bag for onion ends, carrot tops and herb stems. When it is full, simmer it into stock.','leftovers'),
('Revive tired vegetables','Limp carrots, celery and greens usually just need 30 minutes in ice water. Soup and stir-fry hide the rest.','leftovers'),
('Buy the ugly produce','Misshapen fruit and veg tastes identical and is often discounted. Buying it keeps it out of the bin at the shop.','shopping'),
('Shop your freezer monthly','Set a monthly reminder to cook only from the freezer for a few days. Nothing gets buried and forgotten.','planning'),
('Use small plates at home','Serving smaller portions with the option of seconds sharply reduces plate scrapings, the hardest waste to reuse.','leftovers');