// PRODUCTION: Silence all console output in compiled builds for performance
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <MainStack />
      </View>
    </AuthProvider>
  );
}

function MainStack() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to load before making routing decisions
    if (isLoading) {
      return;
    }

    const inTabsGroup = segments[0] === '(tabs)';
    const isAuthenticated = user !== null && user !== undefined;

    // RULE 1: If NOT logged in but trying to access tabs → redirect to login
    if (!isAuthenticated && inTabsGroup) {
      router.replace('/');
      return;
    }

    // RULE 2: If logged in but NOT in tabs → redirect to chat
    if (isAuthenticated && segments[0] !== '(tabs)') {
      router.replace('/(tabs)/chat');
      return;
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color="#00FF66" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
    </Stack>
  );
}