// lib/telegram.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Düz metin mesaj gönderir
 */
async function sendMessage(chatId, text, options = {}) {
  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options,
    }),
  });
  return res.json();
}

/**
 * 3 varyantı inline butonlarla gönderir
 */
async function sendPostsWithButtons(chatId, konu, posts) {
  const { a, b, c } = posts;

  const mesaj = `
🔔 *YENİ LİNKEDİN İÇERİĞİ*
📅 ${new Date().toLocaleDateString('tr-TR')} | 🏷️ ${konu}

━━━━━━━━━━━━━━━━━━━
📊 *VARYANT A — Veri Odaklı*
━━━━━━━━━━━━━━━━━━━
${a}

━━━━━━━━━━━━━━━━━━━
📖 *VARYANT B — Hikaye*
━━━━━━━━━━━━━━━━━━━
${b}

━━━━━━━━━━━━━━━━━━━
💬 *VARYANT C — Tartışma*
━━━━━━━━━━━━━━━━━━━
${c}
  `.trim();

  // Telegram max 4096 karakter — uzunsa böl
  const chunks = splitMessage(mesaj, 4000);
  for (const chunk of chunks) {
    await sendMessage(chatId, chunk);
  }

  // Onay butonlarını ayrı mesajda gönder
  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '👇 Hangi varyantı yayınlayalım?',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ A — Veri Odaklı', callback_data: 'approve_a' },
            { text: '✅ B — Hikaye', callback_data: 'approve_b' },
            { text: '✅ C — Tartışma', callback_data: 'approve_c' },
          ],
          [
            { text: '❌ İptal', callback_data: 'cancel' },
          ],
        ],
      },
    }),
  });
}

/**
 * LinkedIn'e başarıyla gönderildi bildirimi
 */
async function sendSuccess(chatId, postText) {
  await sendMessage(
    chatId,
    `✅ *LinkedIn'e başarıyla yayınlandı!*\n\n${postText.substring(0, 200)}...`
  );
}

/**
 * Hata bildirimi
 */
async function sendError(chatId, hata) {
  await sendMessage(chatId, `❌ *Hata oluştu:*\n${hata}`);
}

/**
 * Uzun mesajı parçalara böler
 */
function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}

module.exports = { sendMessage, sendPostsWithButtons, sendSuccess, sendError };
