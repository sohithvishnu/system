# MkDocs Documentation Integration Guide

## Complete setup for Brutalist Wiki + React Native frontend

This guide ties all components together: MkDocs configuration, brutal theme CSS, and React Native documentation module.

---

## 📦 DELIVERABLES CHECKLIST

### ✅ 1. MkDocs Configuration (`mkdocs.yml`)

**Location:** `mkdocs.yml` (project root)

**What it does:**
- Configures Material theme for MkDocs
- Defines navigation structure (8 main sections, 40+ pages)
- Enables Markdown extensions (admonitions, tables, code highlighting)
- Points to brutalist CSS overrides

**Key sections:**
```
- System Overview & Quick Start
- Core Architecture (Semantic XML, Dual-Mode Database)
- Memory Systems (Neural Matrix, Chat Memory, Entity Dossiers)
- Backend Services (FastAPI, Celery, Ollama)
- Frontend Integration (React Native, routing, state)
- API Reference (Auth, Chat, Memory, Topology, Knowledge)
- Friday Protocol (Message format, semantics, roadmap)
- Operations (Docker, Backups, Monitoring, Troubleshooting)
```

### ✅ 2. Brutalist Theme CSS (`docs/stylesheets/extra.css`)

**Location:** `docs/stylesheets/extra.css` (500+ lines)

**What it does:**
- Overrides Material theme CSS variables
- Implements electric brutalist design
- Pure black background (`#000000`)
- Dark gray surfaces (`#0A0A0A`)
- Neon green accents (`#00FF66`) for info/links
- Hot red accents (`#FF2C55`) for errors/warnings
- Hard 2px solid borders, no rounded corners
- Bold typography, stark contrast

**Styling coverage:**
- Header & navigation
- Content areas
- Code blocks & inline code
- Tables & lists
- Admonitions (note, warning, success, danger)
- Buttons & controls
- Forms & search
- Responsive mobile layout

### ✅ 3. Frontend Integration (`System-Frontend/app/(tabs)/settings.tsx`)

**Location:** `System-Frontend/app/(tabs)/settings.tsx`

**What it does:**
- Adds "SYSTEM_DOCUMENTATION" section to settings screen
- Displays doc server status indicator (online/offline)
- Includes "OPEN_DOCUMENTATION" button
- Opens `http://localhost:8000` in default browser
- Shows setup instructions for local + production

**Components added:**
```tsx
// State:
- docServerOnline: boolean
- checkingDocsStatus: boolean
- DOCS_URL: string

// Functions:
- checkDocsStatus(): Verifies docs server is running
- openDocumentation(): Launches browser to docs URL

// UI:
- docsStatusCard: Server status display
- docsOpenBtn: Launch button
- docsInfoBox: Setup instructions
```

**Styling:**
- Inherits brutalist theme from settings
- Hard borders, neon green accents
- Status indicator (dot + text)
- Monospace font for URLs

---

## 🚀 INSTALLATION & SETUP

### Step 1: Install MkDocs

```bash
# Install globally
pip install mkdocs mkdocs-material pymdown-extensions

# Verify
mkdocs --version
# mkdocs, version 1.5.0
```

### Step 2: Start documentation server locally

```bash
# From project root
mkdocs serve

# Output:
# [INFO] Serving on http://127.0.0.1:8000
# [INFO] Watch file *.md
```

### Step 3: Verify React Native integration

Open React Native app → Settings → Scroll to "SYSTEM_DOCUMENTATION"

**Expected:**
- Status indicator shows "ONLINE" (green dot)
- Button text: "[ OPEN_DOCUMENTATION ]"
- Setup instructions visible

### Step 4: Click button to open docs

Clicking "OPEN_DOCUMENTATION" launches browser to `http://localhost:8000`

**Expected:**
- MkDocs site load with electric brutalist theme
- Navigation sidebar visible on left
- Pure black background + neon green text
- Monospace fonts for code

---

## 📋 DIRECTORY STRUCTURE

