// lib/researcher.js — Tavily API + güncel haber öncelikli arama
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * Tavily araması — days parametresiyle zaman filtresi
 */
async function tavilySearch(query, maxResults = 5, days = 1) {
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
        days, // 1 = son 24 saat, 2 = son 48 saat
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
 * Güncel haber araması:
 * 1. Son 24 saatte ara → en az 3 sonuç varsa kullan
 * 2. Yeterli değilse 48 saate genişlet
 * 3. Hala yeterli değilse son 7 gün
 */
async function searchWithFallback(konu, bakisAcisi) {
  const sorgular = [
    `${konu} yapay zeka Türkiye`,
    `${konu} AI 2025`,
    `${konu} iş dünyası`,
  ];

  // Aşama 1: Son 24 saat
  console.log('🔍 Son 24 saat aranıyor...');
  let tumSonuclar = (await Promise.all(
    sorgular.map(s => tavilySearch(s, 4, 1))
  )).flat();

  const seen = new Set();
  let kaynaklar = tumSonuclar.filter(k => {
    if (seen.has(k.url)) return false;
    seen.add(k.url);
    return true;
  });

  if (kaynaklar.length >= 3) {
    console.log(`✅ 24 saatte ${kaynaklar.length} kaynak bulundu`);
    return { kaynaklar: kaynaklar.slice(0, 8), aralikLabel: 'son 24 saat' };
  }

  // Aşama 2: Son 48 saat
  console.log(`⚠️ 24 saatte sadece ${kaynaklar.length} kaynak. 48 saate genişletiliyor...`);
  tumSonuclar = (await Promise.all(
    sorgular.map(s => tavilySearch(s, 4, 2))
  )).flat();

  seen.clear();
  kaynaklar = tumSonuclar.filter(k => {
    if (seen.has(k.url)) return false;
    seen.add(k.url);
    return true;
  });

  if (kaynaklar.length >= 3) {
    console.log(`✅ 48 saatte ${kaynaklar.length} kaynak bulundu`);
    return { kaynaklar: kaynaklar.slice(0, 8), aralikLabel: 'son 48 saat' };
  }

  // Aşama 3: Son 7 gün
  console.log(`⚠️ 48 saatte sadece ${kaynaklar.length} kaynak. Son 7 güne genişletiliyor...`);
  tumSonuclar = (await Promise.all(
    sorgular.map(s => tavilySearch(s, 4, 7))
  )).flat();

  seen.clear();
  kaynaklar = tumSonuclar.filter(k => {
    if (seen.has(k.url)) return false;
    seen.add(k.url);
    return true;
  });

  console.log(`📅 7 günde ${kaynaklar.length} kaynak bulundu`);
  return { kaynaklar: kaynaklar.slice(0, 8), aralikLabel: 'son 7 gün' };
}

/**
 * Groq ile analiz
 */
async function analyzeWithGroq(konu, bakisAcisi, kaynaklar) {
  const kaynakMetni = kaynaklar.length > 0
    ? kaynaklar.map((k, i) => `${i + 1}. ${k.baslik}\n   ${k.ozet}`).join('\n')
    : 'Web araştırması yapılamadı, kendi güncel bilginle analiz et.';

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

GÜNCEL KAYNAKLAR:
${kaynakMetni}

Şu JSON formatında analiz üret:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "carpici_veri": "en çarpıcı güncel istatistik veya gerçek",
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

  return { insights: [`${konu} konusunda güncel gelişmeler var`], carpici_veri: '', tartismali_boyut: '' };
}

/**
 * Ana araştırma fonksiyonu
 */
async function research(konu, bakisAcisi = '') {
  const { kaynaklar, aralikLabel } = await searchWithFallback(konu, bakisAcisi);
  const analiz = await analyzeWithGroq(konu, bakisAcisi, kaynaklar);
  return { kaynaklar, aralikLabel, ...analiz };
}

module.exports = { research };
