import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Text, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../../constants/config';
import { COLORS, FONT, FONT_FAMILY, SPACE } from '../../constants/theme';
import { scale } from '../../utils/responsive';

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('NONE');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth > 768;

  const navItems = [
    { name: 'chat',     icon: 'terminal',  label: 'SYSTEM'   },
    { name: 'lifeline', icon: 'clock',     label: 'LIFELINE' },
    { name: 'board',    icon: 'grid',      label: 'BOARD'    },
    { name: 'projects', icon: 'folder',    label: 'PROJECTS' },
    { name: 'calendar', icon: 'zap',       label: 'AGENDA'   },
    { name: 'profile',  icon: 'user',      label: 'USER'     },
    { name: 'memory',   icon: 'cpu',       label: 'MEMORY'   },
    { name: 'topology', icon: 'share-2',   label: 'TOPOLOGY' },
    { name: 'journal',  icon: 'book-open', label: 'EOD_LOGS' },
    { name: 'settings', icon: 'settings',  label: 'CONFIG'   },
  ];

  const calculateFontSize = (name: string) => {
    const length = name.length;
    if (length <= 5) return FONT.sm;
    if (length <= 8) return FONT.xs + 1;
    if (length <= 12) return FONT.xs;
    return FONT.xs - 1;
  };

  const calculateLetterSpacing = (name: string) => {
    const length = name.length;
    if (length <= 5) return 0.5;
    if (length <= 8) return 0.2;
    return 0.1;
  };

  const checkSystemStatus = async () => {
    try {
      const saved = await AsyncStorage.getItem('@system_active_model');
      setActiveModel(saved || 'NONE');
    } catch (e) {
      console.error('Failed to load active model', e);
      setActiveModel('ERR');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      setIsOnline(response.ok);
    } catch (e) {
      console.error('Health check failed', e);
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[
        styles.sidebar, 
        sidebarCollapsed && styles.sidebarCollapsed,
        isDesktop && !sidebarCollapsed && styles.sidebarDesktop
      ]}>
        <SafeAreaView style={[styles.sidebarInner, isDesktop && !sidebarCollapsed && styles.railInner]}>
          <ScrollView style={[styles.navStack, isDesktop && !sidebarCollapsed && styles.railStack]} showsVerticalScrollIndicator={false}>
            {navItems.map((item) => {
              const isActive = pathname.includes(item.name);
              return (
                <Link key={item.name} href={`/(tabs)/${item.name}`} asChild>
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      isDesktop && !sidebarCollapsed ? styles.railItem : styles.navItem,
                      isActive && (isDesktop && !sidebarCollapsed ? styles.railItemActive : styles.navItemActive)
                    ])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={item.icon as any}
                      size={isDesktop && !sidebarCollapsed ? FONT.xxl : FONT.md}
                      color={isActive ? COLORS.accent : (isDesktop && !sidebarCollapsed ? COLORS.textGhost : COLORS.textMuted)}
                    />
                    {!(sidebarCollapsed || (isDesktop && !sidebarCollapsed)) && (
                      <Text
                        style={[
                          styles.navLabel,
                          { color: isActive ? COLORS.accent : COLORS.textMuted },
                        ]}
                      >
                        {item.label.toLowerCase()}
                      </Text>
                    )}
                  </TouchableOpacity>
                </Link>
              );
            })}
          </ScrollView>

          {!sidebarCollapsed && !isDesktop && (
            <View style={styles.statusModule}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isOnline ? COLORS.accent : COLORS.danger,
                    shadowColor: isOnline ? COLORS.accent : COLORS.danger,
                  },
                ]}
              />
              <Text
                style={[
                  styles.modelText,
                  {
                    color: isOnline ? COLORS.textMuted : COLORS.danger,
                    fontSize: calculateFontSize(activeModel),
                    letterSpacing: calculateLetterSpacing(activeModel),
                  },
                ]}
              >
                {activeModel.toLowerCase()}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>

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
    backgroundColor: COLORS.bg,
  },
  sidebar: {
    width: scale(280),
    backgroundColor: COLORS.bg,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  sidebarDesktop: {
    width: scale(72),
  },
  sidebarCollapsed: {
    width: scale(70),
  },
  sidebarInner: {
    flex: 1,
    paddingVertical: SPACE.md,
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.md,
  },
  railInner: {
    paddingHorizontal: SPACE.xs,
    alignItems: 'center',
  },
  navStack: {
    flex: 1,
    gap: SPACE.md,
  },
  railStack: {
    gap: SPACE.lg,
  },
  navItem: {
    minHeight: scale(48),
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  railItem: {
    width: scale(48),
    height: scale(48),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  navItemActive: {
    backgroundColor: COLORS.accentTint,
  },
  railItemActive: {
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.2)',
  },
  navLabel: {
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  statusModule: {
    alignItems: 'flex-start',
    gap: SPACE.md,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingLeft: SPACE.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  rotatedTextContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  modelText: {
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
    fontSize: FONT.xs,
  },
});
