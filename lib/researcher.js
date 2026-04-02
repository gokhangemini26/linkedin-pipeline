// lib/researcher.js — Gemini 2.0 Flash + Google Search Grounding
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Verilen konu için web + YouTube araştırması yapar.
 * Gemini'nin built-in Google Search grounding'ını kullanır.
 * @returns {{ kaynaklar: Array, insights: Array, carpici_veri: string, tartismali_boyut: string }}
 */
async function research(konu, bakisAcisi = '') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  });

  const prompt = `
Sen bir LinkedIn içerik araştırmacısısın. "${konu}" konusunda kapsamlı araştırma yap.

Google Search kullanarak şu kaynakları tara:
1. Webrazzi.com — Türkçe teknoloji haberleri
2. Son 1 haftanın global AI haberleri
3. YouTube videoları (son 3 ay)
4. LinkedIn thought leadership yazıları

Araştırma kuralları:
- En az 5, en fazla 8 güncel kaynak bul
- 6 aydan eski kaynakları çıkar
- Somut veri, istatistik veya alıntı içerenleri seç
${bakisAcisi ? `- Kullanıcının bakış açısı: "${bakisAcisi}" — bunu destekleyecek kaynakları ön plana çıkar.` : ''}

Araştırma sonunda SADECE şu JSON'u üret, başka açıklama ekleme:
{
  "kaynaklar": [
    { "baslik": "...", "url": "...", "ozet": "..." }
  ],
  "insights": ["...", "...", "..."],
  "carpici_veri": "...",
  "tartismali_boyut": "..."
}
  `.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Researcher JSON parse hatası:', e);
  }

  // Fallback
  return {
    kaynaklar: [],
    insights: [text.slice(0, 500)],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

module.exports = { research };
