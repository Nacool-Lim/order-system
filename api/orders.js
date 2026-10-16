import { createServerClient } from '../lib/server-client.mjs';
import { createOrdersHandler } from '../lib/orders-handler.mjs';
const supabase = createServerClient();
export default createOrdersHandler({supabase});
