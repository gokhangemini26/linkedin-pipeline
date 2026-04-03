// lib/generator.js — Groq + Skill Memory (öğrenen post üretici)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const memory = require('./skill-memory');

async function generatePosts(konu, bakisAcisi, arastirma) {
  const startTime = Date.now();
  try {
    // 🧠 Geçmiş tercihleri getir
    const prefs = await memory.getPostPreferences(konu);
    const { genelPref, basariliPostlar } = prefs;

    // En çok tercih edilen varyantı belirle
    const total = genelPref.a + genelPref.b + genelPref.c;
    let prefNote = '';
    if (total > 2) {
      const en = Object.entries(genelPref).sort((a, b) => b[1] - a[1])[0];
      const enMap = { a: 'Veri odaklı', b: 'Hikaye', c: 'Tartışma' };
      prefNote = `\nKULLANICI TERCİHİ: Geçmişte "${enMap[en[0]]}" varyantı %${Math.round(en[1]/total*100)} oranında tercih edildi. Bu stili biraz öne çıkar.`;
    }

    // Başarılı post örnekleri
    const ornekler = basariliPostlar.length > 0
      ? `\nBAŞARILI GEÇMIŞ POST ÖRNEKLERİ (yalnızca ton/stil referansı için):\n${basariliPostlar.map(p => `[${p.variant.toUpperCase()}]: ${p.content}...`).join('\n')}`
      : '';

    const { insights, carpici_veri, tartismali_boyut, kaynaklar } = arastirma;
    const kaynakOzeti = (kaynaklar || []).slice(0, 4).map(k => `• ${k.baslik}: ${k.ozet?.slice(0, 100)}`).join('\n');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4000,
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content: `Sen deneyimli bir Türk iş insanısın. Yapay zeka, tekstil ve uluslararası ticaret konularında düşünce liderliği yapıyorsun.

Yazım tarzın: Samimi ama otoriter, veri destekli, kısa ve etkili cümleler.
ASLA: "Bu yazıda", "Bu postda" diye başlama. "İnovasyon", "Paradigma" gibi klişelerden kaçın.
${prefNote}
${ornekler}

Sadece JSON çıktı üret.`,
          },
          {
            role: 'user',
            content: `Konu: "${konu}"
${bakisAcisi ? `Bakış açım: "${bakisAcisi}"` : ''}

ARAŞTIRMA:
${insights.map(i => `• ${i}`).join('\n')}
${carpici_veri ? `Çarpıcı veri: ${carpici_veri}` : ''}
${tartismali_boyut ? `Tartışmalı boyut: ${tartismali_boyut}` : ''}
${kaynakOzeti ? `Kaynaklar:\n${kaynakOzeti}` : ''}

3 LinkedIn post varyantı yaz (max 2.800 karakter, hook ilk 2 satır 200 karakter, 6-8 hashtag):

A — Veri & Analiz: İstatistikle başla, analist tonu
B — Hikaye: Kişisel gözlemle başla, samimi ton
C — Tartışma: Karşı sezgisel soruyla başla, cesur ton

SADECE JSON:
{
  "a": "<varyant A>",
  "b": "<varyant B>",
  "c": "<varyant C>"
}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const posts = JSON.parse(jsonMatch[0]);
        await memory.saveSkillSuccess('generator', Date.now() - startTime);
        return posts;
      }
    } catch (e) {}

    return { a: text, b: text, c: text };
  } catch (e) {
    await memory.saveSkillError('generator', e, konu);
    throw e;
  }
}

module.exports = { generatePosts };
