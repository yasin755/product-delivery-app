import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Debug function to log environment info
const logDebug = (label: string, value: any) => {
  console.log(`[API Debug] ${label}:`, value);
};

// IMPORTANT: For Render deployment, set EXPO_PUBLIC_BACKEND_URL in your .env file
// Example: EXPO_PUBLIC_BACKEND_URL=https://your-app.onrender.com
// Android emulator uses 10.0.2.2 as an alias to reach the host machine.
// iOS simulator can use localhost. Physical devices should use LAN IP.
const getBackendUrl = () => {
  logDebug('Platform', Platform.OS);
  logDebug('Constants.isDevice', Constants.isDevice);
  logDebug('Constants.expoConfig full', JSON.stringify(Constants.expoConfig, null, 2));
  
  // FIRST PRIORITY: Use environment variable (works for Render and production deployments)
  const envBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  logDebug('EXPO_PUBLIC_BACKEND_URL from env', envBackendUrl);
  
  if (envBackendUrl && envBackendUrl.trim()) {
    logDebug('Using EXPO_PUBLIC_BACKEND_URL from environment', envBackendUrl);
    return envBackendUrl;
  }
  
  const hostUri = Constants.expoConfig?.hostUri as string | undefined;
  logDebug('Host URI from Constants.expoConfig', hostUri);
  
  let url = '';
  
  if (Platform.OS === 'ios') {
    // Try to extract from hostUri
    if (hostUri) {
      try {
        const hostPart = hostUri.split(':')[0];
        url = `http://${hostPart}:8000`;
        logDebug('iOS - extracted host from hostUri', hostPart);
        logDebug('Using iOS extracted URL', url);
        return url;
      } catch (e) {
        logDebug('Error extracting host from hostUri', e);
      }
    }
    
    // Default fallbacks for local development
    if (Constants.isDevice) {
      url = 'http://192.168.1.38:8000';
      logDebug('iOS physical device - using default LAN IP', url);
    } else {
      url = 'http://127.0.0.1:8000';
      logDebug('iOS simulator - using localhost', url);
    }
  } else if (Platform.OS === 'android') {
    // Try to extract from hostUri for physical devices
    if (Constants.isDevice && hostUri) {
      try {
        const hostPart = hostUri.split(':')[0];
        url = `http://${hostPart}:8000`;
        logDebug('Android device - extracted host from hostUri', hostPart);
        logDebug('Using Android extracted URL', url);
        return url;
      } catch (e) {
        logDebug('Error extracting host from hostUri', e);
      }
    }
    
    // Default fallbacks for local development
    if (Constants.isDevice) {
      url = 'http://192.168.1.38:8000';
      logDebug('Android physical device - using default LAN IP', url);
    } else {
      url = 'http://10.0.2.2:8000';
      logDebug('Android emulator - using 10.0.2.2', url);
    }
  } else {
    url = 'http://localhost:8000';
    logDebug('Web - using localhost', url);
  }
  
  logDebug('Final API_BASE URL selected', url);
  return url;
};

const API_BASE = getBackendUrl();
logDebug('Final API_BASE', API_BASE);

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders();
  const fullUrl = `${API_BASE}${path}`;
  
  logDebug('Fetching', fullUrl);
  logDebug('Method', options.method || 'GET');
  
  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    
    logDebug(`Response status for ${path}`, res.status);
    
    if (!res.ok) {
      let errDetail = 'Request failed';
      try {
        const errData = await res.json();
        errDetail = errData.detail || errData.message || JSON.stringify(errData);
      } catch {}
      
      logDebug(`Error response for ${path}`, { status: res.status, detail: errDetail });
      throw new Error(`${res.status}: ${errDetail}`);
    }
    
    const data = await res.json();
    logDebug(`Success response for ${path}`, data);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logDebug(`Network/Parse error for ${path}`, errorMessage);
    throw new Error(`Failed to connect to ${fullUrl}: ${errorMessage}`);
  }
}

export function getApiBase() {
  // For checkout origin_url, always use the public preview URL to ensure
  // it works on all devices (web, mobile, tablets)
  const publicUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (publicUrl && publicUrl.trim()) {
    return publicUrl;
  }
  return API_BASE;
}
