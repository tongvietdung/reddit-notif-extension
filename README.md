# Reddit Notification Dropdown

A Chrome/Brave extension that transforms Reddit's bell icon into a **quick-view dropdown** showing your latest 10 notifications — without ever leaving the page.

---

## ✨ Features

- Click the 🔔 bell → instant dropdown with your latest 10 notifications
- Unread notifications highlighted with an orange dot
- Shows: who, action type (reply/mention/DM), subreddit, time ago, and preview text
- "View all" button links to `/notifications/`
- Results cached for 60s to avoid hammering the API
- Works with Reddit's SPA navigation (no page refresh needed)
- Close with Escape key or clicking outside

---

## 🚀 Install in Brave / Chrome

1. Go to `brave://extensions` or `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `reddit-notif-extension/` folder
5. Navigate to **reddit.com** and click the bell 🔔

> **You must be logged in to Reddit** for notifications to load.

---

## 🔧 How it works

Reddit's session cookies are automatically included in `fetch()` calls made from content scripts running on `reddit.com`. The extension calls:

```
GET https://www.reddit.com/message/inbox.json?limit=10&raw_json=1
```

No OAuth setup, no API keys — it piggybacks on your existing Reddit login.

---

## 🐞 Troubleshooting

| Problem | Fix |
|---------|-----|
| Dropdown doesn't appear | Reddit updates their DOM often — check the console for selector errors and open an issue |
| "Not logged in" error | Make sure you're signed in to reddit.com |
| Notifications don't refresh | Results cache for 60s; close/reopen the dropdown after that |
| Bell click opens Reddit's native panel too | Reddit's JS may beat us to it — try reloading the page |

---

## 📁 File Structure

```
reddit-notif-extension/
├── manifest.json       — Extension config
├── icons/              — Extension icons
└── src/
    ├── content.js      — Bell interception + API fetch + dropdown logic
    └── dropdown.css    — Dropdown styles (injected into reddit.com)
```

---

## ⚙️ Customization

**Change number of notifications shown** — in `content.js`, change the `limit=10` in the fetch URL:
```js
'https://www.reddit.com/message/inbox.json?limit=25&raw_json=1'
```

**Change cache duration** — modify `CACHE_TTL_MS` at the top of `content.js`:
```js
const CACHE_TTL_MS = 60_000; // 1 minute
```

**Style the dropdown** — edit `src/dropdown.css`.
