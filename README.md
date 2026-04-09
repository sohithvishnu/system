# System — AI Personal OS

A next-generation personal operating system with AI-powered task management, semantic memory extraction, neural matrix profiling with entity dossiers, and intelligent life/work orchestration. Built with React Native (Expo), TypeScript, Python FastAPI, Ollama LLM integration, and secure Tailscale networking.

**Architecture:** Semantic XML tagging system with strict task creation rules, dual-mode Neural Matrix (user facts + entity dossiers for tracking relationships), automatic Tailscale IP management, and bulletproof LLM response parsing.

**Design Language:** Electric Brutalist — Bold, stark, high-contrast interface with minimal aesthetics.

---

## 🎯 Features

### 📋 Kanban Board
- **Three-Column Workflow:** TODO → IN PROGRESS → DONE
- **Peek-and-Snap Mobile View:** 75% column width with adjacent column peeking (signaling scrollability)
- **Desktop Grid Layout:** All 3 columns visible side-by-side
- **Brutalist Card Design:** Priority pills, due dates in monospace
- **Full Ticket CRUD:** Create, read, update, delete with inline edit modal
- **Status Movement:** One-tap buttons to move tickets between columns (↑ up, → right, ← left)
- **Edit Modal:** Modify title, priority, and due date in a modal overlay
- **Ticket Counts:** Real-time count badges per column
- **Pull-to-Refresh:** Drag down to reload tickets from backend
- **Empty States:** Brutalist `[ NO_TASKS_FOUND ]` display when columns are empty
- **Responsive Snap Scrolling:** Fast decel on mobile, normal on desktop
- **Flexible DateTime Support:** Tasks accept DD/MM/YYYY HH:MM format with intelligent time preservation

### 💬 AI Chat Interface - Semantic XML System
- **Semantic Action Tagging:** LLM generates strict `<TASK>`, `<MEMORY>`, and `<PERSON>` XML blocks at response end
- **Strict Task Creation:** ONLY creates tasks on explicit imperative verbs ("Remind me to...", "Create a ticket for...")—prevents false-positive task creation from casual conversation
- **Time Preservation:** User-specified times (e.g., "tomorrow 14:30") are accurately extracted and stored with tasks
- **Neural Matrix (Dual-Mode Identity Profiling):**
  - **User Facts:** Actively extracts personal facts (name, occupation, preferences, goals, relationships) with `<MEMORY>` tags
  - **Entity Dossiers:** NEW — Tracks facts about other people mentioned in conversations with `<PERSON>` tags
  - **Categorized Memory:** IDENTITY, PREFERENCE, GOAL, FACT (user) + PERSON (relationships)
  - **Personnel Dashboard:** View all tracked relationships organized by person name with Terminal-style dossier cards
- **Bulletproof XML Parsing:**
  - Strips markdown code blocks (`` ```xml ``` ``) before extraction
  - Relaxed whitespace handling for multiline XML structures
  - Graceful missing data defaults (e.g., missing date → today, missing time → 00:00)
  - 100% hidden from frontend UI—only conversational text returned to user
  - Handles both 2-part (user facts) and 3-part (PERSON dossiers) formats
- **Daily Logs:** Automatically creates and defaults to `DAILY_LOG_YYYY-MM-DD` thread on each day
- **Persistent Chat Sessions:** Isolate conversations into memory threads with separate context
- **Thread Management:** View and switch between Daily Logs (marked with `[ * ]` and red border) and Custom Threads
- **Session-Isolated Memory:** ChromaDB RAG queries filtered by user_id + session_id
- **AI Model Selection:** Choose from available local Ollama models
- **Dynamic Model Discovery:** Auto-detect installed models via backend
- **Real-time Notifications:** See created tasks and logged memory facts instantly
- **Keyboard Handling:** KeyboardAvoidingView for iOS/Android mobile compatibility
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

### 🧠 Neural Matrix (Dual-Mode Memory Profiling)

