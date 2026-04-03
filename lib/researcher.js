// lib/researcher.js — Tavily + Groq + Skill Memory (Self-Evolving)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const memory = require('./skill-memory');

async function tavilySearch(query, maxResults = 5, days = 1) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: 'advanced', days }),
    });
    const data = await res.json();
    if (data.error) return [];
    return (data.results || []).map(r => ({ baslik: r.title, url: r.url, ozet: r.content?.slice(0, 200) || '' }));
  } catch (e) { return []; }
}

function bugunTarihi() {
  return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function searchWithFallback(konu) {
  const bugun = bugunTarihi();
  const sorgular = [
    `${konu} güncel haber ${bugun}`,
    `${konu} AI son gelişmeler`,
    `${konu} iş dünyası son dakika`,
  ];

  for (const { days, label } of [{ days: 1, label: 'son 24 saat' }, { days: 2, label: 'son 48 saat' }, { days: 7, label: 'son 7 gün' }]) {
    const tumSonuclar = (await Promise.all(sorgular.map(s => tavilySearch(s, 4, days)))).flat();
    const seen = new Set();
    const kaynaklar = tumSonuclar.filter(k => { if (seen.has(k.url)) return false; seen.add(k.url); return true; }).slice(0, 8);
    if (kaynaklar.length >= 3) return { kaynaklar, aralikLabel: label };
  }
  return { kaynaklar: [], aralikLabel: 'bulunamadı' };
}

async function analyzeWithGroq(konu, bakisAcisi, kaynaklar, aralikLabel, pastResearch) {
  const bugun = bugunTarihi();
  const kaynakMetni = kaynaklar.length > 0
    ? kaynaklar.map((k, i) => `${i + 1}. ${k.baslik}\n   ${k.ozet}`).join('\n')
    : 'Güncel kaynak bulunamadı.';

  // Geçmiş başarılı insight'ları context'e ekle
  const pastInsights = pastResearch?.insights?.slice(0, 3) || [];
  const pastContext = pastInsights.length > 0
    ? `\nGEÇMİŞ BAŞARILI INSIGHTS (${pastResearch.runs} önceki çalışmadan):\n${pastInsights.map(i => `• ${i}`).join('\n')}`
    : '';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: `Sen bir LinkedIn içerik stratejistisin. Bugün ${bugun}. Türkçe yanıt ver. Sadece JSON çıktı üret.`,
        },
        {
          role: 'user',
          content: `"${konu}" konusunu analiz et.
${bakisAcisi ? `Bakış açısı: "${bakisAcisi}"` : ''}
${pastContext}

${aralikLabel.toUpperCase()} KAYNAKLAR:
${kaynakMetni}

JSON formatında ver:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "carpici_veri": "en çarpıcı güncel istatistik",
  "tartismali_boyut": "en ilgi çekici tartışmalı boyut"
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
  } catch (e) {}
  return { insights: [`${konu} konusunda güncel gelişmeler var`], carpici_veri: '', tartismali_boyut: '' };
}

async function research(konu, bakisAcisi = '') {
  const startTime = Date.now();
  try {
    // 🧠 Geçmiş araştırmayı kontrol et
    const pastResearch = await memory.getPastResearch(konu);

    const { kaynaklar, aralikLabel } = await searchWithFallback(konu);
    const analiz = await analyzeWithGroq(konu, bakisAcisi, kaynaklar, aralikLabel, pastResearch);
    const result = { kaynaklar, aralikLabel, ...analiz };

    // 💾 Bu araştırmayı hafızaya kaydet
    await memory.saveResearchResult(konu, result);
    await memory.saveSkillSuccess('researcher', Date.now() - startTime);

    return result;
  } catch (e) {
    await memory.saveSkillError('researcher', e, konu);
    throw e;
  }
}

module.exports = { research };