```
Project/
├── mkdocs.yml                          ← MkDocs configuration
├── docs/                               ← Documentation root
│   ├── index.md                        ← Home page
│   ├── stylesheets/
│   │   └── extra.css                   ← Brutalist CSS (500+ lines)
│   ├── overview/
│   │   ├── quickstart.md               ← 5-minute start
│   │   ├── architecture.md             ← System design
│   │   └── deployment.md               ← Phase 4 summary
│   ├── architecture/
│   │   ├── semantic_xml.md             ← Fact format
│   │   ├── dual_mode_db.md             ← SQLite + ChromaDB
│   │   └── neural_matrix.md            ← Encryption
│   ├── memory/
│   │   ├── neural_matrix.md
│   │   ├── chat_memory.md
│   │   ├── entity_dossiers.md
│   │   └── semantic_recall.md
│   ├── backend/
│   │   ├── routers.md
│   │   ├── celery.md
│   │   ├── ollama.md
│   │   └── database.md
│   ├── frontend/
│   │   ├── react_native.md
│   │   ├── routing.md
│   │   ├── state.md
│   │   └── screens.md
│   ├── api/
│   │   ├── auth.md                     ← JWT + encryption
│   │   ├── chat.md
│   │   ├── memory.md
│   │   ├── topology.md
│   │   └── knowledge.md
│   ├── protocol/
│   │   ├── overview.md
│   │   ├── message_format.md
│   │   ├── semantics.md
│   │   └── roadmap.md
│   ├── ops/
│   │   ├── docker.md                   ← Deployment guide
│   │   ├── backup.md
│   │   ├── monitoring.md
│   │   └── troubleshooting.md
│   └── security/
│       ├── encryption.md
│       ├── auth.md
│       ├── privacy.md
│       └── threat_model.md
├── System-Frontend/
│   └── app/(tabs)/
│       └── settings.tsx                ← Updated with docs module
└── System-Backend/
    └── [backend code]
```

---

## 🎨 THEME CUSTOMIZATION

The brutalist theme is fully customizable. Edit `docs/stylesheets/extra.css`:

### Change accent color (neon green → cyan)

```css
:root {
  --md-primary-fg-color: #00FFFF;  /* was #00FF66 */
  --md-code-fg-color: #00FFFF;
  --md-accent-fg-color: #FF2C55;   /* keep red for errors */
}
```

### Change background

```css
:root {
  --md-default-bg-color: #001a00;      /* dark green instead of black */
  --md-primary-bg-color--light: #0a2a0a;
  --md-code-bg-color: #0a2a0a;
}
```

### Add custom color scheme

```css
.highlight-critical {
  border-left: 4px solid #FF2C55 !important;
  background-color: #0A0A0A !important;
  padding: 12px !important;
}
```

Use in markdown:
```markdown
<div class="highlight-critical">
Critical production change required.
</div>
```

---

## 📱 REACT NATIVE INTEGRATION DETAILS

### What was added to settings.tsx

**Imports:**
```tsx
import { Linking } from 'react-native';
```

**State:**
```tsx
const [docsServerOnline, setDocsServerOnline] = useState<boolean>(false);
const [checkingDocsStatus, setCheckingDocsStatus] = useState(false);
const DOCS_URL = 'http://localhost:8000';
```

**Functions:**
```tsx
// Check if docs server is running
const checkDocsStatus = useCallback(async () => {
  setCheckingDocsStatus(true);
  try {
    const response = await fetch(DOCS_URL, { method: 'HEAD', timeout: 3000 });
    setDocsServerOnline(response.status < 500);
  } catch (e) {
    setDocsServerOnline(false);
  } finally {
    setCheckingDocsStatus(false);
  }
}, []);

// Open documentation in browser
const openDocumentation = async () => {
  try {
    const canOpen = await Linking.canOpenURL(DOCS_URL);
    if (canOpen) {
      await Linking.openURL(DOCS_URL);
    } else {
      Alert.alert('DOCS_OFFLINE', `Cannot connect to ${DOCS_URL}`);
    }
  } catch (e) {
    Alert.alert('ERROR', 'Failed to open documentation URL');
  }
};
```

**UI Section:**
```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>[ SYSTEM_DOCUMENTATION ]</Text>
  <View style={styles.docsStatusCard}>
    {/* Status indicator + server URL */}
  </View>
  <TouchableOpacity onPress={openDocumentation}>
    <Text>[ OPEN_DOCUMENTATION ]</Text>
  </TouchableOpacity>
  <View style={styles.docsInfoBox}>
    {/* Setup instructions */}
  </View>
</View>
```

---

## 🔗 PRODUCTION DEPLOYMENT

### Deploy docs to web server

