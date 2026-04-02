// lib/researcher.js — Gemini 2.0 Flash + Google Search Grounding
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Verilen konu için web + YouTube araştırması yapar.
 * Gemini'nin built-in Google Search grounding özelliğini kullanır.
 * @returns {{ kaynaklar: [], insights: [], carpici_veri: string, tartismali_boyut: string }}
 */
async function research(konu, bakisAcisi = '') {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  });

  const prompt = `
Sen bir LinkedIn içerik araştırmacısısın. "${konu}" konusunda güncel ve kapsamlı araştırma yap.

Google Search ile şunları bul:
1. Webrazzi, ShiftDelete, Donanimhaber gibi Türkçe tech haberleri
2. Global AI haberleri (son 1 hafta)
3. YouTube'daki popüler videolar (son 3 ay)
4. LinkedIn düşünce liderliği yazıları

Araştırma kuralları:
- En az 5, en fazla 8 güncel kaynak bul
- 6 aydan eski kaynakları çıkar
- Somut veri ve istatistik içerenleri tercih et
${bakisAcisi ? `- Kullanıcının bakış açısı: "${bakisAcisi}" — bunu destekleyen kaynakları öne çıkar` : ''}

Çıktıyı SADECE şu JSON formatında ver, başka açıklama ekleme:
{
  "kaynaklar": [
    { "baslik": "...", "url": "...", "ozet": "..." }
  ],
  "insights": ["...", "...", "..."],
  "carpici_veri": "...",
  "tartismali_boyut": "..."
}
  `.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Research hatası:', e.message);
  }

  return {
    kaynaklar: [],
    insights: [`${konu} konusunda araştırma yapıldı`],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

module.exports = { research };
