CREATE OR REPLACE FUNCTION public.snapshot_site_content_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.cms_versions (section_key, content, updated_by, note)
  VALUES (NEW.section_key, NEW.content, NEW.updated_by, 'auto-snapshot on save');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_content_version ON public.site_content;
CREATE TRIGGER trg_site_content_version
AFTER INSERT OR UPDATE ON public.site_content
FOR EACH ROW EXECUTE FUNCTION public.snapshot_site_content_version();