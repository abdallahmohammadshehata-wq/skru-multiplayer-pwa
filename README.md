# Skru (سكرو) — Full-Stack Multiplayer Card Game & Digital Companion PWA

A modern, full-stack Progressive Web App (PWA) and real-time WebSocket game engine for **"Skru" (سكرو / Screw)**, the popular Egyptian and Middle Eastern bluffing and memory card game.

- 🌐 **Live Public App (GitHub Pages)**: [https://abdallahmohammadshehata-wq.github.io/skru-multiplayer-pwa/](https://abdallahmohammadshehata-wq.github.io/skru-multiplayer-pwa/)
- 📦 **GitHub Repository**: [https://github.com/abdallahmohammadshehata-wq/skru-multiplayer-pwa](https://github.com/abdallahmohammadshehata-wq/skru-multiplayer-pwa)

---

## 🌟 Key Features & Operational Modes

### 1. 🌐 Online Real-Time Multiplayer Rooms
- **6-Character Custom Room Codes**: Host/join rooms with human-friendly codes like `SKRU-7K2` or via direct share link (`/join?room=SKRU-7K2`).
- **2 to 8 Players & 2v2 Teams**: Supports individual free-for-all and **"صاحب صاحبه" (Saheb Sa7bo 2v2)** cooperative mode with shared team scoring.
- **Authoritative Anti-Cheat Game Engine**: Opponents' face-down cards never leak to client state payloads.
- **Ephemeral Peek Timers**: Server-enforced 4-second peek window with automatic re-concealment.
- **Match Slap (التشابه)**: Out-of-turn reaction drop when a player holds a card matching the discard pile.
- **Live Social Interaction**: In-game emoji tray (😂, 😱, 🤫, 💣, "سكرووو!"), turn countdown bar, and audio ticks.
- **Heartbeat & Reconnection**: 60-second disconnect grace period to preserve hands across unstable network connections.

### 2. 📱 Interactive Digital Scorekeeper & Rule Companion
- **Tabletop Companion**: Digital pen-and-paper scoreboard for real-world physical card decks.
- **Automated Score Calculation**: Tracks negative cards, penalty cards (+20, +25), and rounds.
- **Automatic Skru Penalty Logic**: Automatically detects whether the caller had the strictly lowest score (0 points) or tied/lost (doubles round score or applies penalty).
- **Match Podium**: Live ranking and victory celebrations.

### 3. 🤖 Local Digital Tabletop (Solo vs Heuristic AI & Pass-and-Play)
- **Play Offline**: 100% playable on one device without server or internet connection.
- **Smart Heuristic AI**: Bots remember revealed cards, calculate risk, execute actions (peeking high cards, swapping low cards to themselves), and declare "Skru!" when threshold is met.
- **Press-and-Hold Secret Peek**: Native mobile ergonomics for private card checking on shared screens.

### 4. 🎨 Independent 3-Way Theme Engine
- Persistent modes: **Light**, **Dark**, and **Auto (System)**.
- **Forced State Override**: Explicitly overrides device OS `prefers-color-scheme`.
- **Dark Mode**: Midnight navy & casino emerald velvet felt (`#061811` / `#0B3324`), glowing amber accents.
- **Light Mode**: Clean ivory casino felt (`#F1F5F2` / `#E2EDE7`), high-contrast charcoal typography, zero-glare shadows.

### 5. 🌍 Seamless Bidirectional Arabic / English (RTL / LTR)
- Instant language toggle without page reload.
- Full Arabic terminology:
  - سحب (Draw)
  - كومة الأرض (Discard)
  - خد فكرة (Peek Self)
  - بصرة (Peek Other)
  - هات وخد (Swap)
  - كعب داير (Peek All)
  - سكرووو! (Skru!)
  - تشابه (Match Slap)

---

## 🗂️ Project Directory Structure

```text
skru_multiplayer_pwa/
├── backend/                       # Real-Time WebSocket Game Server
│   ├── src/
│   │   ├── engine/                # Authoritative state machine & deck generators
│   │   │   ├── deck.ts            # Classic (68), Saheb Sa7bo, Deluxe, French deck builders
│   │   │   └── game.ts            # Turns, peeks, swaps, match slaps, Skru penalties, anti-cheat
│   │   ├── models/                # Room, Player, Card, GameState schemas & types
│   │   ├── rooms/                 # Room lifecycle & client session management
│   │   ├── events/                # WebSocket event router & action validation
│   │   └── server.ts              # HTTP health check & ws Server on port 3001
│   ├── tests/
│   │   └── engine.test.js         # Comprehensive game engine unit test suite (5/5 passing)
│   ├── Dockerfile
│   └── package.json
├── frontend/                      # Modern React / Vite PWA
│   ├── public/
│   │   ├── manifest.webmanifest   # PWA manifest (standalone, portrait lock, theme colors)
│   │   ├── sw.js                  # Service worker for offline caching
│   │   └── icons/                 # High-res SVG app icons
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Header, theme switcher, language switcher, audio toggle
│   │   │   ├── companion/         # Digital tabletop scorekeeper & penalty calculator
│   │   │   ├── lobby/             # Room creation, PIN join keypad, avatars, presets
│   │   │   ├── rules/             # 3D visual card guide & action encyclopedia
│   │   │   └── tabletop/          # CardView, TabletopView (Multiplayer), SoloTabletopView (AI)
│   │   ├── engine/                # Offline local game engine & heuristic bot AI
│   │   ├── i18n/                  # Arabic/English dictionaries & RTL/LTR context
│   │   ├── socket/                # Resilient WebSocket hook with heartbeat & auto-reconnect
│   │   ├── theme/                 # Independent 3-way theme manager (forced light/dark)
│   │   ├── utils/                 # Web Audio procedural sound synthesis & mobile haptics
│   │   ├── App.tsx
│   │   └── index.css              # Custom Vanilla CSS design tokens & 3D animations
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml             # Single-command full-stack container deployment
└── README.md
```

---

## 🚀 Quick Start Guide

### Option 1: Running with Docker Compose (Recommended)

```bash
cd skru_multiplayer_pwa
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend WebSocket / Health: `http://localhost:3001/health`

### Option 2: Running Locally with Node.js

#### 1. Backend Server
```bash
cd skru_multiplayer_pwa/backend
npm install
npm run test             # Run backend engine unit tests
npm run test:multiplayer # Run Mode 1 e2e multi-client live WebSocket game test
npx tsx ../frontend/src/tests/modes_2_and_3.test.js # Run Mode 2 & Mode 3 test suite
npm start                # Starts WebSocket server on port 3001
```

#### 2. Frontend PWA
```bash
cd skru_multiplayer_pwa/frontend
npm install
npm run dev     # Starts Vite dev server on port 5174
```

---

## 🃏 Game Rules & Card Reference Encoded

| Card | Value / Action | Arabic Name | Effect |
| :--- | :--- | :--- | :--- |
| **Red Skru** | `-1` | سكرو أحمر | Best card in the game |
| **0** | `0` | صفر | Zero points |
| **1 – 6** | `1 – 6` | كروت عادية | Point values 1 to 6 |
| **7 & 8** | `7, 8` / `PEEK_OWN` | خد فكرة | Peek 1 of your own face-down cards |
| **9 & 10** | `9, 10` / `PEEK_OTHER` | بصرة | Peek 1 face-down card of any opponent |
| **J / Swap** | `11` / `SWAP` | هات وخد | Blind swap 1 of your cards with an opponent's card |
| **Q / Peek & Swap** | `12` / `PEEK_AND_SWAP` | خد وهات بصرة | Peek any card on table, then decide whether to swap |
| **K / Peek All** | `13` / `PEEK_ALL` | كعب داير | Peek 1 card from every player on the table |
| **Red 20** | `+20` | كارت العقوبة | High penalty card — get rid of it fast! |
| **Deluxe Freeze** | `FREEZE` | تجميد | Freezes an opponent so they skip their next turn |
| **Deluxe Bomb** | `+25` | قنبلة | Massive penalty card |

### End-of-Round Scoring:
- When any player declares **"سكرو!" (Skru!)**, every other player gets one final turn.
- All players reveal their hands and sum up points.
- **If Caller strictly wins (lowest points)**: Caller scores `0` points!
- **If Caller loses or ties**: Caller receives a penalty equal to **double their hand score** (or a fixed +30 penalty if score is 0).

---

## 🛡️ Anti-Cheat & Security
- **Zero Card Leaks**: The server sanitizes all payloads before emitting them to clients. Hidden cards contain only `{ cardId: "c_...", isFaceUp: false }`. Even inspecting the browser WebSocket frame log will never expose opponent values.
- **Server Ephemeral Peek Timer**: Peeks are handled via private unicast WebSocket packets (`PEEK_REVEAL`) with server-side cancellation after 4 seconds.
- **Strict Turn Enforcement**: Any action attempted out-of-turn (aside from valid Match Slaps) is authoritatively rejected with `ACTION_REJECTED`.
