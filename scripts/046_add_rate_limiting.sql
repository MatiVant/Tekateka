-- Límite de solicitudes sin un servicio externo.
-- Lo usa el backend con la service role. Hasta que no se ejecute este script,
-- la aplicación deja pasar las solicitudes (no frena compras).
-- Correrlo una vez en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.rate_limit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint_time
  ON public.rate_limit_requests (identifier, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at
  ON public.rate_limit_requests (created_at);

ALTER TABLE public.rate_limit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_no_public_access" ON public.rate_limit_requests;
CREATE POLICY "rate_limit_no_public_access" ON public.rate_limit_requests
  FOR ALL
  USING (false);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count integer;
  v_oldest timestamptz;
BEGIN
  IF p_identifier IS NULL
    OR length(trim(p_identifier)) = 0
    OR p_endpoint IS NULL
    OR p_window_seconds IS NULL
    OR p_window_seconds <= 0
    OR p_max_requests IS NULL
    OR p_max_requests <= 0
  THEN
    allowed := true;
    remaining := COALESCE(p_max_requests, 0);
    reset_at := now();
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_identifier || '|' || p_endpoint, 0));

  SELECT count(*)::integer, min(created_at)
    INTO v_count, v_oldest
  FROM public.rate_limit_requests
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND created_at >= v_window_start;

  IF v_count >= p_max_requests THEN
    allowed := false;
    remaining := 0;
    reset_at := COALESCE(v_oldest, now()) + make_interval(secs => p_window_seconds);
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_requests (identifier, endpoint)
  VALUES (p_identifier, p_endpoint);

  allowed := true;
  remaining := GREATEST(p_max_requests - v_count - 1, 0);
  reset_at := now() + make_interval(secs => p_window_seconds);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_requests
  WHERE created_at < now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_requests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_requests() TO service_role;

COMMENT ON TABLE public.rate_limit_requests IS 'Cuenta solicitudes por IP y endpoint para frenar abuso sin un servicio pago.';
COMMENT ON FUNCTION public.consume_rate_limit(text, text, integer, integer) IS 'Registra una solicitud y dice si todavía entra en el cupo de la ventana.';
COMMENT ON FUNCTION public.cleanup_rate_limit_requests() IS 'Borra conteos de más de 24 horas. La llama el cron diario.';
