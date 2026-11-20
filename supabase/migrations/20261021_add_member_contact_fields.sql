-- 20261021_add_member_contact_fields.sql
--
-- Member contact capture — the 30% member discount is also an acquisition
-- offer, so signing up should leave us holding a usable CONTACT, not just an
-- email: name, email, PHONE NUMBER and ADDRESS.
--
-- The signup form writes these into the Supabase auth user metadata (services/
-- auth.ts > signUpWithEmail). This migration gives `profiles` columns to hold
-- them and keeps the two in sync, so the admin customer view can read a
-- contactable record without reaching into auth.users.
--
-- All columns are NULLABLE and additive: no existing row changes, and a
-- profile with no contact data keeps working exactly as before.

ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS phone            TEXT,
    ADD COLUMN IF NOT EXISTS address_line1    TEXT,
    ADD COLUMN IF NOT EXISTS address_city     TEXT,
    ADD COLUMN IF NOT EXISTS address_state    TEXT,
    ADD COLUMN IF NOT EXISTS address_zip      TEXT,
    ADD COLUMN IF NOT EXISTS address_country  TEXT;

COMMENT ON COLUMN public.profiles.phone IS 'Member contact phone number, captured at signup.';
COMMENT ON COLUMN public.profiles.address_line1 IS 'Member address line 1, captured at signup.';
COMMENT ON COLUMN public.profiles.address_city IS 'Member address city, captured at signup.';
COMMENT ON COLUMN public.profiles.address_state IS 'Member address state, captured at signup.';
COMMENT ON COLUMN public.profiles.address_zip IS 'Member address ZIP, captured at signup.';
COMMENT ON COLUMN public.profiles.address_country IS 'Member address country, captured at signup.';

-- ---------------------------------------------------------------------------
-- Keep the profile row in step with the auth metadata.
--
-- The profile row is created by a trigger on auth.users; this trigger runs
-- alongside it (and on every later profile update) and copies the contact
-- fields across. Metadata is the source of truth for what was captured at
-- signup, but an EMPTY metadata value never blanks a field that is already
-- on the profile — so a profile edited later is not silently wiped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_sync_contact_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    meta jsonb;
BEGIN
    SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = NEW.id;
    IF meta IS NOT NULL THEN
        NEW.phone           := COALESCE(NULLIF(BTRIM(meta ->> 'phone'), ''), NEW.phone);
        NEW.address_line1   := COALESCE(NULLIF(BTRIM(meta ->> 'address_line1'), ''), NEW.address_line1);
        NEW.address_city    := COALESCE(NULLIF(BTRIM(meta ->> 'address_city'), ''), NEW.address_city);
        NEW.address_state   := COALESCE(NULLIF(BTRIM(meta ->> 'address_state'), ''), NEW.address_state);
        NEW.address_zip     := COALESCE(NULLIF(BTRIM(meta ->> 'address_zip'), ''), NEW.address_zip);
        NEW.address_country := COALESCE(NULLIF(BTRIM(meta ->> 'address_country'), ''), NEW.address_country);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_contact ON public.profiles;
CREATE TRIGGER profiles_sync_contact
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_sync_contact_from_auth();

-- ---------------------------------------------------------------------------
-- Backfill: members who signed up before this migration may already have
-- phone/address in their auth metadata.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'auth' AND table_name = 'users') THEN
        UPDATE public.profiles p
        SET phone           = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'phone'), ''), p.phone),
            address_line1   = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'address_line1'), ''), p.address_line1),
            address_city    = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'address_city'), ''), p.address_city),
            address_state   = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'address_state'), ''), p.address_state),
            address_zip     = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'address_zip'), ''), p.address_zip),
            address_country = COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'address_country'), ''), p.address_country)
        FROM auth.users u
        WHERE u.id = p.id
          AND u.raw_user_meta_data IS NOT NULL
          AND (u.raw_user_meta_data ?| ARRAY['phone','address_line1','address_city','address_state','address_zip','address_country']);
    END IF;
END $$;
