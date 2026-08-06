-- Organization join codes are permanent after create.
-- Admins may edit name, journey, leadership, etc. - never the code.

CREATE OR REPLACE FUNCTION public.prevent_organization_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Organization code cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_organization_code_change ON public.organizations;

CREATE TRIGGER trg_prevent_organization_code_change
  BEFORE UPDATE OF code ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_organization_code_change();
