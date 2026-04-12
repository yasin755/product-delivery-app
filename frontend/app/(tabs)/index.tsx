import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl, Modal } from 'react-native';
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

type LocGate = 'checking' | 'granted' | 'denied';

export default function HomeScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationText, setLocationText] = useState('Detecting location...');
  const [locGate, setLocGate] = useState<LocGate>('checking');
  const [showDeniedModal, setShowDeniedModal] = useState(false);

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

  useEffect(() => { requestLocation(); }, []);

  async function requestLocation() {
    setLocGate('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocGate('denied');
        setShowDeniedModal(true);
        return;
      }
      setLocGate('granted');
      fetchData();

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
      setLocGate('denied');
      setShowDeniedModal(true);
    }
  }

  async function handleRetryPermission() {
    setShowDeniedModal(false);
    await requestLocation();
  }

  async function handleDenyAndLogout() {
    setShowDeniedModal(false);
    await logout();
    router.replace('/(auth)/login');
  }

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Location checking screen ──
  if (locGate === 'checking') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.gateWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.gateText}>Requesting location access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Location denied – full-screen blocker + modal ──
  if (locGate === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.gateWrap}>
          <View style={styles.gateIcon}>
            <Ionicons name="location-outline" size={56} color={colors.primary} />
          </View>
          <Text style={styles.gateTitle}>Location Required</Text>
          <Text style={styles.gateSubtitle}>
            We deliver products based on your location. Please allow location access to continue.
          </Text>
          <TouchableOpacity testID="retry-location-btn" style={styles.gatePrimaryBtn} onPress={handleRetryPermission} activeOpacity={0.7}>
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.gatePrimaryText}>Allow Location Access</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="deny-logout-btn" style={styles.gateSecondaryBtn} onPress={handleDenyAndLogout} activeOpacity={0.7}>
            <Text style={styles.gateSecondaryText}>Go Back to Login</Text>
          </TouchableOpacity>
        </View>

        {/* Denied info modal */}
        <Modal visible={showDeniedModal} transparent animationType="fade" onRequestClose={() => setShowDeniedModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="location" size={36} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Location Access Needed</Text>
              <Text style={styles.modalBody}>
                We order and deliver products based on your location. You must give us access to location to use this app.
              </Text>
              <Text style={styles.modalHint}>
                Please tap "Allow Location Access" below or enable location in your device settings.
              </Text>
              <TouchableOpacity testID="modal-retry-btn" style={styles.modalPrimaryBtn} onPress={handleRetryPermission} activeOpacity={0.7}>
                <Text style={styles.modalPrimaryText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="modal-logout-btn" style={styles.modalSecondaryBtn} onPress={handleDenyAndLogout} activeOpacity={0.7}>
                <Text style={styles.modalSecondaryText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Main home (location granted) ──
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
        {/* Location Bar */}
        <TouchableOpacity testID="home-location-bar" style={styles.locationBar} activeOpacity={0.7}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationText} numberOfLines={1}>{locationText}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
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
  // Location gate
  gateWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  gateIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  gateTitle: { fontSize: 24, fontWeight: '700', color: colors.textMain, textAlign: 'center' },
  gateSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  gateText: { fontSize: 15, color: colors.textMuted, marginTop: spacing.md },
  gatePrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  gatePrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  gateSecondaryBtn: { marginTop: spacing.md, paddingVertical: spacing.md },
  gateSecondaryText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  // Denied modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  modalBox: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, width: '100%', maxWidth: 360, alignItems: 'center' },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain, textAlign: 'center' },
  modalBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  modalHint: { fontSize: 13, color: colors.primary, textAlign: 'center', marginTop: spacing.md, fontWeight: '500' },
  modalPrimaryBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 52, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  modalPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalSecondaryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm },
  modalSecondaryText: { fontSize: 14, color: colors.error, fontWeight: '600' },
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
