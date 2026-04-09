# 🧪 Authentication Testing Guide

## ✅ Prerequisites

### Terminal 1: Backend Running
```bash
# Verify backend is running on port 8000
curl http://localhost:8000/api/auth/signup \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' 2>/dev/null | grep -q "success" && echo "✅ Backend OK" || echo "❌ Backend not responding"
```

### Terminal 2: Frontend Ready
```bash
cd /Users/sohith/Documents/Assistant-app/ai-kanban-app/ai-kanban-app
npx expo start -c  # Clear cache to avoid casing warnings
```

---

## 📱 Manual Testing Sequence

### **Test 1: Fresh User Signup**

**Steps:**
1. Open Expo Go or web preview
2. See "BUBBLE v2.0" splash screen
3. Tap "New here? Create account"
4. **Expected**: Redirected to signup form

**Form Interaction:**
```
[USERNAME field]
  ↓ Type: "testuser_prod"
  ✓ After 3 chars: username label appears in purple

[PASSWORD field]  
  ↓ Type: "password123"
  ✓ After 6 chars: password label appears
  ✓ Eye icon toggles visibility

[CONFIRM PASSWORD field]
  ↓ Type: "password123"
  ✓ Eye icon (separate) toggles visibility
  ✓ Success message: "✓ Passwords match" appears in green

[CREATE ACCOUNT button]
  ✓ Button enabled (was disabled until form valid)
  ✓ Tap button
```

**Expected Outcome:**
```
✅ No error message
✅ Loading spinner shows "Creating account..."
✅ Auto-redirects to /chat tab
✅ Can see empty chat interface
✅ User greeting shows "testuser_prod"
```

---

### **Test 2: Duplicate Username**

**Steps:**
1. From login screen, tap "New here? Create account"
2. Enter: username="testuser_prod", password="newpass456", confirm="newpass456"
3. Tap "CREATE ACCOUNT"

**Expected:**
```
❌ Error message: "Username already exists"
❌ No redirect
⏱️ Can retry with different username
```

---

### **Test 3: Invalid Passwords**

**Scenario A: Password too short**
```
Username: "newuser1"
Password: "short"      (less than 6 chars)
↓
Error: "Password must be at least 6 characters"
Helper text shows minimum requirement
```

**Scenario B: Passwords don't match**
```
Password: "password123"
Confirm:  "password124"
↓
Error: "Passwords do not match"
No success message shown
```

**Scenario C: Username too short**
```
Username: "ab"         (less than 3 chars)
↓
Error: "Username must be at least 3 characters"
Helper text shown under field
```

---

### **Test 4: Login with Registered User**

**Steps:**
1. From splash screen, enter credentials:
   - Username: "testuser_prod"
   - Password: "password123"
2. Tap "START SESSION" button

**Expected:**
```
✅ Spinner shows "Authenticating..."
✅ No error
✅ Auto-navigates to /chat tab
✅ Session persisted
```

---

### **Test 5: Login with Wrong Password**

**Steps:**
1. Username: "testuser_prod"
2. Password: "wrongpassword"
3. Tap "START SESSION"

**Expected:**
```
❌ Error: "Invalid username or password"
❌ Password field cleared
⏱️ Can retry
```

---

### **Test 6: Login with Non-existent User**

**Steps:**
1. Username: "nonexistent_user"
2. Password: "password123"
3. Tap "START SESSION"

**Expected:**
```
❌ Error: "Invalid username or password"
❌ No user enumeration (same message as wrong password)
```

---

### **Test 7: Network Error**

**Steps:**
1. Stop backend: `lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9`
2. Try login or signup
3. Tap submit button

**Expected:**
```
❌ Error: "Network error: Unable to reach server"
⏱️ Can restart backend and retry
```

**Recovery:**
```bash
# Restart backend
python3 /Users/sohith/Documents/Assistant-app/ai-kanban-backend/main.py
# Retry login - should work now
```

---

### **Test 8: Session Persistence**

**Steps:**
1. Login successfully: testuser_prod / password123
2. Stay on /chat tab
3. **Close app completely**
4. **Reopen Expo Go / refresh preview**

