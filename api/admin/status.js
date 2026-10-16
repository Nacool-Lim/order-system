import { createServerClient } from '../../lib/server-client.mjs';

const supabase = createServerClient();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: 查詢目前營業狀態
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('system_settings').select('status').eq('id', 1).single();
      if (error || !data || !['open', 'stop', 'closed'].includes(data.status)) throw new Error('Status unavailable');
      return res.status(200).json({ status: data.status });
    } catch (err) {
      return res.status(500).json({ error: '服務暫時無法使用' });
    }
  }

  // POST: 管理員切換營業狀態
  if (req.method === 'POST') {
    const { status, adminPassword } = req.body || {};
    
    // 管理員密碼必須由環境變數設定。
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword) return res.status(503).json({ error: '管理功能尚未設定' });
    if (typeof adminPassword !== 'string' || adminPassword !== expectedPassword) {
      return res.status(401).json({ error: '管理員密碼錯誤' });
    }

    if (!['open', 'stop', 'closed'].includes(status)) {
      return res.status(400).json({ error: '狀態名稱無效' });
    }

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ status, updated_at: new Date() })
        .eq('id', 1);

      if (error) throw error;

      return res.status(200).json({ success: true, status });
    } catch (err) {
      return res.status(500).json({ error: '服務暫時無法使用' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
