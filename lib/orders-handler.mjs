import { validateOrder, fingerprint, requestKey, notification } from './order-core.mjs';
export function createOrdersHandler({supabase, env = process.env, send = fetch, log = console.error}) {
 return async (req,res) => {
  if (req.method !== 'POST') return res.status(405).json({status:'error',message:'Method not allowed'});
  let order,key;
  try { order=validateOrder(req.body); key=requestKey(req.body.requestId,order); }
  catch (error) { return res.status(400).json({status:'error',message:error.message}); }
  // Fail before accepting new orders if notification credentials were not provisioned.
  if (!env.PUSHOVER_API_TOKEN || !env.PUSHOVER_USER_KEY) return res.status(503).json({status:'error',message:'訂單服務暫時無法使用，請聯絡店家'});
  let record;
  try {
   const {data,error}=await supabase.rpc('place_order_v2',{p_request_id:key,p_fingerprint:fingerprint(order),p_order:order});
   if(error) throw error;
   if (!data?.orderId) throw new Error('Missing order receipt');
   record=data;
  } catch(error) {
   log('Order submission failed',error.code || 'unknown');
   const known=error.message==='STORE_NOT_OPEN' || error.message==='REQUEST_CONFLICT';
   return res.status(known?409:503).json({status:'error',message:known?(error.message==='STORE_NOT_OPEN'?'目前店家暫停接單。':'訂單內容已變更，請重新送出。'):'訂單服務暫時無法使用，請稍後再試'});
  }
  // The database claims delivery once. A lost response must never create another order.
  try {
   const {data:claim,error}=await supabase.from('order_notifications').update({status:'sending',updated_at:new Date().toISOString()}).eq('request_id',key).eq('status','pending').select('request_id');
   if(error) throw error;
   if(claim?.length) {
    let status='failed';
    try {
     const response=await send('https://api.pushover.net/1/messages.json',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:env.PUSHOVER_API_TOKEN,user:env.PUSHOVER_USER_KEY,title:`🥗 新訂單 #${record.orderId.slice(-4)}`,message:notification(order,record.orderId),sound:'cashregister'})});
     const result=await response.json();
     if(!response.ok || result.status!==1) throw new Error('Pushover rejected notification');
     status='sent';
    } catch { log('Notification requires review',record.orderId); }
    const {error:updateError}=await supabase.from('order_notifications').update({status,updated_at:new Date().toISOString()}).eq('request_id',key);
    if(updateError) log('Notification status update failed',record.orderId);
   }
  } catch { log('Notification delivery requires review',record.orderId); }
  let joke='';
  try {const {data}=await supabase.from('jokes').select('content'); if(data?.length) joke=data[Math.floor(Math.random()*data.length)].content; } catch { /* Optional content cannot invalidate an accepted order. */ }
  return res.status(200).json({status:'success',message:'訂單寫入成功',orderId:record.orderId,joke});
 };
}
