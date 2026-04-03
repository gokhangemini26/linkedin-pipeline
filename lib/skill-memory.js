// lib/skill-memory.js — OpenSpace'den ilham alan Self-Evolving Skill Memory
// Her görevden öğrenir, başarılı pattern'ları hatırlar, zamanla iyileşir

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

// ── Upstash Redis yardımcıları ──────────────────────────────────────────────

async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch (e) {
    console.error('Redis GET hatası:', e.message);
    return null;
  }
}

async function redisSet(key, value, exSeconds = 60 * 60 * 24 * 90) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: JSON.stringify(value), ex: exSeconds }),
    });
  } catch (e) {
    console.error('Redis SET hatası:', e.message);
  }
}

async function redisIncr(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
  try {
    const res = await fetch(`${UPSTASH_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data.result || 0;
  } catch (e) {
    return 0;
  }
}

// ── SKILL MEMORY API ────────────────────────────────────────────────────────

/**
 * Araştırma tamamlandığında kaydet
 * Bir dahaki benzer araştırmada kullanılır
 */
async function saveResearchResult(konu, arastirma) {
  const key = `research:${normalizeKey(konu)}`;
  const existing = await redisGet(key) || { runs: 0, kaynaklar: [], insights: [] };

  // Başarılı kaynakları biriktir (max 20)
  const allKaynaklar = [...(existing.kaynaklar || []), ...(arastirma.kaynaklar || [])]
    .filter((k, i, arr) => arr.findIndex(x => x.url === k.url) === i)
    .slice(0, 20);

  // En sık tekrar eden insight'ları önceliklendir
  const allInsights = [...(existing.insights || []), ...(arastirma.insights || [])]
    .slice(0, 30);

  await redisSet(key, {
    konu,
    runs: (existing.runs || 0) + 1,
    kaynaklar: allKaynaklar,
    insights: allInsights,
    carpici_veri: arastirma.carpici_veri,
    tartismali_boyut: arastirma.tartismali_boyut,
    lastUpdated: new Date().toISOString(),
  });

  console.log(`💾 Araştırma hafızaya kaydedildi: ${konu} (${arastirma.kaynaklar?.length || 0} kaynak)`);
}

/**
 * Geçmiş araştırmaları getir — benzer konularda daha az token harcar
 */
async function getPastResearch(konu) {
  const key = `research:${normalizeKey(konu)}`;
  const data = await redisGet(key);
  if (data) {
    console.log(`🧠 Geçmiş araştırma bulundu: ${konu} (${data.runs} kez çalıştırıldı)`);
  }
  return data;
}

/**
 * Kullanıcı hangi post varyantını seçti → öğren
 */
async function savePostSelection(konu, selectedVariant, posts) {
  // Genel istatistik
  await redisIncr(`post:selection:${selectedVariant}`);

  // Konu bazlı tercih
  const key = `post:preference:${normalizeKey(konu)}`;
  const existing = await redisGet(key) || { a: 0, b: 0, c: 0, posts: [] };

  existing[selectedVariant] = (existing[selectedVariant] || 0) + 1;

  // Başarılı post örneklerini sakla (max 5 per konu)
  const successPost = {
    variant: selectedVariant,
    content: posts[selectedVariant]?.slice(0, 300), // İlk 300 karakter
    selectedAt: new Date().toISOString(),
  };
  existing.posts = [successPost, ...(existing.posts || [])].slice(0, 5);

  await redisSet(key, existing);
  console.log(`📊 Post tercihi kaydedildi: Varyant ${selectedVariant.toUpperCase()} (${konu})`);
}

/**
 * En çok tercih edilen varyantı getir — generator bunu kullanır
 */
async function getPostPreferences(konu) {
  const key = `post:preference:${normalizeKey(konu)}`;
  const pref = await redisGet(key);

  // Genel istatistik
  const [aCount, bCount, cCount] = await Promise.all([
    redisGet('post:selection:a'),
    redisGet('post:selection:b'),
    redisGet('post:selection:c'),
  ]);

  return {
    konuPref: pref || null,
    genelPref: {
      a: parseInt(aCount) || 0,
      b: parseInt(bCount) || 0,
      c: parseInt(cCount) || 0,
    },
    basariliPostlar: pref?.posts || [],
  };
}

/**
 * Skill hatası kaydet — self-healing için
 */
async function saveSkillError(skillName, error, context) {
  const key = `skill:errors:${skillName}`;
  const existing = await redisGet(key) || [];
  const errors = [{
    error: error?.message || String(error),
    context: context?.slice(0, 200),
    timestamp: new Date().toISOString(),
  }, ...existing].slice(0, 10);

  await redisSet(key, errors, 60 * 60 * 24 * 7); // 7 gün sakla
  console.log(`❌ Skill hatası kaydedildi: ${skillName}`);
}

/**
 * Skill başarısını kaydet
 */
async function saveSkillSuccess(skillName, durationMs) {
  await redisIncr(`skill:success:${skillName}`);
  const key = `skill:avgduration:${skillName}`;
  const existing = await redisGet(key) || { total: 0, count: 0 };
  await redisSet(key, {
    total: existing.total + durationMs,
    count: existing.count + 1,
    avg: Math.round((existing.total + durationMs) / (existing.count + 1)),
  });
}

/**
 * Genel istatistikleri getir
 */
async function getSkillStats() {
  const [researchSuccess, postA, postB, postC] = await Promise.all([
    redisGet('skill:success:researcher'),
    redisGet('post:selection:a'),
    redisGet('post:selection:b'),
    redisGet('post:selection:c'),
  ]);

  const total = (parseInt(postA) || 0) + (parseInt(postB) || 0) + (parseInt(postC) || 0);

  return {
    toplamPost: total,
    varyantTercihleri: {
      a: parseInt(postA) || 0,
      b: parseInt(postB) || 0,
      c: parseInt(postC) || 0,
    },
    enCokTercih: total > 0
      ? ['a', 'b', 'c'].reduce((best, v) =>
          (parseInt(eval(`post${v.toUpperCase()}`) || 0) > (parseInt(eval(`post${best.toUpperCase()}`) || 0)) ? v : best), 'a')
      : null,
  };
}

// ── Yardımcılar ─────────────────────────────────────────────────────────────

function normalizeKey(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

module.exports = {
  saveResearchResult,
  getPastResearch,
  savePostSelection,
  getPostPreferences,
  saveSkillError,
  saveSkillSuccess,
  getSkillStats,
};
