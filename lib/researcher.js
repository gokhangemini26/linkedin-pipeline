// lib/researcher.js — Groq (Llama 3.1 70B) ile araştırma ve analiz
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function groqChat(messages, maxTokens = 2000) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function research(konu, bakisAcisi = '') {
  const text = await groqChat([
    {
      role: 'system',
      content: 'Sen bir LinkedIn içerik araştırmacısısın. Türkçe yanıt ver. Sadece JSON formatında çıktı üret.',
    },
    {
      role: 'user',
      content: `"${konu}" konusunu analiz et.
${bakisAcisi ? `Kullanıcının bakış açısı: "${bakisAcisi}"` : ''}

Güncel trendler, istatistikler ve LinkedIn içeriği için önemli noktaları belirle.

SADECE şu JSON formatında yanıt ver:
{
  "kaynaklar": [{"baslik": "...", "url": "", "ozet": "..."}],
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "carpici_veri": "en çarpıcı istatistik veya gerçek",
  "tartismali_boyut": "konunun ilgi çekici veya tartışmalı boyutu"
}`,
    },
  ]);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Researcher JSON parse hatası:', e);
  }

  return {
    kaynaklar: [],
    insights: [`${konu} konusunda analiz yapıldı`],
    carpici_veri: '',
    tartismali_boyut: '',
  };
}

module.exports = { research };