**Expected:**
```
✅ Skips login screen
✅ Directly shows /chat tab (no redirect to /)
✅ User session active
✅ No "Authenticating..." spinner
```

---

### **Test 9: Logout & Re-login**

**Steps:**
1. At top-right of chat screen, tap ⚙️ (settings)
2. Tap "Logout"
3. Confirm logout

**Expected:**
```
✅ Redirected to login screen
✅ AsyncStorage cleared
✅ Can login again with same credentials
```

---

### **Test 10: Keyboard Navigation**

**On Signup Form:**
```
1. Focus: Username field
   → Tap "next" on keyboard
   → Focus: Password field ✅

2. Focus: Password field  
   → Tap "next" on keyboard
   → Focus: Confirm Password field ✅

3. Focus: Confirm Password field
   → Tap "done" on keyboard
   → Submits form ✅
```

---

## 🐛 Troubleshooting

### **Problem: "Backend offline or error" message**
```bash
# Check if backend is running
lsof -i :8000 | grep LISTEN

# If not running, start it:
python3 /Users/sohith/Documents/Assistant-app/ai-kanban-backend/main.py

# Check logs for errors
# Backend console should show:
# [SIGNUP] Attempting signup for user: ...
# [SIGNUP] Creating user ... with ID ...
# [SIGNUP] Successfully created user ...
```

### **Problem: Casing warning "App/signup vs app/signup"**
```bash
# This is a bundler cache issue, not a functional error
# Fix by clearing cache:
npx expo start -c
```

### **Problem: Can't see password visibility toggle**
- Make sure you tapped on the correct eye icon
- Password fields should have eye icons on the right side
- Try clearing cache: `rm -rf .expo node_modules/.cache`

### **Problem: "Username already exists" but user is new**
- Database might have old data
- Wipe database and restart backend:
  ```bash
  rm /Users/sohith/Documents/Assistant-app/ai-kanban-backend/workspace.db
  python3 /Users/sohith/Documents/Assistant-app/ai-kanban-backend/main.py
  ```

---

## 📊 Test Results Checklist

- [ ] Signup with new user works
- [ ] Duplicate username error handled
- [ ] Password validation rules enforced
- [ ] Password confirmation matching works
- [ ] Login with correct password works
- [ ] Login with wrong password fails correctly
- [ ] Non-existent user handled gracefully
- [ ] Session persists after app restart
- [ ] Logout clears session
- [ ] Keyboard navigation works
- [ ] Error messages clear and helpful
- [ ] Loading states show progress
- [ ] Network errors handled
- [ ] Form disabled state while loading
- [ ] Eye toggles work independently

---

## 🎯 Success Criteria

**All items must be ✅**:
1. ✅ Signup creates user in database
2. ✅ Login validates password with hash
3. ✅ Session stored in AsyncStorage
4. ✅ No unhandled errors in console
5. ✅ UI is responsive and polished
6. ✅ Error messages are clear
7. ✅ Transitions are smooth
8. ✅ Keyboard handling works
9. ✅ Backend logs show activity
10. ✅ Network errors gracefully handled

---

## 🤖 ROOT_SYSTEM Agent & Daily Logs Testing

### **Setup: Start Fresh**

Before testing, prepare your app state:

```bash
# Terminal: Backend
cd System-Backend
python main.py

# Terminal: Frontend  
cd System-Frontend
npx expo start -c  # Clear cache

# Terminal: Ollama (if not running)
ollama serve
```

### **Test 1: Daily Log Auto-Creation on App Launch**

**Precondition:**
- User logged in
- No active sessions (or first time opening app for today)

