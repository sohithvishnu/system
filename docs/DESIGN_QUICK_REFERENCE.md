# UNIFIED UI SYSTEM - QUICK REFERENCE

## Color Hex Values (Copy These)
```
#000000  - Deep black (primary background)
#0A0A0A  - Elevated dark (cards, modals)
#1a1a1a  - Border color (2px solid)
#00FF66  - Neon green (accent, primary)
#FF2C55  - Danger red (warnings)
#FFFFFF  - Pure white (text)
#A0A0A0  - Light gray (secondary text)
#666666  - Dark gray (tertiary text)
```

## Style Template (Paste Into Any New Component)

### Border Rule (Applies To Everything)
```tsx
borderWidth: 2,
borderColor: '#1a1a1a',
borderRadius: 0,  // ALWAYS 0 - NO ROUNDING
```

### Typography Rule (For Titles/Labels)
```tsx
fontFamily: 'Courier New',  // ALWAYS monospace
fontWeight: '900',          // Headers: 900, body: 600
letterSpacing: 1-2,         // Add spacing for elegance
textTransform: 'uppercase', // Labels in CAPS
```

### Spacing Rule (Universal)
```tsx
padding: 16,       // Standard padding
marginBottom: 12,  // Standard gap between elements
gap: 12,           // Gap in flex rows/columns
```

### Elevated Surface (Cards, Modals, Containers)
```tsx
backgroundColor: '#0A0A0A',
borderWidth: 2,
borderColor: '#1a1a1a',
borderRadius: 0,
padding: 16,
```

### Deep Surface (Deep Backgrounds, Inputs)
```tsx
backgroundColor: '#000000',
borderWidth: 2,
borderColor: '#1a1a1a',
borderRadius: 0,
```

### Accent Button (Primary Action)
```tsx
backgroundColor: '#00FF66',
color: '#000000',           // Black text for contrast
borderRadius: 0,
borderWidth: 0,
fontFamily: 'Courier New',
fontWeight: '900',
```

### Secondary Button (Outline)
```tsx
backgroundColor: 'transparent',
borderWidth: 2,
borderColor: '#1a1a1a',
borderRadius: 0,
color: '#00FF66',
fontFamily: 'Courier New',
```

## Components Status ✅

| Component | Errors | Unified |
|-----------|--------|---------|
| chat.tsx | 0 | ✅ YES |
| board.tsx | 0 | ✅ YES |
| calendar.tsx | 0 | ✅ YES |
| profile.tsx | 0 | ✅ YES |
| main.py | 0 | ✅ YES |

## Key Rules To Remember

1. **Never use borderRadius > 0** - All corners are sharp (brutalism)
2. **Always use Courier New for titles** - Terminal aesthetic
3. **2px border on everything** - Consistency
4. **#0A0A0A for elevated, #000 for deep** - Color hierarchy
5. **16px padding as default** - Breathing room
6. **All caps for labels** - Cyberpunk feel
7. **#1a1a1a only border color** - No variations
8. **Neon green only for accents** - Consistency

## For New Components: Copy This

```tsx
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function NewComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>COMPONENT_NAME</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  title: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 24,
    fontFamily: 'Courier New',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
  },
  
  button: {
    backgroundColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  buttonText: {
    color: '#000000',
    fontWeight: '900',
    fontFamily: 'Courier New',
    fontSize: 12,
    letterSpacing: 1,
  },
});
```

## Backend Conversational Memory (For Reference)

- **5 most recent messages** recalled from ChromaDB
- **Format**: `[RECALLED_MEMORY]\n- message1\n- message2\n...`
- **Filter**: user_id + session_id (keeps sessions isolated)
- **Persona**: Conversational companion, cyberpunk, philosophical
- **Priority**: Conversation first, tasks second

## Testing Checklist for New Features

- [ ] borderRadius: 0 everywhere?
- [ ] 2px solid #1a1a1a borders on interactive elements?
- [ ] Courier New on titles/labels?
- [ ] #0A0A0A for elevated, #000 for deep?
- [ ] 16px padding standard?
- [ ] All caps on labels?
- [ ] No shadow effects (Brutalist)?
- [ ] Colors from the 8-color palette only?

---

**Status**: UI System Unified & Complete ✨
**Date**: Production Ready
**Version**: 1.0 Electric Brutalist