#### User Identity Facts
- **Automatic Fact Extraction:** AI actively listens for facts about the user and stores them
- **Categories:** IDENTITY (name, occupation), PREFERENCE (likes/dislikes), GOAL (aspirations), FACT (general information)
- **Persistent Profile:** All extracted facts stored in identity_matrix database table
- **Context Enrichment:** Neural facts inform future chat responses for personalized interactions
- **Memory Dashboard:** View all stored identity facts organized by category

#### Entity Dossiers (NEW)
- **Relationship Tracking:** Automatically build dossiers for people mentioned in conversations
- **PERSON Category:** Uses `<MEMORY>PERSON | Person's Name | Fact about them</MEMORY>` format
- **Personnel Archives:** Dedicated dashboard section showing all tracked individuals
- **Dossier Organization:** Facts grouped by person name in brutalist card layout
- **Terminal Display:** Facts prefixed with `>` prefix for command-line aesthetic
- **Retroactive Mining:** `/api/memory/compile` endpoint mines old chat transcripts for relationship data
- **One-Click Management:** Delete facts, manage who you remember about

### 📔 End-of-Day Journal
- **Daily Summarization:** Automatic journal compilation at end of day
- **Chat + Task Integration:** Summarizes today's conversations and tasks
- **Persistent Entries:** All journals stored and searchable
- **Timeline View:** Browse past summaries by date

### ⚙️ Settings & System Configuration
- **AI Model Selection:** Browse and select from available Ollama models
- **Model Discovery:** Real-time backend detection of installed models
- **System Status:** View backend connectivity and active model in settings
- **Persistent Selection:** Selected model saved to AsyncStorage for next session

