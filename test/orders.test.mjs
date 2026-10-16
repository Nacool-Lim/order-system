import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrder,requestKey,notification} from '../lib/order-core.mjs';
import {createOrdersHandler} from '../lib/orders-handler.mjs';
const body=()=>({name:'小王',unit:'公司',phone:'0912345678',address:'台北',time:'11:30',items:[{name:'白飯便當 (80元)',qty:2,price:1}],totalPrice:160});
test('server calculates actual menu prices and rejects tampered totals',()=>{
 assert.equal(validateOrder(body()).items[0].price,80);
 assert.throws(()=>validateOrder({...body(),totalPrice:2}));
 assert.throws(()=>validateOrder({...body(),items:[{name:'不存在',qty:1}]}));
 assert.throws(()=>validateOrder({...body(),items:[{name:'白飯便當 (80元)',qty:-1}]}));
 assert.throws(()=>validateOrder({...body(),time:'23:00'}));
});
test('new request keys remain distinct for intentional identical orders',()=>{
 const order=validateOrder(body());assert.notEqual(requestKey('aaaaaaaaaaaaaaaa',order),requestKey('bbbbbbbbbbbbbbbb',order));
 assert.throws(()=>requestKey({},order));
});
test('notification uses plain text, without enabling customer-supplied HTML',()=>{
 assert.match(notification({...validateOrder(body()),remark:'<b>你好</b>'},'20261016-0001'),/20261016-0001/);
});
function fixture({rpcError,notifyFailure=false}={}) {
 let rows=new Map(),claims=new Set(),sent=0,failed=0;
 const db={async rpc(name,args){if(rpcError)return {error:{message:rpcError}};if(!rows.has(args.p_request_id))rows.set(args.p_request_id,{orderId:'20261016-0001'});return {data:rows.get(args.p_request_id)};},from(table){if(table==='jokes')return {select:async()=>({data:[]})};let state,key;const query={update(value){state=value.status;return query},eq(column,value){if(column==='request_id')key=value;return query},async select(){if(claims.has(key))return {data:[]};claims.add(key);return {data:[{request_id:key}]}},then(resolve){if(state==='failed')failed++;return Promise.resolve({}).then(resolve)}};return query;}};
 const handler=createOrdersHandler({supabase:db,env:{PUSHOVER_API_TOKEN:'test',PUSHOVER_USER_KEY:'test'},log:()=>{},send:async()=>{sent++;if(notifyFailure)throw new Error('network');return {ok:true,json:async()=>({status:1})}}});
 return {handler,stats:()=>({orders:rows.size,sent,failed})};
}
async function invoke(handler){const res={status(code){this.code=code;return this},json(data){this.data=data;return this}};await handler({method:'POST',body:{...body(),requestId:'aaaaaaaaaaaaaaaa'}},res);return res;}
test('lost HTTP response and retry produce one order and one push',async()=>{
 const f=fixture();assert.equal((await invoke(f.handler)).code,200);assert.equal((await invoke(f.handler)).code,200);assert.deepEqual(f.stats(),{orders:1,sent:1,failed:0});
});
test('push failure preserves successful order and persists failure for review',async()=>{
 const f=fixture({notifyFailure:true});assert.equal((await invoke(f.handler)).code,200);assert.equal((await invoke(f.handler)).code,200);assert.deepEqual(f.stats(),{orders:1,sent:1,failed:1});
});
test('database failure or unavailable shop does not claim success or send a push',async()=>{
 for(const error of ['DB_DOWN','STORE_NOT_OPEN']){const f=fixture({rpcError:error});assert.notEqual((await invoke(f.handler)).code,200);assert.equal(f.stats().sent,0);}
});
