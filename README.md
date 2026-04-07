# AI Kanban App

A modern, responsive task management application with AI-powered chat assistant, Kanban board, and timeline calendar. Built with React Native (Expo), TypeScript, and Python FastAPI.

**Design Language:** Electric Brutalist — Bold, stark, high-contrast interface with minimal aesthetics.

---

## 🎯 Features

### 📋 Kanban Board
- **Three-Column Workflow:** TODO → IN PROGRESS → DONE
- **Peek-and-Snap Mobile View:** 75% column width with adjacent column peeking (signaling scrollability)
- **Desktop Grid Layout:** All 3 columns visible side-by-side
- **Brutalist Card Design:** Priority pills, due dates in monospace
- **Smart Status Management:** Drag tickets between columns
- **Ticket Counts:** Real-time count badges per column
- **Responsive Snap Scrolling:** Fast decel on mobile, normal on desktop

### 💬 AI Chat Interface
- **Chat History:** Load and display previous conversations
- **AI Responses:** Send messages and get intelligent replies
- **Task Creation:** Create tickets directly from chat
- **Task Editing:** Edit metadata in chat context
- **Real-time Notifications:** See created tasks instantly
- **Responsive Layout:** Adapts bubble width based on screen size

### 📅 Calendar View
- **Timeline Visualization:** View tasks organized by due date
- **Status Indicators:** Distinguish task states at a glance
- **Date-based Filtering:** Group tickets by deadline
- **Responsive Design:** Fluid layout for all devices

### 👤 User Profile
- **User Statistics:** Total/completed/active task counts
- **Password Management:** Change password securely
- **Graceful Logout:** Branded confirmation modal
- **Session Persistence:** Auto-save login state

### 🔐 Authentication
- **Sign Up / Login:** Create accounts and authenticate
- **Session Management:** Persistent AsyncStorage sessions
- **Password Security:** Change password functionality
- **Network-Aware Configuration:** Centralized API URL setup

---

## 🛠️ Tech Stack

### Frontend
- **React Native** (Expo SDK 50+)
- **TypeScript** — Type-safe code
- **Expo Router** — File-based navigation
- **AsyncStorage** — Local session persistence

### Backend
- **Python 3.11**
- **FastAPI** — REST API framework
- **SQLite** — Database with Chroma vector embeddings
- **CORS** — Cross-origin support

### Design System
- **Electric Brutalist Aesthetic**
  - Colors: `#000000` (black), `#00FF66` (neon green), `#FF2C55` (hot red)
  - Borders: 2px `#1a1a1a` solid
  - Typography: Bold 900 weight, uppercase headers
  - No soft shadows or rounded minimalism

---

## 📁 Project Structure

```
ai-kanban-app/
├── ai-kanban-app/                    # Frontend (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx               # Root layout with gatekeeper
│   │   ├── index.tsx                 # Auth splash screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx           # Tab navigation
│   │       ├── board.tsx             # Kanban board
│   │       ├── chat.tsx              # AI chat interface
│   │       ├── calendar.tsx          # Timeline calendar
│   │       └── profile.tsx           # User profile
│   ├── context/
│   │   └── AuthContext.tsx           # Auth state management
│   ├── constants/
│   │   ├── config.ts                 # API configuration (IP-based)
│   │   └── theme.ts                  # Design system colors
│   ├── app.json                      # Expo config
│   ├── package.json                  # Dependencies
│   └── tsconfig.json                 # TypeScript config
│
└── ai-kanban-backend/                # Backend (Python/FastAPI)
    ├── main.py                       # API server
    └── memory_db/
        └── chroma.sqlite3            # Vector database
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** (for frontend)
- **Python 3.11+** (for backend)
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd ai-kanban-app/ai-kanban-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure backend IP (IMPORTANT for mobile):**
   - Edit `constants/config.ts`
   - Find your computer's local Wi-Fi IPv4 address:
     ```bash
     # macOS/Linux
     ifconfig | grep "inet " | grep -v 127.0.0.1
     
     # Windows
     ipconfig
     ```
   - Update the file:
     ```typescript
     export const BACKEND_URL = 'http://YOUR_IP:8000';
     // Example: 'http://10.1.3.204:8000'
     ```

4. **Start development server:**
   ```bash
   npx expo start
   ```
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Press `w` for web browser
   - Scan QR code with Expo Go app on physical device

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd ai-kanban-backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   # or
   venv\Scripts\activate     # Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start server:**
   ```bash
   python main.py
   ```
   - Server runs on `http://0.0.0.0:8000`
   - Make sure your phone is on the same Wi-Fi network

---

## 🔧 Configuration

### API Base URL (`constants/config.ts`)

The frontend needs to know your computer's local Wi-Fi IP address:

```typescript
/**
 * IMPORTANT: Set this to your computer's local Wi-Fi IP address
 * 
 * Find your IP:
 * - macOS/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
 * - Windows: ipconfig
 * 
 * Example: 'http://192.168.1.42:8000'
 */
export const BACKEND_URL = 'http://YOUR_IP:8000';
```

**Why?** On physical devices, `localhost` resolves to the phone itself, not your computer. Local network IP ensures connectivity.

---

## 📱 Usage

### On Web Browser
1. Start Expo: `npx expo start`
2. Press `w` to open web version
3. All 3 Kanban columns visible side-by-side
4. Login/signup and explore features

### On Physical Device
1. Install **Expo Go** app from App Store/Play Store
2. Make sure phone and computer are on same Wi-Fi
3. Start Expo: `npx expo start`
4. Scan QR code with Expo Go
5. Mobile optimizations activate:
   - Peek-and-snap Kanban carousel
   - Optimized chat bubble widths
   - Touch-friendly spacing

