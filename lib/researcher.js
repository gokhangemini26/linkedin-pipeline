// lib/researcher.js — Tavily API + gerçekten güncel haber araması
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

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
        days,
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
 * Bugünün tarihini al — sorguya ekle
 */
function bugunTarihi() {
  return new Date().toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric'
  }); // "2 Nisan 2026"
}

/**
 * Güncel haber araması: 24s → 48s → 7g fallback
 */
async function searchWithFallback(konu, bakisAcisi) {
  const bugun = bugunTarihi();

  // Sorgulardan "2025" YOK — "güncel", "son dakika", "bugün" var
  const sorgular = [
    `${konu} güncel haber ${bugun}`,
    `${konu} AI son gelişmeler`,
    `${konu} Türkiye iş dünyası son dakika`,
  ];

  const araLevels = [
    { days: 1, label: 'son 24 saat' },
    { days: 2, label: 'son 48 saat' },
    { days: 7, label: 'son 7 gün' },
  ];

  for (const { days, label } of araLevels) {
    console.log(`🔍 ${label} aranıyor...`);

    const tumSonuclar = (await Promise.all(
      sorgular.map(s => tavilySearch(s, 4, days))
    )).flat();

    const seen = new Set();
    const kaynaklar = tumSonuclar
      .filter(k => {
        if (seen.has(k.url)) return false;
        seen.add(k.url);
        return true;
      })
      .slice(0, 8);

    if (kaynaklar.length >= 3) {
      console.log(`✅ ${label}: ${kaynaklar.length} kaynak bulundu`);
      return { kaynaklar, aralikLabel: label };
    }

    console.log(`⚠️ ${label}: sadece ${kaynaklar.length} kaynak, genişletiliyor...`);
  }

  return { kaynaklar: [], aralikLabel: 'bulunamadı' };
}

/**
 * Groq ile analiz — tarih bağlamı ekli
 */
async function analyzeWithGroq(konu, bakisAcisi, kaynaklar, aralikLabel) {
  const bugun = bugunTarihi();
  const kaynakMetni = kaynaklar.length > 0
    ? kaynaklar.map((k, i) => `${i + 1}. ${k.baslik}\n   ${k.ozet}`).join('\n')
    : 'Web kaynağı bulunamadı.';

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
          content: `Sen bir LinkedIn içerik stratejistisin. Bugün ${bugun}. Türkçe yanıt ver. Sadece JSON çıktı üret. ÖNEMLİ: Analizde ${aralikLabel} içindeki GÜNCEL bilgileri kullan, geçmiş yıllara değil bugüne odaklan.`,
        },
        {
          role: 'user',
          content: `"${konu}" konusunu analiz et.
${bakisAcisi ? `Kullanıcının bakış açısı: "${bakisAcisi}"` : ''}

${aralikLabel.toUpperCase()} GÜNCEL KAYNAKLAR:
${kaynakMetni}

Şu JSON formatında analiz üret (geçmiş değil, BUGÜNÜ ve ${aralikLabel}ini baz al):
{
  "insights": ["güncel insight 1", "güncel insight 2", "güncel insight 3", "güncel insight 4", "güncel insight 5"],
  "carpici_veri": "bugünden veya ${aralikLabel}inden en çarpıcı güncel istatistik",
  "tartismali_boyut": "şu an tartışılan en ilgi çekici boyut"
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

async function research(konu, bakisAcisi = '') {
  const { kaynaklar, aralikLabel } = await searchWithFallback(konu, bakisAcisi);
  const analiz = await analyzeWithGroq(konu, bakisAcisi, kaynaklar, aralikLabel);
  return { kaynaklar, aralikLabel, ...analiz };
}

module.exports = { research };
