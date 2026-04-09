import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, useWindowDimensions } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoint: tablet is 768px
  const isMobile = width < 768;

  const navItems = [
    { name: 'chat', icon: 'terminal-outline', label: 'SYSTEM' },
    { name: 'board', icon: 'grid-outline', label: 'BOARD' },
    { name: 'calendar', icon: 'flash-outline', label: 'AGENDA' },
    { name: 'profile', icon: 'id-card-outline', label: 'USER' },
  ];

  // Responsive dimensions
  const sidebarWidth = isMobile ? 60 : 72;
  const iconSize = isMobile ? 20 : 24;
  const navGap = isMobile ? 20 : 30;
  const activeIndicatorLeft = isMobile ? -5 : -11;

  return (
    <View style={styles.container}>
      {/* 🛠️ THE SIDEBAR DOCK */}
      <View style={[styles.sidebar, { width: sidebarWidth }]}>
        <SafeAreaView style={styles.sidebarInner}>
          {/* LOGO REMOVED FOR CLEANER UI */}
          
          <View style={[styles.navStack, { gap: navGap }]}>
            {navItems.map((item) => {
              const isActive = pathname.includes(item.name);
              return (
                <Link key={item.name} href={`/(tabs)/${item.name}`} asChild>
                  <TouchableOpacity style={styles.navItem}>
                    <Ionicons 
                      name={item.icon as any} 
                      size={iconSize}
                      color={isActive ? '#00FF66' : '#444'} 
                    />
                    {isActive && <View style={[styles.activeIndicator, { left: activeIndicatorLeft }]} />}
                  </TouchableOpacity>
                </Link>
              );
            })}
          </View>
        </SafeAreaView>
      </View>

      {/* 📱 THE MAIN CONTENT AREA */}
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
    backgroundColor: '#000',
  },
  sidebar: {
    width: 72,
    backgroundColor: '#050505',
    borderRightWidth: 1.5,
    borderColor: '#1a1a1a',
  },
  sidebarInner: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  navStack: {
    marginTop: 20, // Added margin here to replace the space where the logo was
    gap: 30,
    alignItems: 'center',
  },
  navItem: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    left: -11, 
    width: 4,
    height: 24,
    backgroundColor: '#00FF66',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    shadowColor: '#00FF66',
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flex: 1,
  },
});