# 📱 Visual Reference - What You Should See

## 🎨 Login Screen (index.tsx)

### **Top Section**
```
┌───────────────────────────────────────┐
│                                       │
│  [≡]  SYSTEM                         │  ← Terminal icon (neon green)
│       ACCESS CONTROL                  │  ← Green subtitle text
│                                       │
│  (left-aligned, at top)               │
│                                       │
└───────────────────────────────────────┘
```

### **Form Section**
```
┌───────────────────────────────────────┐
│                                       │
│  USERNAME                             │  ← Label (neon green, uppercase)
│  [////////////////////////////////]    │  ← Dark input field
│                                       │  
│  PASSWORD                             │  ← Label (neon green)
│  [////////////////////////////////] 👁 │  ← Dark input, neon eye icon
│                                       │
│  <ERROR BOX (if any)>                 │  
│  ⚠️  Username required                │  ← Red left border (4px)
│                                       │
│  [🟢 START SESSION 🢂]                │  ← NEON GREEN BUTTON
│  (with glow effect, centered)         │  
│                                       │
│  New here? Create account             │  ← Green link text, left
│                                       │
└───────────────────────────────────────┘
```

### **Color Details**
```
Text: White (#FFF) on Black (#000)
Labels: NEON GREEN (#00FF66), 11px, 900-weight, 2px spacing, UPPERCASE
Input Border (default): Dark gray (#1a1a1a), 2px
Input Border (focused): NEON GREEN (#00FF66), 2px
Input Background: Very dark (#0A0A0A)
Input Background (focused): Dark green (#0a2a0a)
Button: NEON GREEN (#00FF66) with black text
Button Shadow: Green glow
Eye Icon: NEON GREEN (#00FF66)
```

---

## 📝 Signup Screen (signup.tsx)

### **Top Section**
```
┌───────────────────────────────────────┐
│                                       │
│  [≡]  CREATE                         │  ← Terminal icon (neon green)
│       NEW IDENTITY                    │  ← Green subtitle
│                                       │
│  (left-aligned)                       │
│                                       │
└───────────────────────────────────────┘
```

### **Form Section**
```
┌───────────────────────────────────────┐
│                                       │
│  USERNAME                             │  ← Green label
│  [////////////////////////////////]    │
│  Minimum 3 characters                 │  ← Helper text (gray)
│                                       │
│  PASSWORD                             │  
│  [////////////////////////////////] 👁 │  ← Eye icon for toggling
│  Minimum 6 characters                 │
│                                       │
│  CONFIRM PASSWORD                     │
│  [////////////////////////////////] 👁 │  ← Separate eye toggle
│  ✓ Passwords match                    │  ← Success message (green)
│                                       │
│  <ERROR BOX (if any)>                 │
│  ⚠️  Passwords do not match           │  ← Dark red bg, red text
│                                       │
│  [🟢 CREATE ACCOUNT]                  │  ← Big neon green button
│                                       │
│  Already have an account?             │  ← Green link
│                                       │
└───────────────────────────────────────┘
```

---

## 🎬 Visual States

### **Input Focus State**
```
BEFORE FOCUS:
[████████████████████|] ← Dark gray border (#1a1a1a)
 #0A0A0A background

AFTER FOCUS:
[████████████████████|] ← NEON GREEN border (#00FF66)
 #0a2a0a greenish background
```

### **Error State**
```
┌────────────────────────────────────┐
│ ⚠️  Invalid username or password   │ ← Red text
│ ════════════════════════════════════│ ← 4px neon red left border
│ Dark red background (#2a0a0a)      │
└────────────────────────────────────┘
```

### **Loading State**
```
[SPINNER] ⟳
Authenticating...  ← Green text, left-aligned
```

### **Button States**

**Normal (Clickable)**
```
🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢
  START SESSION   
🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢 🟢
↑ Neon green background, black text
↑ Glowing shadow effect
```

**Disabled (Grayed Out)**
```
███████████████████████
  CREATE ACCOUNT   
███████████████████████
↑ Dark gray (#333) background
↑ Reduced opacity (50%)
↑ Not clickable
```

---

## 📐 Spacing Reference

