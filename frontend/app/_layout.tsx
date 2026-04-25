import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { useNotifications } from '../src/hooks/useNotifications';

function NotificationSetup() {
  const { user } = useAuth();
  const { setupNotifications } = useNotifications();

  useEffect(() => {
    // Register for push notifications when user is logged in
    if (user && Platform.OS !== 'web') {
      setupNotifications().then((pushToken) => {
        if (pushToken) {
          console.log('Push notifications registered for', user.role, ':', pushToken);
        }
      });
    }
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationSetup />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="category/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="admin" />
      </Stack>
    </AuthProvider>
  );
}
