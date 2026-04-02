// lib/researcher.js — Gemini 2.0 Flash + SerpAPI ile web araştırması
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Google Custom Search API ile web araştırması yapar
 */
async function webSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&dateRestrict=m6`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.items || []).map(item => ({
      baslik: item.title,
      url: item.link,
      ozet: item.snippet
    }));
  } catch (e) {
    console.error('Web search hatası:', e.message);
    return [];
  }
}

/**
 * Konu için araştırma yapar, Gemini ile analiz eder
 */
async function research(konu, bakisAcisi = '') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Paralel aramalar
  const [trResults, enResults, ytResults] = await Promise.all([
    webSearch(`${konu} yapay zeka 2025 site:webrazzi.com OR site:shiftdelete.net`),
    webSearch(`${konu} AI automation 2025`),
    webSearch(`${konu} AI youtube 2025`),
  ]);

  const tumKaynaklar = [...trResults, ...enResults, ...ytResults].slice(0, 8);

  // Kaynak yoksa Gemini'nin kendi bilgisiyle devam et
  const kaynakMetni = tumKaynaklar.length > 0
    ? tumKaynaklar.map(k => `- ${k.baslik}: ${k.ozet}`).join('\n')
    : `Güncel web araştırması yapılamadı. Kendi bilginle analiz et.`;

  const prompt = `
Sen bir LinkedIn içerik analistsin. "${konu}" konusunu analiz et.

${tumKaynaklar.length > 0 ? `BULUNAN KAYNAKLAR:\n${kaynakMetni}` : `Bu konuyu kendi bilginle analiz et:`}

${bakisAcisi ? `Kullanıcının bakış açısı: "${bakisAcisi}"` : ''}

Şunları çıkar ve SADECE JSON formatında ver:
{
  "kaynaklar": [{"baslik": "...", "url": "...", "ozet": "..."}],
  "insights": ["en önemli 3-5 insight"],
  "carpici_veri": "en çarpıcı istatistik veya gerçek",
  "tartismali_boyut": "konunun ilgi çekici veya tartışmalı boyutu"
}
  `.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Gerçek kaynak bilgilerini ekle
      if (tumKaynaklar.length > 0) parsed.kaynaklar = tumKaynaklar;
      return parsed;
    }
  } catch (e) {
    console.error('Researcher JSON parse hatası:', e);
  }

  return {
    kaynaklar: tumKaynaklar,
    insights: [`${konu} konusunda analiz yapıldı`],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

module.exports = { research };
