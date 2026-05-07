import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  useWindowDimensions, 
  Platform 
} from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BACKEND_URL } from '../../constants/config';
import { COLORS, SPACE } from '../../constants/theme';
import { scale } from '../../utils/responsive';

const NAV_ITEMS = [
  { name: 'chat',     icon: 'terminal' },
  { name: 'lifeline', icon: 'clock'    },
  { name: 'board',    icon: 'grid'     },
  { name: 'calendar', icon: 'zap'      },
  { name: 'journal',  icon: 'book-open'},
  { name: 'memory',   icon: 'cpu'      },
  { name: 'projects', icon: 'folder'   },
  { name: 'topology', icon: 'share-2'  },
  { name: 'profile',  icon: 'user'     },
  { name: 'settings', icon: 'settings' },
];

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isOnline, setIsOnline] = useState(false);

  // Health check polling
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        // Silently fails if backend is unreachable, updating the status dot
        const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
        clearTimeout(id);
        setIsOnline(res.ok);
      } catch (e) {
        setIsOnline(false);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* VS Code Style Activity Bar */}
      <View style={[styles.rail, isMobile && styles.mobileRail]}>
        <SafeAreaView style={styles.inner}>
          
          <View style={styles.topSection}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.includes(item.name);
              return (
                <Link key={item.name} href={`/(tabs)/${item.name}`} asChild>
                  <TouchableOpacity
                    /* The StyleSheet.flatten fix for Expo Router's <Slot> */
                    style={StyleSheet.flatten([
                      styles.railItem, 
                      isActive && styles.railActive
                    ])}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Feather 
                      name={item.icon as any} 
                      size={scale(18)} 
                      strokeWidth={1.5}
                      color={isActive ? COLORS.textPrimary : COLORS.textGhost} 
                    />
                  </TouchableOpacity>
                </Link>
              );
            })}
          </View>

          {/* Minimal Status Dot at the bottom */}
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: isOnline ? COLORS.accent : COLORS.danger },
              isOnline && styles.glow
            ]} />
          </View>

        </SafeAreaView>
      </View>

      {/* Main App Content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: COLORS.bg 
  },
  rail: { 
    width: scale(48), // Strict VS Code Width
    backgroundColor: COLORS.bg, 
    borderRightWidth: 1, 
    borderRightColor: COLORS.borderMid,
    paddingTop: Platform.OS === 'web' ? SPACE.lg : 0,
  },
  mobileRail: {
    width: scale(54), // Slightly wider on mobile for comfortable thumb targets
  },
  inner: { 
    flex: 1, 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  topSection: {
    width: '100%',
    alignItems: 'center',
  },
  railItem: { 
    width: '100%', 
    height: scale(50), 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderLeftWidth: 2, 
    borderLeftColor: 'transparent', // Invisible by default
    marginBottom: SPACE.xs,
  },
  railActive: { 
    borderLeftColor: COLORS.accent, // The signature left-stripe
  },
  content: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },
  statusContainer: {
    width: '100%',
    height: scale(48),
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: SPACE.md,
  },
  statusDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
  },
  glow: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  }
});