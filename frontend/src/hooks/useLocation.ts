import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface LocationAddress {
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  label: string;
  phone: string;
}

export function useLocation() {
  const [address, setAddress] = useState<LocationAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  async function requestAndFetch() {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionGranted(false);
        setLoading(false);
        return null;
      }
      setPermissionGranted(true);

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo) {
        const addr: LocationAddress = {
          address_line: [geo.name, geo.street, geo.streetNumber].filter(Boolean).join(', ') || geo.formattedAddress || 'Current Location',
          city: geo.city || geo.subregion || '',
          state: geo.region || '',
          pincode: geo.postalCode || '',
          label: 'Current Location',
          phone: '',
        };
        setAddress(addr);
        setLoading(false);
        return addr;
      }
    } catch (e) {
      console.warn('Location error:', e);
    }
    setLoading(false);
    return null;
  }

  return { address, loading, permissionGranted, requestAndFetch };
}
