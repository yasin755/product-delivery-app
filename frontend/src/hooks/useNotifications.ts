import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Listen for incoming notifications (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
      console.log('Notification received:', notif.request.content.title);
    });

    // Listen for notification taps (user interacted)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      // Can navigate based on data.type and data.order_id here
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  async function registerForPushNotifications(): Promise<string | null> {
    // Push notifications only work on physical devices
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        setPermissionGranted(false);
        return null;
      }

      setPermissionGranted(true);

      // Get the Expo push token
      // For Expo Go, projectId can be undefined and it will use the default Expo project
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      let tokenData;
      try {
        // Try with projectId first (for standalone builds)
        if (projectId && projectId !== 'your-project-id') {
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
        } else {
          // For Expo Go testing, don't pass projectId
          tokenData = await Notifications.getExpoPushTokenAsync();
        }
      } catch (tokenError: any) {
        console.log('Error getting push token with projectId, trying without:', tokenError.message);
        // Fallback: try without projectId for Expo Go
        tokenData = await Notifications.getExpoPushTokenAsync();
      }
      
      const token = tokenData.data;
      setExpoPushToken(token);
      console.log('Expo Push Token:', token);

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Order Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B00',
          sound: 'default',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async function registerTokenWithBackend(token: string) {
    try {
      await api('/api/auth/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token,
          device_name: Device.modelName || Device.deviceName || 'Unknown Device',
        }),
      });
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  async function unregisterTokenFromBackend(token: string) {
    try {
      await api('/api/auth/push-token', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      });
      console.log('Push token removed from backend');
    } catch (error) {
      console.error('Failed to remove push token:', error);
    }
  }

  async function setupNotifications() {
    const token = await registerForPushNotifications();
    if (token) {
      await registerTokenWithBackend(token);
    }
    return token;
  }

  return {
    expoPushToken,
    notification,
    permissionGranted,
    setupNotifications,
    registerForPushNotifications,
    registerTokenWithBackend,
    unregisterTokenFromBackend,
  };
}
