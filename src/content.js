// content.js — injected into reddit.com pages
// Intercepts the notification bell and replaces its click with our custom dropdown.

(function () {
  'use strict';

  const DROPDOWN_ID   = 'rnd-dropdown';
  const CACHE_KEY     = 'rnd_notif_cache';
  const CACHE_TTL_MS  = 60_000; // 1 minute

  // ─── Selectors for Reddit's bell button ─────────────────────────────────────
  // Reddit (shreddit) uses web components. We try multiple selectors for resilience.
  const BELL_SELECTORS = [
    'a[href="/notifications/"]',
    'button[aria-label*="notification" i]',
    'button[aria-label*="Notification" i]',
    '[data-testid="notification-bell"]',
    'faceplate-tracker[noun="notification_bell"]',
    'a[href*="notifications"]',
  ];

  let dropdown = null;
  let isOpen   = false;

  // ─── Find the bell element ───────────────────────────────────────────────────
  function findBell() {
    for (const sel of BELL_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ─── Build and inject the dropdown DOM ──────────────────────────────────────
  function createDropdown() {
    const div = document.createElement('div');
    div.id = DROPDOWN_ID;
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Notifications');
    div.innerHTML = `
      <div class="rnd-header">
        <span class="rnd-title">Notifications</span>
        <a class="rnd-view-all" href="https://www.reddit.com/notifications/" target="_blank">
          View all
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
      <div class="rnd-list" id="rnd-list">
        <div class="rnd-loading">
          <div class="rnd-spinner"></div>
          <span>Loading notifications…</span>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    return div;
  }

  // ─── Position dropdown below the bell ───────────────────────────────────────
  function positionDropdown(bell) {
    const rect = bell.getBoundingClientRect();
    const dd   = dropdown;

    dd.style.top  = `${rect.bottom + window.scrollY + 6}px`;

    // Try to align right edge with bell, but keep within viewport
    let left = rect.right + window.scrollX - 320; // 320 = dropdown width
    left = Math.max(8, Math.min(left, window.innerWidth - 328));
    dd.style.left = `${left}px`;
  }

  // ─── Fetch notifications from Reddit's JSON API ──────────────────────────────
  // Because the content script runs on reddit.com, the user's session cookies
  // are automatically included — no OAuth setup needed.
  async function fetchNotifications() {
    // Check cache first
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) return data;
      } catch (_) {}
    }

    const res = await fetch('https://www.reddit.com/message/inbox.json?limit=10&raw_json=1', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const items = (json?.data?.children ?? []).map(({ data: d }) => ({
      id:        d.name,
      type:      d.type,           // 'comment_reply', 'post_reply', 'username_mention', 'private_message'
      subject:   d.subject,
      body:      d.body,
      author:    d.author,
      subreddit: d.subreddit,
      context:   d.context,        // relative URL to the comment
      dest:      d.dest,
      new:       d.new,
      created:   d.created_utc,
    }));

    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items }));
    return items;
  }

  // ─── Render notification items ───────────────────────────────────────────────
  function typeLabel(type) {
    switch (type) {
      case 'comment_reply':    return 'replied to your comment';
      case 'post_reply':       return 'replied to your post';
      case 'username_mention': return 'mentioned you';
      case 'private_message':  return 'sent you a message';
      default:                 return type?.replace(/_/g, ' ') ?? 'notification';
    }
  }

  function timeAgo(utcSeconds) {
    const diff = Math.floor(Date.now() / 1000) - utcSeconds;
    if (diff < 60)           return `${diff}s ago`;
    if (diff < 3600)         return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)        return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800)       return `${Math.floor(diff / 86400)}d ago`;
    return new Date(utcSeconds * 1000).toLocaleDateString();
  }

  function stripMarkdown(text = '') {
    return text
      .replace(/!\[.*?\]\(.*?\)/g, '[image]')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/[*_~`>#]/g, '')
      .trim();
  }

  function renderItems(items) {
    const list = document.getElementById('rnd-list');
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = `<div class="rnd-empty">No notifications yet 🎉</div>`;
      return;
    }

    list.innerHTML = items.map(n => {
      const url = n.context
        ? `https://www.reddit.com${n.context}`
        : `https://www.reddit.com/message/inbox/`;

      const sub = n.subreddit ? `r/${n.subreddit} · ` : '';

      return `
        <a class="rnd-item ${n.new ? 'rnd-item--unread' : ''}" href="${url}" target="_blank">
          ${n.new ? '<span class="rnd-unread-dot"></span>' : ''}
          <div class="rnd-item-body">
            <div class="rnd-item-meta">
              <span class="rnd-author">u/${n.author}</span>
              <span class="rnd-action">${typeLabel(n.type)}</span>
            </div>
            <div class="rnd-sub-meta">${sub}${timeAgo(n.created)}</div>
            <div class="rnd-preview">${stripMarkdown(n.body).slice(0, 120)}${n.body?.length > 120 ? '…' : ''}</div>
          </div>
        </a>
      `;
    }).join('');
  }

  function renderError(msg) {
    const list = document.getElementById('rnd-list');
    if (list) list.innerHTML = `<div class="rnd-error">⚠ ${msg}</div>`;
  }

  // ─── Open / close dropdown ───────────────────────────────────────────────────
  async function openDropdown(bell) {
    if (!dropdown) dropdown = createDropdown();

    positionDropdown(bell);
    dropdown.classList.add('rnd-open');
    isOpen = true;

    // Fetch and render
    const listEl = document.getElementById('rnd-list');
    if (listEl) {
      listEl.innerHTML = `<div class="rnd-loading"><div class="rnd-spinner"></div><span>Loading…</span></div>`;
    }

    try {
      const items = await fetchNotifications();
      renderItems(items);
    } catch (err) {
      console.warn('[RND] fetch error:', err);
      if (err.message.includes('401') || err.message.includes('403')) {
        renderError('Not logged in — please sign in to Reddit.');
      } else {
        renderError('Could not load notifications. Try refreshing.');
      }
    }
  }

  function closeDropdown() {
    if (dropdown) dropdown.classList.remove('rnd-open');
    isOpen = false;
  }

  // ─── Intercept the bell click ────────────────────────────────────────────────
  function interceptBell(bell) {
    // Mark so we don't double-bind
    if (bell.dataset.rndHooked) return;
    bell.dataset.rndHooked = 'true';

    bell.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isOpen) {
        closeDropdown();
      } else {
        openDropdown(bell);
      }
    }, true); // capture phase so we beat Reddit's own handlers
  }

  // ─── Close on outside click ──────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!isOpen) return;
    if (dropdown && dropdown.contains(e.target)) return;

    const bell = findBell();
    if (bell && bell.contains(e.target)) return;

    closeDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeDropdown();
  });

  // ─── Observer: wait for the bell to appear (Reddit is a SPA) ────────────────
  function tryHook() {
    const bell = findBell();
    if (bell) {
      interceptBell(bell);
      return true;
    }
    return false;
  }

  // Try immediately, then watch for DOM changes
  if (!tryHook()) {
    const observer = new MutationObserver(() => {
      if (tryHook()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Re-hook on Reddit SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closeDropdown();
      setTimeout(tryHook, 800);
    }
  }).observe(document, { subtree: true, childList: true });

})();
