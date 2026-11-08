// The same post -> the same key, however the link was copied, so a saddle can only be imported
// once (by anyone). Used when saving an import and when Quick add checks a link up front.
// Facebook gives one post many URLs (app vs web, group name vs number, tracking query strings);
// the common shapes are reduced to the post's own id. Links we can't decode (e.g. facebook.com/share/…
// short links, which only redirect) fall back to host + path.

export function sourceKey(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const raw = url.trim();
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^(www\.|m\.|web\.|mbasic\.)/, '');
    const path = u.pathname.replace(/\/+$/, '');
    const q = u.searchParams;

    if (host.endsWith('facebook.com') || host === 'fb.com') {
      const item = path.match(/\/marketplace\/item\/(\d+)/);
      if (item) return `facebook.com/marketplace/item/${item[1]}`;
      // Group posts: /groups/<group>/posts/<id> and /groups/<group>/permalink/<id>
      const group = path.match(/\/groups\/([^/]+)\/(?:posts|permalink)\/(\d+)/);
      if (group) return `facebook.com/groups/${group[1].toLowerCase()}/posts/${group[2]}`;
      // A group link pointing at one post via ?multi_permalinks=<id>
      const multi = q.get('multi_permalinks')?.split(',')[0];
      const groupOnly = path.match(/\/groups\/([^/]+)/);
      if (groupOnly && multi && /^\d+$/.test(multi)) return `facebook.com/groups/${groupOnly[1].toLowerCase()}/posts/${multi}`;
      // Profile/page posts: permalink.php?story_fbid=<id>&id=<owner>, or /<owner>/posts/<id>
      const story = q.get('story_fbid');
      if (story) return `facebook.com/posts/${story}`;
      const ownerPost = path.match(/\/[^/]+\/posts\/([\w]+)/);
      if (ownerPost) return `facebook.com/posts/${ownerPost[1]}`;
      // Photos: photo.php?fbid=<id> or /photo/?fbid=<id>
      const fbid = q.get('fbid');
      if (fbid) return `facebook.com/photo/${fbid}`;
    }
    return `${host}${path}`.toLowerCase().slice(0, 300);
  } catch {
    return null;
  }
}
