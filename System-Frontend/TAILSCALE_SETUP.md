# Tailscale Auto-Configuration Setup

This document explains how the automatic Tailscale IP update system works.

## 🚀 How It Works

The app now includes an automated script that:
1. **Fetches** your Mac's current Tailscale IPv4 address (`tailscale ip -4`)
2. **Updates** `constants/env.ts` with the fresh IP
3. **Runs automatically** before each build/start command

## 📦 npm Scripts

All standard commands now include automatic Tailscale setup:

### Development
```bash
npm start          # Updates Tailscale IP, then starts dev server
npm run ios        # Updates Tailscale IP, then starts iOS
npm run android    # Updates Tailscale IP, then starts Android
```

### Production Builds
```bash
npm run web        # Updates Tailscale IP, then exports web build
npm run build:web  # Explicit web build command
```

### Manual IP Update (without starting)
```bash
npm run setup:tailscale
```

## ⚙️ Requirements

- **Tailscale installed** on your Mac
- **Tailscale running** and authenticated (`tailscale status`)
- **Node.js** (already required for expo)

## 🔍 Verification

After running any command, you'll see output like:
```
🔍 Fetching Tailscale IPv4 address...
✅ Tailscale IP updated successfully!
   IP: 100.93.101.56
   File: constants/env.ts
   API_BASE_URL: http://100.93.101.56:8000
```

## 🛠️ Script Location

The update script is located at: `scripts/update-tailscale.js`

It automatically:
- Handles errors gracefully (Tailscale not installed, not running, etc.)
- Validates IP format (must be `100.x.x.x`)
- Provides helpful error messages

## 🔑 Key File: `constants/env.ts`

This file maintains your current Tailscale configuration:
```typescript
export const TAILSCALE_IP = '100.93.101.56';     // Auto-updated
export const BACKEND_PORT = '8000';
export const API_BASE_URL = `http://${TAILSCALE_IP}:${BACKEND_PORT}`;
```

All API calls throughout the app use `API_BASE_URL` from `constants/config.ts`.

---

**No more manual IP updates needed!** 🎉
