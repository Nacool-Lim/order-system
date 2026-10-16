import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerClient} from '../lib/server-client.mjs';
const jwt = role => Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.test-signature';
test('rejects browser credentials accidentally configured as a server key',()=>{
 for(const key of [jwt('anon'),jwt('authenticated'),'sb_publishable_local_test']) assert.throws(()=>createServerClient({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:key}));
 assert.ok(createServerClient({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:jwt('service_role')}));
});