**Steps:**
1. Kill app completely (swipe up on iOS, back button multiple times on Android)
2. Wait 3 seconds
3. Reopen app and navigate to Chat tab
4. **Expected Results:**
   - ✅ Thread selector displays: `[ * ] DAILY_LOG_2026-04-09` (today's date)
   - ✅ Active thread chip is highlighted in green (#00FF66)
   - ✅ Header displays: `ROOT_SYSTEM // [your_username] → // DAILY_LOG_2026-04-09`
   - ✅ Message history is empty (first time today)
   - ✅ Input field ready for typing

**Validation:**
```bash
# Backend: Check database
sqlite3 System-Backend/memory_db/chroma.sqlite3
SELECT DISTINCT session_id FROM chat_history WHERE user_id = 'testuser_prod' ORDER BY session_id;
# Output should include: DAILY_LOG_2026-04-09
```

**Failure Scenarios:**
- ❌ Thread selector empty: Daily log injection failed
- ❌ Yesterday's log active instead of today's: Default session logic broken
- ❌ Header shows UUID instead of date: Session name not loading

---

### **Test 2: ROOT_SYSTEM Persona in LLM Responses**

**Precondition:**
- Daily log open and active
- AI model selected in Settings (e.g., "mistral")
- Ollama running with at least one model

**Steps:**
1. In chat, type: `"What's your name?"` and send
2. Wait for AI response
3. **Expected Behavior:**
   - ✅ Response starts without pleasantries ("Hi there!", "Happy to help", etc.)
   - ✅ Response identifies as ROOT_SYSTEM or indicates OS-level role
   - ✅ Tone is analytical, concise, slightly technical
   - ✅ No emoji usage
   - ✅ Response appears in gray bubble on right

**Example Expected Response:**
```
ROOT_SYSTEM. I manage your life hub, Kanban tasks, and daily logs.
What can I help you accomplish today?
```

**Example Unexpected Response (FAIL):**
```
Hi there! I'm happy to help! 😊 I'm an AI assistant...
```

**Cause of Failure:**
- Persona injection not working in backend prompt
- Check main.py lines 416-442: ROOT_SYSTEM prepended to prompt?

---

### **Test 3: Custom Thread Creation with Alert Prompt**

**Precondition:**
- Daily log open
- Chat tab focused

**Steps:**
1. Tap `[ + NEW_THREAD ]` button in thread selector
2. **Expected:** iOS/Android native Alert appears with:
   - Title: "New thread"
   - Input field asking for name
3. Type thread name: `"My Research Project"`
4. Tap create/confirm
5. **Expected Results:**
   - ✅ Alert closes
   - ✅ New thread appears in selector immediately: `MY_RESEARCH_PROJECT` (uppercase + underscores)
   - ✅ New thread is now active (green highlight)
   - ✅ Header updates: `ROOT_SYSTEM // [user] → // MY_RESEARCH_PROJECT`
   - ✅ Chat history is empty (new thread)
   - ✅ Selector still shows daily log with `[ * ]` prefix and red border

6. Send message: `"Start analyzing"`
7. **Expected:**
   - ✅ Message appears in bubble
   - ✅ AI responds in ROOT_SYSTEM voice
   - ✅ Message saved to MY_RESEARCH_PROJECT session

**Validation:**
```bash
# Backend: Check thread exists
curl "http://localhost:8000/api/chat/sessions?user_id=testuser_prod" 2>/dev/null | jq '.sessions[] | .id'
# Output should include: MY_RESEARCH_PROJECT
```

**Failure Scenarios:**
- ❌ Thread doesn't appear in selector after creation: State update timing issue
- ❌ Thread disappears after sending message: AsyncStorage not persisting
- ❌ Name not formatted (lowercase instead of uppercase): String formatting bug
- ❌ Alert doesn't appear: Native module integration broken

---

### **Test 4: Session Isolation (Memory Per Thread)**

**Precondition:**
- Multiple threads with messages:
  - DAILY_LOG_2026-04-09: "What's my project deadline?"
  - PROJECT_RESEARCH: "Define quantum computing"
  - MY_ANALYSIS: "Summarize yesterday's findings"

**Steps:**
1. Active in DAILY_LOG_2026-04-09
2. Type: `"What did I ask about yesterday's project?"`
3. **Expected:** ROOT_SYSTEM refers only to today's log context, doesn't know about PROJECT_RESEARCH
4. Switch to PROJECT_RESEARCH thread (tap chip)
5. **Expected:**
   - ✅ Header updates to PROJECT_RESEARCH
   - ✅ Chat history shows only PROJECT_RESEARCH messages
   - ✅ Previous thread's messages gone from view
6. Type: `"What did I ask about yesterday's project?"`
7. **Expected:** ROOT_SYSTEM refers only to PROJECT_RESEARCH context

**Validation:**
- ✅ Each thread has isolated prompt history
- ✅ ChromaDB queries filter by session_id
- ✅ No cross-contamination between threads

---

### **Test 5: Thread Selector Visual Distinction**

**Precondition:**
- Multiple threads active (daily log + custom threads)

**Visual Checklist:**
- ✅ Daily log threads have `[ * ]` prefix: `[ * ] DAILY_LOG_2026-04-09`
- ✅ Daily log border is RED (#FF2C55), 1px
- ✅ Custom threads have no prefix: `MY_RESEARCH_PROJECT`
- ✅ Custom thread borders are GRAY (#666666), 1px
- ✅ Active thread (any type) has GREEN background (#00FF66) + 2px border
- ✅ Active thread text is WHITE and BOLD
- ✅ Inactive threads have dark background
- ✅ Thread chips scroll horizontally on mobile
- ✅ `[ + NEW_THREAD ]` button visible at start

---

### **Test 6: Daily Log Persistence Across Days**

**Precondition:**
- Today's daily log open with messages

**Manual Test:**
1. Note today's date: `[ * ] DAILY_LOG_2026-04-09`
2. Manually set device date forward 1 day
3. Kill and restart app
4. Navigate to Chat tab
5. **Expected:**
   - ✅ New thread appears: `[ * ] DAILY_LOG_2026-04-10` (tomorrow's date)
   - ✅ New thread is active and highlighted
   - ✅ Yesterday's log still exists in selector
   - ✅ Chat history is empty (new day)

6. Tap yesterday's thread: `[ * ] DAILY_LOG_2026-04-09`
7. **Expected:**
   - ✅ Chat history loads with previous messages
   - ✅ Header shows correct date for selected thread

**Automated Test (Backend):**
```bash
# Query daily logs by session_id pattern
curl "http://localhost:8000/api/chat/sessions?user_id=testuser_prod" 2>/dev/null | \
  jq '.sessions[] | select(.id | startswith("DAILY_LOG")) | .id'
```

---

### **Test 7: Thread Switching Performance**

**Precondition:**
- 5+ threads with 10+ messages each
- All threads loaded in selector

**Steps:**
1. Active in thread A
2. Tap thread B (watch for delay)
3. **Expected:**
   - ✅ Thread switches within 500ms
   - ✅ History loads without flickering
   - ✅ Header updates immediately
4. Rapid tap between threads C, D, E
5. **Expected:**
   - ✅ No undefined state or errors
   - ✅ Correct history shows for each thread
   - ✅ No duplicate messages

---

### **Test 8: Android vs iOS Differences**

**iOS Specific:**
- ✅ Alert.prompt modal appears with standard iOS styling
- ✅ Keyboard dismisses cleanly after input
- ✅ Thread chips have proper tap targets (44pt min)
- ✅ Scroll feel is smooth (momentum)

**Android Specific:**
- ✅ Alert.prompt shows Material Design-style
- ✅ Thread selector scrolls smoothly
- ✅ No over-scroll bouncing
- ✅ Back button doesn't break navigation

---

## 📋 Quick API Test (curl)

```bash
# Create new account
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"curl_test_123","password":"password123"}' | jq .

# Login with that account  
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"curl_test_123","password":"password123"}' | jq .

# Wrong password (should fail)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"curl_test_123","password":"wrongpass"}' | jq .

# Test ROOT_SYSTEM + Daily Logs
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "curl_test_123",
    "session_id": "DAILY_LOG_2026-04-09",
    "message": "What'"'"'s your name?",
    "model": "mistral"
  }' | jq .

# Fetch sessions
curl "http://localhost:8000/api/chat/sessions?user_id=curl_test_123" 2>/dev/null | jq .

# Fetch history for specific session
curl "http://localhost:8000/api/chat/history?user_id=curl_test_123&session_id=DAILY_LOG_2026-04-09" 2>/dev/null | jq .
```

---

**Duration**: ~30 minutes for complete testing  
**Success Rate Target**: 100% (all tests pass)

Good luck! 🎉
