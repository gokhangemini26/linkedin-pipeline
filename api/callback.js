// api/callback.js
// LinkedIn OAuth callback — code'u alıp access token'a çevirir

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`
      <h2>❌ LinkedIn OAuth Hatası</h2>
      <p><b>${error}</b>: ${error_description}</p>
    `);
  }

  if (!code) {
    return res.status(400).send('<h2>❌ Code parametresi eksik</h2>');
  }

  try {
    // Code → Access Token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://linkedin-pipeline.vercel.app/api/callback',
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      // Person ID al
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json();

      return res.status(200).send(`
        <html>
        <body style="font-family:monospace; padding:40px; background:#0f0f0f; color:#00ff88;">
          <h2>✅ LinkedIn Bağlantısı Başarılı!</h2>
          <p>Aşağıdaki değerleri Vercel Environment Variables'a ekle:</p>
          <hr style="border-color:#333"/>
          <p><b>LINKEDIN_ACCESS_TOKEN:</b><br/>
          <code style="background:#1a1a1a; padding:8px; display:block; margin:8px 0; word-break:break-all;">${tokenData.access_token}</code></p>
          <p><b>LINKEDIN_PERSON_ID:</b><br/>
          <code style="background:#1a1a1a; padding:8px; display:block; margin:8px 0;">${profile.sub || 'Bulunamadı'}</code></p>
          <p><b>Token süresi:</b> ${Math.round(tokenData.expires_in / 86400)} gün</p>
          <hr style="border-color:#333"/>
          <p style="color:#888;">Bu sayfayı kapat ve Vercel'e dön.</p>
        </body>
        </html>
      `);
    } else {
      return res.status(400).send(`
        <h2>❌ Token alınamadı</h2>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      `);
    }
  } catch (err) {
    return res.status(500).send(`<h2>❌ Sunucu hatası</h2><pre>${err.message}</pre>`);
  }
}
