-- Apply only after inspecting the existing production schema and taking a DB backup.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_request_id_unique ON public.orders(request_id);
CREATE TABLE IF NOT EXISTS public.order_requests (
 request_id text PRIMARY KEY, fingerprint text NOT NULL, order_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.order_daily_sequences (
 order_date date PRIMARY KEY, sequence bigint NOT NULL CHECK(sequence > 0)
);
CREATE TABLE IF NOT EXISTS public.order_notifications (
 request_id text PRIMARY KEY REFERENCES public.order_requests(request_id),
 order_id text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_daily_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_requests,public.order_daily_sequences,public.order_notifications FROM anon,authenticated;
GRANT ALL ON public.order_requests,public.order_daily_sequences,public.order_notifications TO service_role;
CREATE OR REPLACE FUNCTION public.place_order_v2(p_request_id text,p_fingerprint text,p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
 previous public.order_requests%ROWTYPE;
 business_date date := (now() AT TIME ZONE 'Asia/Taipei')::date;
 next_number bigint;
 new_id text;
 store_status text;
BEGIN
 -- Serialize retries of the same request, including simultaneous requests.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id,0));
 SELECT * INTO previous FROM public.order_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF previous.fingerprint <> p_fingerprint THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN jsonb_build_object('orderId',previous.order_id,'duplicate',true);
 END IF;
 SELECT status INTO store_status FROM public.system_settings WHERE id=1 FOR SHARE;
 IF store_status IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'STORE_NOT_OPEN'; END IF;
 -- Seed from existing daily IDs, preserving numbering on the migration day.
 INSERT INTO public.order_daily_sequences(order_date,sequence)
 SELECT business_date,coalesce(max(substring(order_id from 10)::bigint),0)+1 FROM public.orders
 WHERE order_id ~ ('^'||to_char(business_date,'YYYYMMDD')||'-[0-9]+$')
 ON CONFLICT(order_date) DO UPDATE SET sequence=public.order_daily_sequences.sequence+1
 RETURNING sequence INTO next_number;
 new_id:=to_char(business_date,'YYYYMMDD')||'-'||lpad(next_number::text,greatest(4,length(next_number::text)),'0');
 INSERT INTO public.orders(order_id,request_id,unit,name,phone,address,delivery_time,items_text,items_json,total_price,remark)
 VALUES(new_id,p_request_id,p_order->>'unit',p_order->>'name',p_order->>'phone',p_order->>'address',p_order->>'time',
 (SELECT string_agg('🍱 '||(i->>'qty')||' x '||(i->>'name'),E'\n') FROM jsonb_array_elements(p_order->'items') i),
 p_order->'items',(p_order->>'totalPrice')::numeric,p_order->>'remark');
 INSERT INTO public.order_requests VALUES(p_request_id,p_fingerprint,new_id);
 INSERT INTO public.order_notifications(request_id,order_id) VALUES(p_request_id,new_id);
 RETURN jsonb_build_object('orderId',new_id,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.place_order_v2(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_v2(text,text,jsonb) TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jokes ENABLE ROW LEVEL SECURITY;
-- The browser only queries status for id=1. Order and joke access is server-side.
REVOKE ALL ON public.orders,public.jokes,public.system_settings FROM anon,authenticated;
GRANT SELECT(id,status) ON public.system_settings TO anon,authenticated;
CREATE POLICY customer_read_store_status ON public.system_settings
 FOR SELECT TO anon,authenticated USING (id=1);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders,public.system_settings,public.jokes TO service_role;
COMMIT;
