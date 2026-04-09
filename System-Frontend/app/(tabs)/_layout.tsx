import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, useWindowDimensions, Text } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../../constants/config';

export default function SideNavigationLayout() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoint: tablet is 768px
  const isMobile = width < 768;

  // State for system status
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('NONE');

  const navItems = [
    { name: 'chat', icon: 'terminal-outline', label: 'SYSTEM' },
    { name: 'board', icon: 'grid-outline', label: 'BOARD' },
    { name: 'calendar', icon: 'flash-outline', label: 'AGENDA' },
    { name: 'profile', icon: 'id-card-outline', label: 'USER' },
    { name: 'settings', icon: 'hardware-chip-outline', label: 'CONFIG' },
  ];

  // Responsive dimensions
  const sidebarWidth = isMobile ? 60 : 72;
  const iconSize = isMobile ? 20 : 24;
  const navGap = isMobile ? 20 : 30;
  const activeIndicatorLeft = isMobile ? -5 : -11;

  // Check system health and model status
  const checkSystemStatus = async () => {
    // 1. Check active model from AsyncStorage
    try {
      const saved = await AsyncStorage.getItem('@system_active_model');
      setActiveModel(saved || 'NONE');
    } catch (e) {
      console.error('Failed to load active model', e);
      setActiveModel('ERR');
    }

    // 2. Check backend health with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout
      
      const response = await fetch(`${BACKEND_URL}/api/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch (e) {
      console.error('Health check failed', e);
      setIsOnline(false);
    }
  };

  // Calculate dynamic font size based on model name length
  const calculateFontSize = (name: string) => {
    const length = name.length;
    if (length <= 5) return 13;
    if (length <= 8) return 11;
    if (length <= 12) return 9.5;
    return 8;
  };

  const calculateLetterSpacing = (name: string) => {
    const length = name.length;
    if (length <= 5) return 1;
    if (length <= 8) return 0.5;
    return 0.2;
  };

  // Set up periodic health checks
  useEffect(() => {
    checkSystemStatus(); // Initial check
    const interval = setInterval(checkSystemStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* 🛠️ THE SIDEBAR DOCK */}
      <View style={[styles.sidebar, { width: sidebarWidth }]}>
        <SafeAreaView style={styles.sidebarInner}>
          {/* Navigation Stack */}
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

          {/* STATUS MODULE AT BOTTOM */}
          <View style={styles.statusModule}>
            {/* Status Dot */}
            <View style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#00FF66' : '#FF2C55' }
            ]} />
            
            {/* Rotated Model Text */}
            <View style={styles.rotatedTextContainer}>
              <Text style={[
                styles.modelText,
                {
                  color: isOnline ? '#00FF66' : '#FF2C55',
                  fontSize: calculateFontSize(activeModel),
                  letterSpacing: calculateLetterSpacing(activeModel),
                }
              ]}>
                {activeModel}
              </Text>
            </View>
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
    backgroundColor: '#000',
    borderRightWidth: 2,
    borderRightColor: '#1a1a1a',
  },
  sidebarInner: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navStack: {
    alignItems: 'center',
  },
  navItem: {
    position: 'relative',
    padding: 12,
  },
  activeIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -8,
    width: 12,
    height: 16,
    backgroundColor: '#00FF66',
    borderRightWidth: 2,
    borderRightColor: '#00FF66',
  },
  content: {
    flex: 1,
    backgroundColor: '#000',
  },
  statusModule: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 16,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    paddingTop: 16,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#1a1a1a',
    shadowColor: '#00FF66',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  rotatedTextContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  modelText: {
    fontFamily: 'Courier New',
    fontWeight: '800',
  },
});