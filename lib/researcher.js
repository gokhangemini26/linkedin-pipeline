// lib/researcher.js — Google Custom Search + Groq analizi
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * Google Custom Search API ile web araştırması
 */
async function googleSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&dateRestrict=m3&lr=lang_tr|lang_en`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error('Google Search API hatası:', data.error.message);
      return [];
    }
    return (data.items || []).map(item => ({
      baslik: item.title,
      url: item.link,
      ozet: item.snippet,
    }));
  } catch (e) {
    console.error('Google Search fetch hatası:', e.message);
    return [];
  }
}

/**
 * Groq ile bulunan kaynakları analiz et
 */
async function analyzeWithGroq(konu, bakisAcisi, kaynaklar) {
  const kaynakMetni = kaynaklar.length > 0
    ? kaynaklar.map((k, i) => `${i + 1}. ${k.baslik}\n   ${k.ozet}`).join('\n')
    : 'Web araştırması yapılamadı, kendi bilginle analiz et.';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: 'Sen bir LinkedIn içerik stratejistisin. Türkçe yanıt ver. Sadece JSON formatında çıktı üret, başka hiçbir şey yazma.',
        },
        {
          role: 'user',
          content: `"${konu}" konusunu analiz et.
${bakisAcisi ? `Kullanıcının bakış açısı: "${bakisAcisi}"` : ''}

BULUNAN KAYNAKLAR:
${kaynakMetni}

Şu JSON formatında analiz üret:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "carpici_veri": "LinkedIn postunda kullanılabilecek en çarpıcı istatistik veya gerçek",
  "tartismali_boyut": "konunun en ilgi çekici veya tartışmalı boyutu"
}`,
        },
      ],
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Analiz JSON parse hatası:', e);
  }

  return {
    insights: [`${konu} konusunda önemli gelişmeler yaşanıyor`],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

/**
 * Ana araştırma fonksiyonu
 */
async function research(konu, bakisAcisi = '') {
  // Paralel aramalar — TR + EN + YouTube
  const [trSonuc, enSonuc, ytSonuc] = await Promise.all([
    googleSearch(`${konu} yapay zeka 2025`),
    googleSearch(`${konu} AI automation 2025`),
    googleSearch(`${konu} site:youtube.com 2025`),
  ]);

  // Tekrar edenleri çıkar, max 8 kaynak
  const seen = new Set();
  const kaynaklar = [...trSonuc, ...enSonuc, ...ytSonuc]
    .filter(k => {
      if (seen.has(k.url)) return false;
      seen.add(k.url);
      return true;
    })
    .slice(0, 8);

  // Groq ile analiz
  const analiz = await analyzeWithGroq(konu, bakisAcisi, kaynaklar);

  return { kaynaklar, ...analiz };
}

module.exports = { research };
