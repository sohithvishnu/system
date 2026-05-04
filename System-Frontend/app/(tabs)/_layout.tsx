import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Text, ScrollView, useWindowDimensions } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../../constants/config';
import { COLORS, FONT, FONT_FAMILY, SPACE, RADIUS } from '../../constants/theme';
import { scale } from '../../utils/responsive';

const NAV_ITEMS = [
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

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();
  const [isOnline, setIsOnline] = useState(false);
  const [activeModel, setActiveModel] = useState('NONE');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDesktop = screenWidth > 768;
  const isRail = isDesktop && !sidebarCollapsed;

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const model = await AsyncStorage.getItem('@system_active_model');
        setActiveModel(model || 'NONE');
      } catch (e) {
        console.error('Failed to load model', e);
        setActiveModel('ERR');
      }
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
        clearTimeout(id);
        setIsOnline(res.ok);
      } catch (e) {
        console.error('Health check failed', e);
        setIsOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIconSize = () => isRail ? scale(22) : FONT.md;
  const getIconColor = (isActive: boolean) => {
    if (isRail) return isActive ? COLORS.accent : COLORS.textGhost;
    return isActive ? COLORS.accent : COLORS.textMuted;
  };
  const showLabel = !sidebarCollapsed && !isRail;

  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, sidebarCollapsed && styles.collapsed, isRail && styles.rail]}>
        <SafeAreaView style={[styles.inner, isRail && styles.railInner]}>
          <ScrollView style={[styles.navStack, isRail && styles.railStack]} showsVerticalScrollIndicator={false}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.includes(item.name);
              return (
                <Link key={item.name} href={`/(tabs)/${item.name}`} asChild>
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      isRail ? styles.railItem : styles.navItem,
                      isActive && (isRail ? styles.railActive : styles.active)
                    ])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={item.icon as any} size={getIconSize()} color={getIconColor(isActive)} />
                    {showLabel && <Text style={[styles.label, { color: getIconColor(isActive) }]}>{item.label.toLowerCase()}</Text>}
                  </TouchableOpacity>
                </Link>
              );
            })}
          </ScrollView>
          {!sidebarCollapsed && !isDesktop && (
            <View style={[styles.status, { borderTopColor: COLORS.border }]}>
              <View style={[styles.dot, { backgroundColor: isOnline ? COLORS.accent : COLORS.danger }]} />
              <Text style={[styles.modelText, { color: isOnline ? COLORS.textMuted : COLORS.danger }]}>
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
  container: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.bg },
  sidebar: { width: scale(280), backgroundColor: COLORS.bg, borderRightWidth: 1, borderRightColor: COLORS.border },
  rail: { width: scale(48), borderRightWidth: 0 },
  collapsed: { width: scale(70) },
  inner: { flex: 1, paddingVertical: SPACE.md, justifyContent: 'space-between', paddingHorizontal: SPACE.md },
  railInner: { paddingHorizontal: 0, alignItems: 'stretch', paddingVertical: SPACE.md },
  navStack: { flex: 1, gap: SPACE.md },
  railStack: { gap: 0 },
  navItem: { minHeight: scale(48), paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  railItem: { width: '100%', height: scale(50), justifyContent: 'center', alignItems: 'center', flexDirection: 'row', borderLeftWidth: 2, borderLeftColor: 'transparent' },
  active: { backgroundColor: COLORS.accentTint },
  railActive: { borderLeftColor: COLORS.accent },
  label: { fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, fontWeight: '500' },
  content: { flex: 1, backgroundColor: COLORS.bg },
  status: { gap: SPACE.md, paddingTop: SPACE.lg, paddingBottom: SPACE.md, borderTopWidth: 1, paddingLeft: SPACE.md },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
  modelText: { fontFamily: FONT_FAMILY.mono, fontWeight: '500', fontSize: FONT.xs },
});
