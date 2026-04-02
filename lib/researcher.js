// lib/researcher.js — Tavily API + Groq analizi
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * Tavily ile tek arama — domain filtresi YOK, tüm web
 */
async function tavilySearch(query, maxResults = 5) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
        include_answer: false,
        // Domain filtresi YOK — tüm web taranıyor
      }),
    });

    const data = await res.json();
    if (data.error) { console.error('Tavily hatası:', data.error); return []; }

    return (data.results || []).map(r => ({
      baslik: r.title,
      url: r.url,
      ozet: r.content?.slice(0, 200) || '',
    }));
  } catch (e) {
    console.error('Tavily fetch hatası:', e.message);
    return [];
  }
}

/**
 * Groq ile analiz
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
          content: 'Sen bir LinkedIn içerik stratejistisin. Türkçe yanıt ver. Sadece JSON formatında çıktı üret.',
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
  "carpici_veri": "en çarpıcı istatistik veya gerçek",
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
  } catch (e) { console.error('Analiz parse hatası:', e); }

  return { insights: [`${konu} konusunda önemli gelişmeler var`], carpici_veri: '', tartismali_boyut: '' };
}

/**
 * Ana araştırma — 3 farklı sorgu, paralel
 */
async function research(konu, bakisAcisi = '') {
  const [r1, r2, r3] = await Promise.all([
    tavilySearch(`${konu} yapay zeka Türkiye 2025`, 4),
    tavilySearch(`${konu} AI trends 2025`, 4),
    tavilySearch(`${konu} iş dünyası etkileri`, 3),
  ]);

  // Tekrarları temizle
  const seen = new Set();
  const kaynaklar = [...r1, ...r2, ...r3]
    .filter(k => {
      if (seen.has(k.url)) return false;
      seen.add(k.url);
      return true;
    })
    .slice(0, 8);

  const analiz = await analyzeWithGroq(konu, bakisAcisi, kaynaklar);
  return { kaynaklar, ...analiz };
}

module.exports = { research };
