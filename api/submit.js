const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 요청입니다.' });
  }

  const { name, phone, email, status, concern } = req.body;

  if (!name || !phone || !email || !status || !concern) {
    return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
  }

  // ── 1. Supabase 저장 ──────────────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { error: dbError } = await supabase
    .from('consultations')
    .insert([{ name, phone, email, status, concern }]);

  if (dbError) {
    console.error('Supabase error:', dbError);
    return res.status(500).json({ error: 'DB 저장에 실패했습니다.', detail: dbError.message, code: dbError.code });
  }

  // ── 2. 관리자 알림 이메일 ─────────────────────────────
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: process.env.ADMIN_EMAIL,
      subject: `[새 상담 신청] ${name}님이 상담을 신청했습니다`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem;background:#f5f7fd;border-radius:12px;">
          <h2 style="color:#1a2744;border-bottom:2px solid #c9a84c;padding-bottom:0.75rem;">
            새 상담 신청이 접수되었습니다
          </h2>
          <table style="width:100%;border-collapse:collapse;margin-top:1rem;">
            <tr style="background:#fff;"><td style="padding:0.75rem 1rem;font-weight:700;width:30%;color:#2d4a8a;">이름</td><td style="padding:0.75rem 1rem;">${name}</td></tr>
            <tr style="background:#f0f5ff;"><td style="padding:0.75rem 1rem;font-weight:700;color:#2d4a8a;">연락처</td><td style="padding:0.75rem 1rem;">${phone}</td></tr>
            <tr style="background:#fff;"><td style="padding:0.75rem 1rem;font-weight:700;color:#2d4a8a;">이메일</td><td style="padding:0.75rem 1rem;">${email}</td></tr>
            <tr style="background:#f0f5ff;"><td style="padding:0.75rem 1rem;font-weight:700;color:#2d4a8a;">연애 현황</td><td style="padding:0.75rem 1rem;">${status}</td></tr>
            <tr style="background:#fff;"><td style="padding:0.75rem 1rem;font-weight:700;color:#2d4a8a;">고민</td><td style="padding:0.75rem 1rem;line-height:1.7;">${concern.replace(/\n/g, '<br>')}</td></tr>
          </table>
          <p style="margin-top:1.5rem;color:#718096;font-size:0.875rem;">
            48시간 이내 연락 부탁드립니다.
          </p>
        </div>
      `,
    }),
  }).catch(err => console.error('Admin email error:', err));

  // ── 3. 신청자 확인 이메일 ─────────────────────────────
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '상담 신청이 완료되었습니다 ✅',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
          <div style="background:linear-gradient(135deg,#1a2744,#2d4a8a);border-radius:12px;padding:2rem;color:#fff;text-align:center;margin-bottom:1.5rem;">
            <h2 style="margin:0 0 0.5rem;">상담 신청 완료!</h2>
            <p style="margin:0;color:#a0b4d4;">신청해 주셔서 감사합니다</p>
          </div>
          <p style="line-height:1.8;color:#2d3748;">안녕하세요, <strong>${name}</strong>님.</p>
          <p style="line-height:1.8;color:#2d3748;">
            1:1 연애심리상담 & 코칭 상담 신청이 정상적으로 접수되었습니다.<br>
            <strong>48시간 이내</strong>로 입력하신 연락처로 연락드리겠습니다.
          </p>
          <div style="background:#f5f7fd;border-radius:10px;padding:1.25rem 1.5rem;margin:1.5rem 0;border-left:4px solid #c9a84c;">
            <p style="margin:0;font-weight:700;color:#1a2744;margin-bottom:0.5rem;">신청 내용 요약</p>
            <p style="margin:0.25rem 0;color:#4a5568;font-size:0.9rem;">연애 현황: ${status}</p>
            <p style="margin:0.25rem 0;color:#4a5568;font-size:0.9rem;">고민: ${concern.substring(0, 80)}${concern.length > 80 ? '...' : ''}</p>
          </div>
          <p style="color:#718096;font-size:0.875rem;line-height:1.7;">
            궁금한 점이 있으시면 언제든지 연락 주세요.<br>
            좋은 하루 보내세요!
          </p>
        </div>
      `,
    }),
  }).catch(err => console.error('Applicant email error:', err));

  return res.status(200).json({ success: true });
};
