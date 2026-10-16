import { createClient } from '@supabase/supabase-js';
import { createOrdersHandler } from '../lib/orders-handler.mjs';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default createOrdersHandler({supabase});
