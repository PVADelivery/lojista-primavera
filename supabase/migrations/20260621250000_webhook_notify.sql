CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_driver_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Somente dispara se status for pending ou broadcasted
  IF NEW.status IN ('pending', 'broadcasted') THEN
    PERFORM net.http_post(
      url:='https://trxjzszcgoxaujfobrdk.supabase.co/functions/v1/notify-driver',
      body:=jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE null END
      ),
      headers:=jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS "Notificar_Entregador" ON "public"."deliveries";

CREATE TRIGGER "Notificar_Entregador"
AFTER INSERT OR UPDATE ON "public"."deliveries"
FOR EACH ROW
EXECUTE FUNCTION notify_driver_trigger();
