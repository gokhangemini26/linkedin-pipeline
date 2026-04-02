// lib/linkedin.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * LinkedIn'e post yayınlar
 * @param {string} postText - Yayınlanacak post metni
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
async function publishPost(postText) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;

  if (!token || !personId) {
    return { success: false, error: 'LINKEDIN_ACCESS_TOKEN veya LINKEDIN_PERSON_ID eksik' };
  }

  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${personId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: postText },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, postId: data.id };
    } else {
      const err = await res.text();
      return { success: false, error: `LinkedIn API hatası: ${err}` };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { publishPost };
