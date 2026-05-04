import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Text } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../../constants/config';
import { COLORS, FONT, FONT_FAMILY } from '../../constants/theme';

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('NONE');

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
      <View style={styles.sidebar}>
        <SafeAreaView style={styles.sidebarInner}>
          <View style={styles.navStack}>
            {navItems.map((item) => {
              const isActive = pathname.includes(item.name);
              return (
                <Link key={item.name} href={`/(tabs)/${item.name}`} asChild>
                  <TouchableOpacity style={styles.navItem}>
                    <Feather
                      name={item.icon as any}
                      size={15}
                      color={isActive ? COLORS.accent : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </Link>
              );
            })}
          </View>

          <View style={styles.statusModule}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isOnline ? COLORS.accent : COLORS.danger,
                shadowColor:      isOnline ? COLORS.accent : COLORS.danger },
            ]} />
            <View style={styles.rotatedTextContainer}>
              <Text style={[
                styles.modelText,
                {
                  color:         isOnline ? COLORS.textMuted : COLORS.danger,
                  fontSize:      calculateFontSize(activeModel),
                  letterSpacing: calculateLetterSpacing(activeModel),
                },
              ]}>
                {activeModel}
              </Text>
            </View>
          </View>
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
    width: 44,
    backgroundColor: COLORS.bg,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  sidebarInner: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  navStack: {
    alignItems: 'center',
    gap: 4,
  },
  navItem: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  statusModule: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
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
  },
});