### **Vertical Spacing**
```
Top of screen
    ↓ 60px margin
[SYSTEM logo]
    ↓ 80px margin
USERNAME label
    ↓ 10px margin
[input box]
    ↓ 16px margin  ← Increased from 10px
PASSWORD label
    ↓ 10px margin
[input box]
    ↓ 24px margin  ← Increased from 20px
[BUTTON]
    ↓ 20px margin
"New here?" link
    ↓ 40px margin
Bottom of screen
```

### **Horizontal Spacing**
```
Left screen edge
    → 28px padding (increased from 20px)
Start of content
    ← 28px padding
Right screen edge
```

---

## 🔤 Typography Examples

### **Titles**
```
SYSTEM
↑ 72px, 900-weight, white, -2px letter spacing
↑ UPPERCASE

ACCESS CONTROL
↑ 13px, 900-weight, neon green, 2px letter spacing
↑ UPPERCASE
```

### **Labels**
```
USERNAME
↑ 11px, 900-weight, neon green, 2px letter spacing
↑ UPPERCASE
```

### **Input Text**
```
Enter username...
↑ 16px, 800-weight, white (#FFF)
↑ Placeholder in dark gray (#555)
```

### **Button Text**
```
CREATE ACCOUNT
↑ 16px, 900-weight, black (#000)
↑ 1.5px letter spacing
↑ UPPERCASE
```

### **Helper Text**
```
Minimum 6 characters
↑ 11px, 700-weight, dark gray (#555)
```

### **Success Text**
```
✓ Passwords match
↑ 11px, 800-weight, neon green (#00FF66)
```

### **Error Text**
```
Username already exists
↑ 13px, 900-weight, red (#FF2C55)
↑ Inside dark red container
```

---

## 🎯 Visual Comparison

### **OLD Look (Purple)**
```
        CENTER
        ┌─────┐
        │BUBBLE│
        └─────┘
        
      ┌─────────┐
      │Username │ ← Purple accent
      └─────────┘
      
     ┌──────────┐
     │ BUTTON   │ ← Purple
     └──────────┘
```

### **NEW Look (Neon Green, Left-Aligned)**
```
┌──────────────────┐
│ SYSTEM           │ ← Left-aligned
│ ACCESS CONTROL   │ ← Neon green
│                  │
│ USERNAME         │ ← Green label
│ [────────────]   │
│                  │
│ [🟢 BUTTON]      │ ← Neon green
│                  │
│ Create account?  │ ← Green link
└──────────────────┘
```

---

## ✅ Quick Verification Checklist

When you refresh your app, verify:

- [x] App icon is terminal (≡), not rocket
- [x] Main title says "SYSTEM" (not "BUBBLE")  
- [x] Subtitle says "ACCESS CONTROL" (login) or "NEW IDENTITY" (signup)
- [x] All text is LEFT-ALIGNED, not centered
- [x] Input labels are NEON GREEN (#00FF66)
- [x] All labels are UPPERCASE
- [x] Focused inputs have GREEN borders
- [x] Focused inputs have dark GREEN background tint
- [x] Eye icon is NEON GREEN
- [x] Main button is NEON GREEN with BLACK text
- [x] Text appears BOLDER throughout
- [x] More spacing between form fields
- [x] Button has GREEN glow/shadow effect
- [x] Error messages have RED left border (4px)
- [x] Overall looks "cyberpunk" and technical

---

## 📸 Expected Screenshot

If you could take a screenshot, it should look like:

```
╔════════════════════════════════╗
║                                ║
║ [≡] SYSTEM                     ║ ← Green, left, bold
║     ACCESS CONTROL              ║
║                                ║
║ USERNAME                        ║ ← Green label  
║ ▌──────────────────────────────▐ ║ ← Green when typing
║                                ║
║ PASSWORD                        ║ ← Green label
║ ▌──────────────────────────────▐👁║ ← Green eye
║                                ║
║ ╔════════════════════════════╗  ║
║ ║  ✓ START SESSION    🖤     ║  ║ ← Neon green button
║ ╚════════════════════════════╝  ║
║                                ║
║ New here? Create account        ║ ← Green link, left
║                                ║
╚════════════════════════════════╝
```

---

**Ready**: 🚀 The redesigned "System" frontend is complete and waiting for you to refresh!

Look at your Expo Go app and you should immediately see the bold, left-aligned, neon green design!