```bash
# Build static site
mkdocs build

# Output in ./site/ directory
# Upload to web server:
rsync -av site/ user@server:/var/www/docs/

# Or use Docker:
docker build -t mkdocs-site .
docker run -d -p 8080:80 -v $(pwd)/site:/usr/share/nginx/html nginx
```

### Update React Native to point to production

Edit `System-Frontend/app/(tabs)/settings.tsx`:

```tsx
// Before (local):
const DOCS_URL = 'http://localhost:8000';

// After (production):
const DOCS_URL = 'https://docs.system.local';
```

### Update mkdocs.yml for production

```yaml
site_url: "https://docs.system.local/"
```

---

## 🔧 MAINTENANCE & UPDATES

### Adding new documentation page

1. Create `.md` file in appropriate folder
2. Add to navigation in `mkdocs.yml`
3. Rebuild: `mkdocs build`

**Example:**
```bash
# Create new page
touch docs/backend/websockets.md

# Edit mkdocs.yml
nav:
  - Backend Services:
    - FastAPI Routers: backend/routers.md
    - Celery Workers: backend/celery.md
    - WebSockets: backend/websockets.md  # ← Add here
    - Ollama Integration: backend/ollama.md
```

### Updating theme

Edit `docs/stylesheets/extra.css` and reload documentation.

**Note:** CSS changes take effect immediately (no rebuild needed)

### Syncing mobile + web docs

Both use same markdown source:
- Tests run against `docs/` directory
- MkDocs serves compiled HTML
- React Native links to web version

Any changes to docs automatically reflected in both.

---

## 🎯 NEXT STEPS

### Phase 5+: Advanced features

- [ ] Search functionality (MkDocs built-in)
- [ ] Full-text search in mobile app
- [ ] Export docs as PDF
- [ ] Multi-language support
- [ ] API documentation auto-generation (OpenAPI)

### Kubernetes integration

```yaml
apiVersion: v1
kind: Service
metadata:
  name: docs
spec:
  ports:
  - port: 80
    targetPort: 8000
  selector:
    app: mkdocs
```

---

## 📊 STATISTICS

| Component | Lines | Files |
|-----------|-------|-------|
| mkdocs.yml | 100 | 1 |
| extra.css (brutalist) | 500+ | 1 |
| React Native integration | 150+ | 1 |
| Documentation (foundation) | 2000+ | 10+ |
| **Total** | **2750+** | **13+** |

---

## ✅ VERIFICATION CHECKLIST

- [ ] `mkdocs serve` runs without errors
- [ ] Browser opens to `http://localhost:8000` showing electric brutalist theme
- [ ] Navigation sidebar shows all sections
- [ ] Code blocks display with green text on dark background
- [ ] React Native app loads settings page without errors
- [ ] Documentation section visible in settings
- [ ] Status indicator shows online/offline correctly
- [ ] Clicking button opens docs URL in browser
- [ ] All CSS overrides working (no Material defaults visible)
- [ ] Mobile responsive layout works

---

## 🆘 TROUBLESHOOTING

### MkDocs won't start

```bash
# Error: Command not found
pip install --upgrade mkdocs

# Error: Port 8000 in use
mkdocs serve -a 127.0.0.1:8001
```

### React Native button doesn't open browser

```tsx
// Debug: Check if URL is valid
import { Linking } from 'react-native';

Linking.canOpenURL('http://localhost:8000').then(supported => {
  console.log('Can open:', supported);
});

// On Android, need app permission
// android/app/src/main/AndroidManifest.xml:
// <uses-permission android:name="android.permission.INTERNET" />
```

### CSS not applying

- Clear browser cache: `Ctrl+Shift+Delete`
- Hard refresh: `Ctrl+Shift+R`
- Check file saved: `ls -la docs/stylesheets/extra.css`
- Rebuild: `mkdocs build`

---

## 📞 SUPPORT

**Issues:**
- GitHub Issues: Report problems with docs build
- Sentry: Error tracking (Phase 3+)
- Local logs: `mkdocs serve` output

**Documentation updates:**
- Edit `.md` files in `docs/`
- Add navigation in `mkdocs.yml`
- No code rebuild needed

---

**Status:** Complete integration ready for deployment  
**Last Updated:** April 16, 2026  
**Phase:** 4 (all documentation infrastructure complete)
