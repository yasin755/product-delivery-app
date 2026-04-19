import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 as an alias to reach the host machine
// Physical Android devices should use the actual machine IP
const calculateApiBase = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
};

const API_BASE = calculateApiBase();

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
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export function getApiBase() {
  return API_BASE;
}
