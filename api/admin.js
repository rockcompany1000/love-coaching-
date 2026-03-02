const { createClient } = require('@supabase/supabase-js');

function authCheck(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return token === process.env.ADMIN_PASSWORD;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 비밀번호 검증 ──────────────────────────────────────
  if (!authCheck(req)) {
    return res.status(401).json({ error: '인증 실패' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // ── GET: 목록 조회 ──────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  // ── POST: 상태 변경 ─────────────────────────────────────
  if (req.method === 'POST') {
    const rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });

    let body;
    try { body = JSON.parse(rawBody); } catch { body = req.body || {}; }

    const { id, status } = body;
    if (!id || !status) return res.status(400).json({ error: '필수 항목 누락' });

    const { error } = await supabase
      .from('consultations')
      .update({ status })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: '허용되지 않는 요청' });
};
