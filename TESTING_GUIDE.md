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
```

---

**Duration**: ~30 minutes for complete testing  
**Success Rate Target**: 100% (all tests pass)

Good luck! 🎉