### 🔌 System Status Indicator
- **Sidebar Status Module:** Persistent connectivity indicator on left sidebar
- **Health Monitoring:** 10-second polling interval with 3-second timeout
- **Visual Status Dot:** Green (#00FF66) when online, Red (#FF2C55) when offline
- **Active Model Display:** Rotated vertical text showing currently selected AI model
- **Dynamic Font Scaling:** Text automatically scales based on model name length

### 🔐 Authentication
- **Sign Up / Login:** Create accounts and authenticate
- **Session Management:** Persistent AsyncStorage sessions
- **Password Security:** Change password functionality
- **Tailscale Network Config:** Centralized network routing through secure tunnel

---

## 🏛️ Core Architecture

### Semantic XML Tagging System
The system enforces **strict XML semantics** for all AI-driven actions with support for 3-part memory format:

- **`<TASK>` blocks:** Strict task creation from explicit imperative verbs only
- **`<MEMORY>` blocks (2-part):** User facts — `<MEMORY>Category | Fact</MEMORY>`
- **`<MEMORY>` blocks (3-part):** Entity dossiers — `<MEMORY>PERSON | Name | Fact</MEMORY>`
- **Markdown resilience:** Automatically strips `` ```xml ``` `` wrappers and handles multiline formatting
- **Storage format:** Person facts stored as `"PersonName :: SpecificFact"` for reliable parsing
- **Graceful defaults:** Missing dates → today, missing time → 00:00, invalid priorities → MEDIUM

### Neural Matrix (Dual-Mode Identity Profiling)
A persistent database table (`identity_matrix`) stores extracted facts with categories and special handling for relationships:

- **IDENTITY:** Name, occupation, role
- **PREFERENCE:** Likes, dislikes, style preferences
- **GOAL:** Aspirations, objectives, milestones
- **FACT:** General information
- **PERSON:** Relationship dossiers (new category, stores as "Name :: Fact")

Facts are extracted automatically from chat and inform future responses with richer context. Entity dossiers enable relationship tracking across conversations.

### Frontend
- **React Native** (Expo SDK 50+)
- **TypeScript** — Type-safe code
- **Expo Router** — File-based navigation
- **AsyncStorage** — Local session persistence
- **Tailscale IP Auto-Configuration** — Centralized network config via `constants/env.ts`

### Backend
- **Python 3.11**
- **FastAPI** — REST API framework with semantic XML parsing
- **Tailscale Auto-Discovery** — Automatic IP fetching on startup
- **SQLite** — Multi-table schema:
  - `users` — Authentication
  - `tickets` — Task management with flexible datetime parsing
  - `chat_history` — Conversation logs with session isolation
  - `identity_matrix` — Dual-mode memory (user facts + entity dossiers)
  - `custom_prompts` — User-defined system directives
  - `daily_journals` — End-of-day summarizations
- **ChromaDB** — Vector embeddings for RAG (session-filtered)
- **Regex Extraction** — Bulletproof XML tag parsing with 2-part and 3-part support
- **CORS** — Cross-origin support
- **Graceful Shutdown:** Enhanced daemon management with proper cleanup

### AI Integration
- **Ollama** — Local LLM inference on Tailscale network
- **Model Discovery** — Auto-detect installed models
- **Semantic XML Generation** — Strict output format enforcement with PERSON category support

### Network Architecture
- **Tailscale VPN:** Automatic IP detection and configuration
- **Centralized Config:** All network endpoints route through `TAILSCALE_IP`
- **Auto-Update on Start:** Backend and frontend refresh Tailscale IP before each run
- **Production Ready:** No hardcoded IPs in compiled binaries

### Design System
- **Electric Brutalist Aesthetic**
  - Colors: `#000000` (black), `#00FF66` (neon green), `#FF2C55` (hot red)
  - Borders: 2px `#1a1a1a` solid
  - Typography: Bold 900 weight, uppercase headers
  - No soft shadows or rounded minimalism
  - Dossier Cards: Terminal-style with `>` prefix and monospace fonts

---

## 📁 Project Structure

```
system/
├── System-Frontend/                        # Frontend (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx                    # Root layout with console muting & gatekeeper
│   │   ├── index.tsx                      # Auth splash screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx                # Tab navigation with sidebar status
│   │       ├── board.tsx                  # Kanban board with flexible datetime
│   │       ├── chat.tsx                   # AI chat with 3-part memory support
│   │       ├── calendar.tsx               # Timeline calendar
│   │       ├── journal.tsx                # End-of-day journal view
│   │       ├── memory.tsx                 # Neural Matrix + Personnel Dossiers
│   │       ├── profile.tsx                # User profile & stats
│   │       └── settings.tsx               # AI model selection & config
│   ├── context/
│   │   └── AuthContext.tsx                # Auth state management
│   ├── constants/
│   │   ├── config.ts                      # Imports from env.ts
│   │   ├── env.ts                         # Tailscale IP config (auto-updated)
│   │   └── theme.ts                       # Design system colors
│   ├── scripts/
│   │   └── update-tailscale.js            # Auto-update script
│   ├── utils/
│   │   └── dateTimeFormatter.ts           # Flexible datetime parsing
│   ├── app.json                           # Expo config
│   ├── package.json                       # Dependencies + auto-update scripts
│   └── tsconfig.json                      # TypeScript config
│
├── System-Backend/                        # Backend (Python/FastAPI)
│   ├── main.py                            # API server with auto-update startup
│   ├── config.py                          # Config with Tailscale IP + OLLAMA_ENDPOINT
│   ├── datetime_utils.py                  # Flexible datetime parsing
│   ├── scripts/
│   │   └── update-tailscale.py            # Auto-update script (Python)
│   └── memory_db/
│       └── chroma.sqlite3                 # Vector database
│
├── start-system.sh                        # One-command startup (both services)
├── start-terminals.sh                     # Dual-terminal startup (macOS)
├── QUICK_START.md                         # 30-second setup guide
├── STARTUP_GUIDE.md                       # Full startup documentation
├── AUTO_UPDATE_COMPLETE.md                # Architecture details
└── README.md                              # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** (for frontend)
- **Python 3.11+** (for backend)
- **Expo CLI** (`npm install -g expo-cli`)
- **Tailscale** installed and authenticated
- **Ollama** running locally
- **Git**

### Quick Start (Recommended)

```bash
cd /path/to/system
./start-system.sh
```

Everything else is automatic:
- ✅ Backend fetches Tailscale IP → updates `config.py`
- ✅ Frontend fetches Tailscale IP → updates `constants/env.ts`
- ✅ Both start with fresh network configuration
- ✅ View both services' output in one terminal

### Alternative: Separate Terminals (macOS)

```bash
./start-terminals.sh
```

Opens new Terminal windows for backend and frontend separately.

### Manual Setup

#### Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd System-Frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Tailscale IP updates automatically on start:**
   ```bash
   npm start
   ```
   Auto-runs `npm run setup:tailscale` before starting Expo

4. **Connect to app:**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Press `w` for web browser
   - Scan QR code with Expo Go app on physical device

#### Backend

1. **Navigate to backend directory:**
   ```bash
   cd System-Backend
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

4. **Start server (Tailscale IP auto-updates on start):**
   ```bash
   python main.py
   ```
   Auto-runs `scripts/update-tailscale.py` before starting FastAPI server

---

## 🔧 Configuration

### Automatic Tailscale IP Management

**How It Works:**

1. Each service startup automatically fetches current Tailscale IP
2. Backend: `python3 main.py` → updates `config.py`
3. Frontend: `npm start` → updates `constants/env.ts`
4. No manual IP configuration needed

**Verify It's Working:**

Check that these files show your current Tailscale IP:

```bash
# Backend
grep "TAILSCALE_IP" System-Backend/config.py
# grep "OLLAMA_ENDPOINT" System-Backend/config.py

# Frontend
grep "TAILSCALE_IP" System-Frontend/constants/env.ts
```

**Manual IP Update (if needed):**

```bash
# Backend only
cd System-Backend
python3 scripts/update-tailscale.py

# Frontend only
cd System-Frontend
npm run setup:tailscale
```

### DateTime Format Support

Tasks now accept flexible datetime formats:

- **Format:** `DD/MM/YYYY HH:MM` (e.g., `10/04/2026 14:30`)
- **Relative:** `tomorrow 14:30`, `next Friday 10:00`
- **Default Time:** If no time specified, defaults to `00:00`
- **Default Date:** If no date specified, defaults to today
- **AI-Aware:** Preserves user-specified times through chat conversation

**Examples:**

- "Remind me tomorrow at 2:30 PM" → Task for tomorrow at 14:30
- "Meeting on Friday" → Task for next Friday at 00:00
- "Call Mom at 18:00" → Task today at 18:00

---

## 📱 Usage

### On Web Browser
1. Start system: `./start-system.sh` or `npm start` from frontend folder
2. Open web version from Expo output
3. All 3 Kanban columns visible side-by-side
4. Login/signup and explore features

### On Physical Device
1. Install **Expo Go** app from App Store/Play Store
2. Make sure phone and computer are on same Tailscale network (authenticated accounts)
3. Start system: `./start-system.sh`
4. Scan QR code with Expo Go
5. Mobile optimizations activate:
   - Peek-and-snap Kanban carousel
   - Optimized chat bubble widths
   - Touch-friendly spacing

### Features Walkthrough

**Neural Matrix & Personnel Dossiers:**
- Tap "NEURAL / MATRIX" tab
- View [ USER_NEURAL_MATRIX ] section with your extracted facts
- NEW: View [ PERSONNEL_ARCHIVES ] section with dossiers for tracked individuals
- Each person shows name in DOSSIER header with facts prefixed with `>`
- Pull down to compile new facts from chat history (retroactive mining)
- Tap fact to delete or manage

**Chat with Entity Tracking:**
- Mention people in your conversations (e.g., "Moritz is working on AI")
- AI extracts people facts with `<MEMORY>PERSON | Name | Fact</MEMORY>` tags
- Facts automatically appear in Personnel Archives
- Reference archived facts in future conversations

- Active thread highlighted in #00FF66, inactive in dark gray
- Select active AI model in Settings before chatting
- Type message and send (includes selected model + session_id)
- AI responds using chosen model with task suggestions, context limited to current thread
- Create tickets from chat with one tap
- See chat history on reload (filtered by active thread)

**Calendar:**
- View all tasks organized by due date
- Color indicators for status
- Tap task to view details
- Pull down to refresh

**Settings:**
- View available Ollama models (auto-discovered from backend)
- Tap model card to select active model (inverted colors when active)
- See backend connectivity status and selected model info
- Model selection persists across app restarts

**Profile:**
- See statistics dashboard
- Change password securely
- Logout with confirmation modal

**Sidebar Status:**
- Green indicator dot = Backend online
- Red indicator dot = Backend offline
- Rotated model text shows currently active AI model
- Updates every 10 seconds automatically

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

### Chat & Task Processing
```
POST   /api/chat                 Send message with Semantic XML extraction
                                 - Strips markdown code blocks from LLM response
                                 - Extracts <TASK> and <MEMORY> XML blocks
                                 - Returns clean conversational text to frontend
                                 Returns: { reply, task?, success }

GET    /api/chat/history         Fetch session chat history
GET    /api/chat/sessions        Fetch all sessions for user
```

### Neural Matrix (Identity Management)
```
GET    /api/memory/identity      Fetch all stored identity facts (grouped by category)
                                 Returns: { identity: { IDENTITY: [], PREFERENCE: [], ... }, total }

DELETE /api/memory/identity/{id} Delete specific identity fact
```

### Prompts & Configuration

---

## 🤖 Semantic XML Architecture & Entity Dossiers

### What is Semantic XML Tagging?

Instead of relying on natural language understanding for task creation and memory extraction, the system uses **strict XML semantics** with support for both user facts and relationship tracking:

- **Task Format:** `<TASK>Task Title | Priority(LOW/MEDIUM/HIGH) | YYYY-MM-DD HH:MM</TASK>`
- **User Memory Format:** `<MEMORY>Category(IDENTITY/PREFERENCE/GOAL/FACT) | The extracted fact</MEMORY>`
- **Person Memory Format (NEW):** `<MEMORY>PERSON | Person's Name | Fact about them</MEMORY>`

### Key Rules

**RULE 1 - Strict Task Creation:**
- ONLY create tasks on explicit imperative verbs:
  - ✅ "Remind me to buy milk" → ✅ Creates task
  - ✅ "Create a ticket for the conference" → ✅ Creates task
  - ❌ "I need to finish this report" → ❌ No task (casual statement)
- Prevents false-positive task creation from casual conversation
- Time-aware: Preserves user-specified times ("tomorrow at 2:30 PM" → stored as 14:30)

**RULE 2 - Neural Matrix (Dual-Mode Memory Extraction):**
- Actively listen for facts about the user
- Actively listen for facts about other people mentioned in conversations
- If user states a fact about themselves → extract to IDENTITY/PREFERENCE/GOAL/FACT
- If user mentions someone else → extract to PERSON category

**Examples:**

User says: "My name is Sohith and I'm working with Moritz on the Generative AI project"

System extracts:
```xml
<MEMORY>IDENTITY | User's name is Sohith</MEMORY>
<MEMORY>PERSON | Moritz | Working on the Generative AI project</MEMORY>
```

### Entity Dossiers Deep Dive

**Storage Strategy:**
- 3-part format: `PERSON | Name | Fact`
- Stored in database as category='PERSON', fact="Name :: Fact"
- Delimiter `::` (two colons) allows reliable parsing and display

**Example Flow:**

1. **Chat Message:** "Sarah is leading the Q2 planning initiative"
2. **AI Output:** `<MEMORY>PERSON | Sarah | Leading the Q2 planning initiative</MEMORY>`
3. **Backend Processing:**
   - Parses 3-part format
   - Stores: category='PERSON', fact='Sarah :: Leading the Q2 planning initiative'
4. **Frontend Display:**
   - Extracts person name: 'Sarah' (before '::'')
   - Extracts fact: 'Leading the Q2 planning initiative' (after '::')
   - Groups under dossier header: `[ DOSSIER: SARAH ]`
   - Shows with terminal prefix: `> Leading the Q2 planning initiative`

**Personnel Archives Dashboard:**

```
[ PERSONNEL_ARCHIVES ] [3]

[ DOSSIER: MORITZ ] [2]
> Working on the Generative AI project
> Based in Berlin

[ DOSSIER: SARAH ] [1]
> Leading the Q2 planning initiative

[ DOSSIER: ALEX ] [3]
> Interested in machine learning
> Works at EigenCorp
> Plays drums
```

**Retroactive Compilation:**

- Endpoint: `POST /api/memory/compile?user_id=USER_ID`
- Mines all previous chat history for missed dossier entries
- Uses same 3-part XML parser as chat extraction
- Discovered facts appear instantly in Personnel Archives
- One-tap process: `[ COMPILE_ARCHIVES ]` button in UI

### Bulletproof LLM Response Parsing

The Python backend handles real-world LLM quirks with dual-mode support:

1. **Markdown Code Block Stripping:**
   ```regex
   ```xml(.*?)```  →  stripped before extraction
   ```

2. **Flexible Part Splitting:**
   ```python
   # 2-part format (user facts)
   parts = memory_content.split('|')
   if len(parts) == 2:
       category, fact = parts
   
   # 3-part format (person facts)
   elif len(parts) == 3 and parts[0].upper() == 'PERSON':
       category = 'PERSON'
       person_name = parts[1]
       fact = f"{person_name} :: {parts[2]}"
   ```

3. **Relaxed Whitespace Handling:**
   ```regex
   <TASK>\s*(.*?)\s*</TASK>  →  handles newlines/spaces inside tags
   <MEMORY>\s*(.*?)\s*</MEMORY>  →  same for memory tags
   <PERSON>\s*(.*?)\s*</PERSON>  →  same for person dossiers
   ```

4. **Graceful Defaults:**
   - Missing date → defaults to today
   - Missing time → defaults to 00:00
   - Invalid priority → defaults to MEDIUM
   - Invalid category → defaults to FACT
   - Malformed PERSON entry → skipped with warning

5. **Complete Tag Removal:**
   - All XML stripped from response before returning to frontend
   - Frontend UI receives ONLY conversational text
   - Users never see `<TASK>`, `<MEMORY>`, or `<PERSON>` tags

### Response Flow Example

```
LLM Output (Raw):
  "Great! I've added the meeting to your calendar and made a note about your colleagues.
   
   ```xml
   <TASK>Attend Q2 planning meeting | HIGH | 2026-04-15 14:00</TASK>
   <MEMORY>IDENTITY | User works as a product manager</MEMORY>
   <MEMORY>PERSON | Sarah | Leading the Q2 planning initiative</MEMORY>
   <MEMORY>PERSON | Moritz | Will present technical roadmap</MEMORY>
   ```"

→ Step 1: Strip markdown code blocks
"<TASK>Attend Q2 planning meeting | HIGH | 2026-04-15 14:00</TASK>
<MEMORY>IDENTITY | User works as a product manager</MEMORY>
<MEMORY>PERSON | Sarah | Leading the Q2 planning initiative</MEMORY>
<MEMORY>PERSON | Moritz | Will present technical roadmap</MEMORY>"

→ Step 2: Extract and process each tag
[TASK_CREATED] Attend Q2 planning meeting (HIGH, 2026-04-15 14:00)
[NEURAL_MATRIX_UPDATED] [IDENTITY] User works as a product manager
[DOSSIER_CREATED] Sarah: Leading the Q2 planning initiative
[DOSSIER_CREATED] Moritz: Will present technical roadmap

→ Step 3: Remove all tags from response

→ Step 4: Frontend receives:
"Great! I've added the meeting to your calendar and made a note about your colleagues."
```

### End-of-Day Journal System

**Daily Summarization:**
- Automatic compilation of today's chat + tasks
- Endpoint: `POST /api/journal/summarize`
- Sends LLM: today's conversations + incomplete tasks
- Generates: Markdown summary with insights

**Journal Storage:**
- Table: `daily_journals`
- Fields: date, summary, task_count, memory_count
- Queryable by date range
- Accessible via `/api/journal/history`

**Usage in UI:**
- Dedicated Journal tab in tab bar
- Date picker for historical journals
- Markdown rendering with proper formatting
- Pull-to-refresh for latest summaries

---

## 🔌 API Endpoints (Comprehensive)

### Authentication
```
POST   /api/auth/signup              Create new account
POST   /api/auth/login               Login user (returns session token)
POST   /api/auth/change-password     Change password securely
```

### Tickets (Task Management)
```
GET    /api/tickets                  Fetch all tickets (user_id query param)
POST   /api/tickets                  Create new ticket with flexible datetime
PUT    /api/tickets/{id}             Update ticket status/details/due date
DELETE /api/tickets/{id}             Delete ticket
```

### Chat & AI Processing
```
POST   /api/chat                     Send message with Semantic XML extraction & 3-part memory
                                     - Extracts <TASK>, <MEMORY> (2-part), and <MEMORY> (3-part) tags
                                     - Stores user facts in user Identity Matrix
                                     - Stores person facts in entity dossiers
                                     - Strips all XML from response
                                     Returns: { reply, task?, success }

GET    /api/chat/history             Fetch session chat history (session_id filtered)
GET    /api/chat/sessions            Fetch all sessions for user (includes DAILY_LOG detection)
POST   /api/chat/sessions            Create new custom named thread
```

### Neural Matrix (Identity + Entity Management)
```
GET    /api/memory/identity          Fetch all stored facts (grouped by category)
                                     Returns: { 
                                       identity: { 
                                         IDENTITY: [...],
                                         PREFERENCE: [...],
                                         GOAL: [...],
                                         FACT: [...],
                                         PERSON: [...]
                                       },
                                       total: number
                                     }

POST   /api/memory/compile           Mine chat history for missed facts (retroactive dossier building)
                                     Uses identical 3-part XML parser as /api/chat
                                     Returns: { success, facts_extracted }

DELETE /api/memory/identity/{id}     Delete specific fact (user or person)
```

### End-of-Day Journal
```
POST   /api/journal/summarize        Compile today's chat + tasks into summary
                                     Returns: { success, summary, saved }

GET    /api/journal/history          Fetch past journal entries (limit=30 default)
GET    /api/journal/{date}           Fetch specific date's journal
```

### System & Configuration
```
GET    /api/health                   Backend connectivity check
GET    /api/ai/models                List available Ollama models
POST   /api/prompts                  Create custom system prompt
GET    /api/prompts                  Fetch custom prompts (user_id filtered)
PUT    /api/prompts/{id}             Update custom prompt
GET    /api/user/stats               Fetch user statistics (tasks, memory count, etc.)
```

---

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

### Status indicator shows RED (offline)
1. Verify backend is running on port 8000
2. Check health endpoint manually: `curl http://localhost:8000/api/health`
3. Confirm BACKEND_URL in config.ts is correct and accessible from device

### Settings screen shows "OLLAMA_OFFLINE"
1. Verify Ollama is running on http://localhost:11434
2. Check backend can reach Ollama: `curl http://localhost:11434/api/tags`
3. Start Ollama: `ollama serve`

### Chat not sending messages with selected model
1. Verify model is saved to AsyncStorage: Check settings screen for active model
2. Check backend /api/chat receives model field
3. Verify selected model exists in Ollama: `ollama list`
4. Check Ollama is running and responsive

### XML Tags Not Being Extracted (Tasks/Memory Not Creating)
1. Check backend logs for `[TASK_CREATED]` or `[NEURAL_MATRIX_UPDATED]` messages
2. Verify LLM is generating proper XML format:
   - Expected: `<TASK>Title | Priority | Date</TASK>`
   - Check: Are pipes `|` properly delimited?
3. Test with explicit imperative verb: "Remind me to update README"
   - Should trigger `<TASK>` extraction
   - Casual statement "I should update README" should NOT create task
4. Check for markdown wrapping: Look for `` ```xml...``` `` in raw response
   - Backend should strip these automatically
5. Verify database connectivity: Check `sqlite3 workspace.db "SELECT * FROM tickets LIMIT 1"`
6. Restart backend: `python main.py` (ensure latest XML parsing logic loaded)

### Memory Facts Not Being Extracted (Neural Matrix Empty)
1. Send explicit personal fact: "My name is Sohith" or "I work as an engineer"
2. Check backend logs for `[NEURAL_MATRIX_UPDATED]` messages
3. Verify identity_matrix table exists:
   ```bash
   sqlite3 workspace.db "SELECT * FROM identity_matrix LIMIT 1"
   ```
4. Check /api/memory/identity endpoint returns facts:
   ```bash
   curl "http://localhost:8000/api/memory/identity?user_id=YOUR_ID"
   ```
5. Verify LLM is generating `<MEMORY>` tags with proper format:
   - Expected: `<MEMORY>IDENTITY | User's name is Sohith</MEMORY>`
   - Categories: IDENTITY, PREFERENCE, GOAL, FACT

### False-Positive Tasks Being Created
1. This should NOT happen with strict XML rules
2. If casual statements create tasks, check that LLM is following rules:
   - Backend system prompt enforces: "ONLY create task if explicit imperative verb"
   - Verify latest config.py has correct DEFAULT_SYSTEM_PROMPT
3. Check model is not hallucinating XML tags
   - Try different model in Settings
4. Review backend logs—check if `[TASK_CREATION_DIRECTIVE]` message appears in context

### Daily log not appearing on app start
1. Clear AsyncStorage: Kill app completely and restart
2. Check /api/chat/sessions endpoint returns proper data
3. Verify backend database has chat_history table with session_id column
4. Run migration manually:
   ```python
   # In main.py init_db() function - should auto-run
   # Check logs: "Added session_id column" message should appear
   ```
5. Try creating custom thread to verify sessions work, then restart app

### Custom thread not persisting after app restart
1. Verify thread name saved to backend: Select thread, send message
2. Check AsyncStorage: Browser DevTools → Application → AsyncStorage
3. Verify backend returns thread in /api/chat/sessions
4. Check database directly:
   ```bash
   sqlite3 System-Backend/memory_db/chroma.sqlite3
   SELECT DISTINCT session_id FROM chat_history;
   ```

### Thread selector shows duplicate threads or empty
1. Force refresh: `npx expo start --clear`
2. Check /api/chat/sessions response in network tab
3. Verify daily log injection logic: Thread with `[ * ]` should appear at top
4. Check for session_id typos in database vs frontend

### Cards not displaying on mobile
1. Clear cache: `npx expo start --clear`
2. Reload app: Press `r` in Expo terminal
3. Hard reload on device: Shake phone, select "Debug JS Remotely"

### Ticket edit modal not appearing
1. Verify ticket card is tappable (on board.tsx)
2. Check modal state is triggering: Look for `setEditingTicket()` in logs
3. Ensure KeyboardAvoidingView is wrapping modal on mobile devices

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

- [x] Task CRUD operations (Create, Read, Update, Delete)
- [x] AI model selection and discovery
- [x] System health monitoring
- [x] Semantic XML tagging system (strict task/memory extraction)
- [x] Neural Matrix (user identity profiling & memory logging)
- [x] Entity Dossiers (track facts about other people)
- [x] Bulletproof markdown formatting resilience
- [x] Production-grade error handling & UI polish
- [x] Persistent chat sessions with memory threads
- [x] Flexible DateTime parsing (DD/MM/YYYY HH:MM format)
- [x] Time-preserved task extraction from chat
- [x] End-of-Day Journal summarization
- [x] Automatic Tailscale IP management (dual-service auto-update)
- [x] Centralized network configuration
- [x] Retroactive memory compilation (`/api/memory/compile`)
- [x] Personnel dossier dashboard
- [ ] Task search functionality
- [ ] Task filtering (by priority, due date, person, model)
- [ ] Recurring tasks
- [ ] Team collaboration
- [ ] Push notifications
- [ ] Task attachments
- [ ] Dark/Light mode toggle
- [ ] Offline mode with sync
- [ ] Custom themes
- [ ] Multi-language support
- [ ] Advanced memory queries (temporal, semantic, relationship graphs)
- [ ] Fact verification & conflict resolution
- [ ] Voice input for chat
- [ ] Task voice reminders

---

**Built with ⚡ by Sohith Vishnu**

Last Updated: April 10, 2026 (v2.0 Production — Entity Dossiers + Tailscale Auto-Config)
