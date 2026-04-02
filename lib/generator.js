// lib/generator.js — Groq ile 3 LinkedIn post varyantı (geliştirilmiş prompt)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function generatePosts(konu, bakisAcisi, arastirma) {
  const { insights, carpici_veri, tartismali_boyut, kaynaklar } = arastirma;

  const kaynakOzeti = kaynaklar.length > 0
    ? kaynaklar.slice(0, 4).map(k => `• ${k.baslik}: ${k.ozet?.slice(0, 100)}`).join('\n')
    : '';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      temperature: 0.85,
      messages: [
        {
          role: 'system',
          content: `Sen deneyimli bir Türk iş insanısın. Yapay zeka, tekstil ve uluslararası ticaret konularında düşünce liderliği yapıyorsun.

LinkedIn yazım tarzın:
- Samimi ama otoriter
- Veri destekli ama hikaye odaklı
- Türk iş dünyasına özgü referanslar kullanırsın
- Cümlelerin kısa ve etkili
- İlk 2 satır mutlaka dikkat çekici (hook)

ASLA yapma:
- "Bu yazıda" veya "Bu postda" diye başlama
- Jenerik ve klişe ifadeler kullanma
- "İnovasyon", "Dönüşüm", "Paradigma" gibi aşınmış kelimeleri fazla kullanma

Sadece JSON formatında çıktı üret.`,
        },
        {
          role: 'user',
          content: `Konu: "${konu}"
${bakisAcisi ? `Benim bakış açım: "${bakisAcisi}"` : ''}

ARAŞTIRMA BULGULARI:
${insights.map(i => `• ${i}`).join('\n')}
${carpici_veri ? `\nÇarpıcı veri: ${carpici_veri}` : ''}
${tartismali_boyut ? `Tartışmalı boyut: ${tartismali_boyut}` : ''}
${kaynakOzeti ? `\nKaynaklar:\n${kaynakOzeti}` : ''}

3 farklı LinkedIn post yaz. Her biri:
- Max 2.800 karakter
- İlk 2 satır (hook): max 200 karakter, merak uyandırıcı
- Emojiler doğal kullan
- Sonunda 6-8 hashtag (#YapayZeka #Teknoloji gibi)

VARYANT A — Veri & Analiz odaklı:
İstatistik veya çarpıcı bir gerçekle başla. "Bunu bilmiyor olabilirsin" hissi ver. Analist bakışı.

VARYANT B — Kişisel hikaye & Gözlem:
Günlük hayattan bir sahne veya kişisel gözlemle başla. Empati kur. "Sen de bunu yaşıyor musun?" hissi ver.

VARYANT C — Cesur & Tartışmacı:
Yaygın kanaate meydan oku. Yorum ve tartışma davet et.

SADECE şu JSON formatında yanıt ver:
{
  "a": "<varyant A tam metni>",
  "b": "<varyant B tam metni>",
  "c": "<varyant C tam metni>"
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
    console.error('Generator JSON parse hatası:', e);
  }

  return { a: text, b: text, c: text };
}

module.exports = { generatePosts };
