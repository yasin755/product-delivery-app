import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radii, shadows } from '../../src/theme';

const CATEGORY_ICONS: Record<string, string> = {
  water: 'water', restaurant: 'restaurant', leaf: 'leaf', cart: 'cart', happy: 'happy',
};

export default function HomeScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);
  const [showLocationBanner, setShowLocationBanner] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        api('/api/categories'),
        api('/api/products?limit=10'),
      ]);
      setCategories(cats);
      setProducts(prods.products || []);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    requestLocation();
  }, []);

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        // Use saved address if available, otherwise show banner
        if (user?.addresses && user.addresses.length > 0) {
          const addr = user.addresses[0];
          setLocationText([addr.address_line, addr.city, addr.state].filter(Boolean).join(', '));
        } else {
          setLocationText('Tap to set your delivery address');
          setShowLocationBanner(true);
        }
        return;
      }
      setLocationDenied(false);

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        const addrLine = [geo.name, geo.street].filter(Boolean).join(', ') || geo.formattedAddress || '';
        const city = geo.city || geo.subregion || '';
        const state = geo.region || '';
        const pincode = geo.postalCode || '';
        setLocationText([addrLine, city, state].filter(Boolean).join(', '));

        if (user && (!user.addresses || user.addresses.length === 0)) {
          try {
            await api('/api/auth/address', {
              method: 'POST',
              body: JSON.stringify({
                label: 'Current Location',
                address_line: addrLine || 'Auto-detected address',
                city, state, pincode,
                phone: user.phone || '',
              }),
            });
            await refreshProfile();
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Location error:', e);
      setLocationDenied(true);
      if (user?.addresses && user.addresses.length > 0) {
        const addr = user.addresses[0];
        setLocationText([addr.address_line, addr.city, addr.state].filter(Boolean).join(', '));
      } else {
        setLocationText('Tap to set your delivery address');
        setShowLocationBanner(true);
      }
    }
  }

  const onRefresh = () => { setRefreshing(true); fetchData(); requestLocation(); };

  // ── Main home ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Location Banner - shows when location denied and no saved address */}
        {showLocationBanner && (
          <TouchableOpacity
            testID="location-banner"
            style={styles.locationBanner}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={20} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.bannerTitle}>Set your delivery address</Text>
              <Text style={styles.bannerSubtitle}>Tap here to add your address in Profile</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLocationBanner(false)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Location Bar */}
        <TouchableOpacity testID="home-location-bar" style={styles.locationBar} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.7}>
          <Ionicons name="location" size={18} color={locationDenied ? '#F59E0B' : colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationText} numberOfLines={1}>{locationText || 'Set your delivery address'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.tagline}>What would you like to order?</Text>
          </View>
          <TouchableOpacity testID="home-notifications-btn" style={styles.notifBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity testID="home-search-bar" style={styles.searchBar} onPress={() => router.push('/(tabs)/search')} activeOpacity={0.7}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text style={styles.searchText}>Search products...</Text>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                testID={`category-${cat.name.toLowerCase().replace(/\s+/g, '-')}-btn`}
                style={styles.catItem}
                onPress={() => router.push(`/category/${cat.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.catIconWrap}>
                  <Ionicons name={(CATEGORY_ICONS[cat.icon] || 'grid') as any} size={28} color={colors.primary} />
                </View>
                <Text style={styles.catName} numberOfLines={2}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Popular Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Products</Text>
          <View style={styles.productGrid}>
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                testID={`product-card-${product.id}`}
                style={styles.productCard}
                onPress={() => router.push(`/product/${product.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.productImgWrap}>
                  <Image source={{ uri: product.image }} style={styles.productImg} />
                </View>
                <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.productWeight}>{product.weight} {product.unit !== 'piece' ? `/ ${product.unit}` : ''}</Text>
                <View style={styles.productBottom}>
                  <Text style={styles.productPrice}>₹{product.price.toFixed(2)}</Text>
                  <View style={styles.addBtn}>
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Location banner (when denied)
  locationBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: '#FFF8E1', marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: '#FFE082' },
  bannerTitle: { fontSize: 13, fontWeight: '600', color: '#F57F17' },
  bannerSubtitle: { fontSize: 11, color: '#F9A825', marginTop: 1 },
  // Location bar
  locationBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radii.md },
  locationLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  locationText: { fontSize: 13, color: colors.textMain, fontWeight: '500' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  greeting: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  tagline: { fontSize: 22, fontWeight: '700', color: colors.textMain, letterSpacing: -0.5, marginTop: 2 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md, height: 48, paddingHorizontal: spacing.md, gap: spacing.sm },
  searchText: { fontSize: 15, color: colors.textMuted },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain, paddingHorizontal: spacing.md, marginBottom: spacing.md, letterSpacing: -0.3 },
  catScroll: { paddingHorizontal: spacing.md, gap: 12 },
  catItem: { alignItems: 'center', width: 80 },
  catIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  catName: { fontSize: 12, fontWeight: '600', color: colors.textMain, textAlign: 'center' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  productCard: { width: '47%', backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, ...shadows.sm },
  productImgWrap: { width: '100%', aspectRatio: 1, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.sm },
  productImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  productName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  productWeight: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  productPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
});
