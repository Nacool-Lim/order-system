import { createHash } from 'node:crypto';
const prices = new Map();
for (const name of ['白飯便當','五穀飯便當','壽司便當','米粉便當','炒飯便當','炒麵便當','碗粿便當']) {
  for (const price of [70,80]) prices.set(`${name} (${price}元)`, price);
}
for (const [name,price] of [['冰糖白木耳',30],['麻辣豆腐湯',40],['當歸湯',40],['味噌湯',30],['特製餐點(填選後，進入備註欄填寫內容)',0]]) prices.set(name,price);
export function validateOrder(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new Error('餐點資料無效');
  const order = {};
  for (const [key,limit] of Object.entries({name:100,unit:200,phone:50,address:500,time:5,remark:2000})) {
    const value = body[key] ?? (key === 'name' ? '訪客' : '');
    if (typeof value !== 'string' || value.length > limit) throw new Error('訂單欄位無效');
    order[key] = value.trim();
  }
  if (!order.unit || !order.phone || !order.address || !/^1[012]:[0-5]0$/.test(order.time) || order.time < '10:30' || order.time > '12:30') throw new Error('請確認聯絡資料與送餐時間');
  order.name ||= '訪客';
  order.items = body.items.map(item => {
    if (!item || !prices.has(item.name) || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 999) throw new Error('餐點或數量無效');
    return {name:item.name,qty:item.qty,price:prices.get(item.name)};
  });
  order.totalPrice = order.items.reduce((sum,item) => sum + item.price * item.qty, 0);
  if (body.totalPrice !== order.totalPrice) throw new Error('餐點價格已變動，請重新整理頁面');
  return order;
}
export function fingerprint(order) { return createHash('sha256').update(JSON.stringify(order)).digest('hex'); }
export function requestKey(value, order) {
  if (value == null) return `legacy:${fingerprint(order)}:${Math.floor(Date.now()/60000)}`;
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(value)) throw new Error('訂單識別碼無效');
  return value;
}
export function notification(order, orderId) {
  const items = order.items.map(item => `🍱 ${item.qty} x ${item.name}`).join('\n');
  return `🆔 單號: ${orderId}\n👤 人名: ${order.name}\n📞 電話: ${order.phone}\n🏢 單位: ${order.unit}\n📍 地址: ${order.address}\n⏰ 時間: ${order.time}\n----------------\n${items}\n----------------\n💰 金額: $${order.totalPrice}\n💬 備註: ${order.remark || '無'}`;
}