### Features Walkthrough

**Kanban Board:**
- Scroll horizontally (mobile) or view all columns (desktop)
- Tap card to see full details
- Tap priority pill to see urgency level
- Due date shown in monospace format: `[ YYYY-MM-DD ]`
- "+ ADD TICKET" button at bottom of each column

**Chat:**
- Type message and send
- AI responds with task suggestions
- Create tickets from chat with one tap
- See chat history on reload

**Calendar:**
- View all tasks organized by due date
- Color indicators for status
- Tap task to view details

**Profile:**
- See statistics dashboard
- Change password securely
- Logout with confirmation modal

---

## 🎨 Design System

### Color Palette
| Color | Value | Usage |
|-------|-------|-------|
| Background | `#000000` | Main background |
| Surface | `#0A0A0A` | Card backgrounds |
| Border | `#1a1a1a` | 2px borders (dark) |
| Primary | `#00FF66` | Neon green accents |
| Danger | `#FF2C55` | High priority/errors |
| Text | `#FFFFFF` | Primary text |
| Muted | `#666666` | Secondary text, dates |

### Typography
- **Bold:** `fontWeight: '900'` (headers, titles)
- **Uppercase:** Status labels, column names
- **Monospace:** Due dates, ticket IDs
- **LetterSpacing:** Tight tracking for impact

### Spacing
- **Gap:** 16px between elements
- **Padding:** 16px-20px for containers
- **Border:** 2px solid throughout

### Visual Elements
- **No shadows** — Pure borders only
- **Minimal radius:** 8-12px on cards/buttons
- **Stark contrast:** Black/green/red only
- **Dense information:** Typography-driven design

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup          Create new account
POST   /api/auth/login           Login user
POST   /api/auth/change-password Change password
```

### Tickets
```
GET    /api/tickets              Fetch all tickets (user_id query param)
POST   /api/tickets              Create new ticket
PUT    /api/tickets/{id}         Update ticket status/details
```

### Chat
```
POST   /api/chat                 Send message, get AI response
GET    /api/chat/history         Fetch chat history (user_id query param)
```

### User
```
GET    /api/user/stats           Fetch user statistics
```

---

## 📊 Responsive Breakpoints

| Device | Width | Layout |
|--------|-------|--------|
| Mobile | < 768px | Peek-and-snap carousel, vertical priority |
| Tablet | 768px-1024px | 2-3 column grid, touch optimized |
| Desktop | > 1024px | Full 3-column grid, normal scrolling |

**Key Adjustments:**
- Column width (60% mobile vs 340px desktop)
- Font sizes (scaled down on mobile)
- Touch targets (larger on mobile)
- Spacing (compact on mobile, generous on desktop)

---

## 🐛 Troubleshooting

### "Network request failed" on physical device
**Solution:** Update `constants/config.ts` with your computer's local Wi-Fi IP
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Copy the IP address (e.g., 10.1.3.204) into config.ts
```

### Backend not responding
1. Check backend is running: `python main.py`
2. Verify IP address is correct
3. Ensure phone and computer on same Wi-Fi
4. Check firewall isn't blocking port 8000

### Cards not displaying on mobile
1. Clear cache: `npx expo start --clear`
2. Reload app: Press `r` in Expo terminal
3. Hard reload on device: Shake phone, select "Debug JS Remotely"

### Chat not working
1. Check backend `/api/chat` endpoint is implemented
2. Verify user_id is being sent
3. Check browser console for network errors

---

## 🚢 Deployment

### Production Build (iOS)
```bash
cd ai-kanban-app/ai-kanban-app
eas build --platform ios
```

### Production Build (Android)
```bash
eas build --platform android
```

### Web Deployment
```bash
npx expo export --platform web
# Deploy the `dist` folder to your hosting
```

**Note:** Set `BACKEND_URL` to your production API server before building.

---

## 📝 Development Guidelines

### Code Style
- **TypeScript:** Strict mode enabled
- **Naming:** camelCase for functions, PascalCase for components
- **Comments:** Brutalist design comments in all styles
- **Imports:** Absolute imports from constants/context

### Adding New Features
1. Create component in appropriate folder
2. Import design constants from `constants/theme.ts`
3. Use `useWindowDimensions` for responsive logic
4. Wrap data fetches with AbortController
5. Test on both mobile and desktop

### Git Workflow
```bash
git checkout -b feature/my-feature
git commit -m "feat: add new feature"
git push origin feature/my-feature
# Create pull request
```

---

## 📄 License

MIT License — See LICENSE file for details

---

## 👥 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Follow Electric Brutalist design principles
4. Test on mobile and desktop
5. Submit pull request with description

---

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review backend logs: `main.py` output
3. Check frontend console: Expo dev tools
4. Open GitHub issue with:
   - Device type (iOS/Android/Web)
   - Error message
   - Steps to reproduce

---

## 🎓 Learning Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native API](https://reactnative.dev/docs/getting-started)
- [FastAPI Tutorial](https://fastapi.tiangolo.com)
- [Electric Brutalism](https://www.are.na/kyle-machulis/electric-brutalism)

---

## 🏗️ Roadmap

- [ ] Task search functionality
- [ ] Task filtering (by priority, due date)
- [ ] Recurring tasks
- [ ] Team collaboration
- [ ] Push notifications
- [ ] Task attachments
- [ ] Dark/Light mode toggle
- [ ] Offline mode with sync
- [ ] Custom themes

---

**Built with ⚡ by Sohith Vishnu**

Last Updated: April 8, 2026
