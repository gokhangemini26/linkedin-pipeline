// lib/researcher.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Verilen konu için web + YouTube araştırması yapar.
 * Claude'un web_search tool'unu kullanır.
 * @returns {{ kaynaklar: string[], ozet: string }}
 */
async function research(konu, bakisAcisi = '') {
  const prompt = `
Sen bir LinkedIn içerik araştırmacısısın. "${konu}" konusunda kapsamlı araştırma yap.

Şu kaynakları tara:
1. Webrazzi.com — Türkçe teknoloji haberleri
2. Global AI haberleri (son 1 hafta)
3. YouTube videoları (son 3 ay)
4. LinkedIn thought leadership yazıları

Araştırma kuralları:
- En az 5, en fazla 8 kaynak bul
- Her kaynaktan: başlık + URL + 2-3 cümle özet
- 6 aydan eski kaynakları çıkar
- Somut veri, istatistik veya alıntı içerenleri öncelikle seç

${bakisAcisi ? `Kullanıcının bakış açısı: "${bakisAcisi}" — bunu destekleyecek kaynakları ön plana çıkar.` : ''}

Araştırma sonunda şunu üret:
1. Kaynak listesi (başlık + URL + özet)
2. En güçlü 3-5 insight
3. LinkedIn postunda kullanılabilecek en çarpıcı 1 istatistik veya alıntı
4. Konunun tartışmalı veya ilgi çekici boyutu

Çıktıyı JSON formatında ver:
{
  "kaynaklar": [
    { "baslik": "...", "url": "...", "ozet": "..." }
  ],
  "insights": ["...", "...", "..."],
  "carpici_veri": "...",
  "tartismali_boyut": "..."
}
  `.trim();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Tüm text bloklarını birleştir
  const fullText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // JSON parse et
  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('JSON parse hatası:', e);
  }

  // Parse başarısız olursa ham metni döndür
  return {
    kaynaklar: [],
    insights: [fullText],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

module.exports = { research };
