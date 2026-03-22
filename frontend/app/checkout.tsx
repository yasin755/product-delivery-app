import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { api, getApiBase } from '../src/api';
import { useAuth } from '../src/context/AuthContext';
import { colors, spacing, radii, shadows } from '../src/theme';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [cart, setCart] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Check if returning from payment
  useEffect(() => {
    if (params.session_id && params.status === 'success') {
      pollPaymentStatus(params.session_id as string, params.order_id as string);
    } else {
      fetchCart();
    }
  }, [params.session_id]);

  async function fetchCart() {
    try {
      const data = await api('/api/cart');
      setCart(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function pollPaymentStatus(sessionId: string, oid: string, attempts = 0) {
    const maxAttempts = 5;
    if (attempts >= maxAttempts) {
      Alert.alert('Payment Status', 'Could not confirm payment. Check your orders for status.');
      setLoading(false);
      return;
    }
    try {
      const data = await api(`/api/payments/status/${sessionId}`);
      if (data.payment_status === 'paid') {
        setPaymentSuccess(true);
        setOrderId(oid);
        setLoading(false);
        return;
      }
      setTimeout(() => pollPaymentStatus(sessionId, oid, attempts + 1), 2000);
    } catch (e) {
      setTimeout(() => pollPaymentStatus(sessionId, oid, attempts + 1), 2000);
    }
  }

  async function handleCheckout() {
    if (!user?.addresses?.length) {
      Alert.alert('Address Required', 'Please add a delivery address first.');
      return;
    }
    setProcessing(true);
    try {
      const originUrl = getApiBase();
      const data = await api('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          address: user.addresses[0],
          origin_url: originUrl,
        }),
      });
      setOrderId(data.order_id);
      setCheckoutUrl(data.checkout_url);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Checkout failed');
      setProcessing(false);
    }
  }

  function handleWebViewNavigation(navState: any) {
    const url = navState.url || '';
    if (url.includes('session_id=') && url.includes('status=success')) {
      const sessionMatch = url.match(/session_id=([^&]+)/);
      const orderMatch = url.match(/order_id=([^&]+)/);
      if (sessionMatch) {
        setCheckoutUrl(null);
        setLoading(true);
        pollPaymentStatus(sessionMatch[1], orderMatch ? orderMatch[1] : orderId || '');
      }
    }
    if (url.includes('status=cancel')) {
      setCheckoutUrl(null);
      setProcessing(false);
      Alert.alert('Payment Cancelled', 'Your payment was cancelled.');
    }
  }

  // Stripe WebView
  if (checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.webHeader}>
          <TouchableOpacity testID="checkout-close-webview" onPress={() => { setCheckoutUrl(null); setProcessing(false); }} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.webTitle}>Secure Payment</Text>
          <Ionicons name="lock-closed" size={18} color={colors.success} />
        </View>
        <WebView
          source={{ uri: checkoutUrl }}
          onNavigationStateChange={handleWebViewNavigation}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={styles.webLoading} size="large" color={colors.primary} />}
        />
      </SafeAreaView>
    );
  }

  // Payment Success
  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successSubtitle}>Your order has been confirmed and will be delivered soon.</Text>
          <TouchableOpacity testID="checkout-view-order" style={styles.primaryBtn} onPress={() => router.replace(`/order/${orderId}`)} activeOpacity={0.7}>
            <Text style={styles.primaryBtnText}>View Order</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="checkout-continue-shopping" style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  const address = user?.addresses?.[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="checkout-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {address ? (
            <View style={styles.addressCard}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.addressLabel}>{address.label}</Text>
                <Text style={styles.addressText}>{address.address_line}, {address.city}, {address.state} {address.pincode}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noAddress}>No address found. Please add one from your profile.</Text>
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {cart.items.map((item: any) => (
            <View key={item.product_id} style={styles.summaryItem}>
              <Text style={styles.summaryName}>{item.product?.name} x{item.quantity}</Text>
              <Text style={styles.summaryPrice}>${(item.product?.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${cart.total.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery</Text>
            <Text style={[styles.totalValue, { color: colors.success }]}>FREE</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>${cart.total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="checkout-pay-btn"
          style={[styles.payBtn, (!address || cart.items.length === 0) && { opacity: 0.5 }]}
          onPress={handleCheckout}
          disabled={processing || !address || cart.items.length === 0}
          activeOpacity={0.7}
        >
          {processing ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payBtnText}>Pay ${cart.total.toFixed(2)}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  content: { flex: 1, paddingHorizontal: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginBottom: spacing.md },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, ...shadows.sm },
  addressLabel: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  addressText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  noAddress: { fontSize: 14, color: colors.error },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryName: { fontSize: 14, color: colors.textMain, flex: 1 },
  summaryPrice: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  grandTotal: { borderTopWidth: 2, borderTopColor: colors.textMain, marginTop: spacing.sm, paddingTop: spacing.md },
  grandLabel: { fontSize: 18, fontWeight: '700', color: colors.textMain },
  grandValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  footer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.pill, height: 56 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // WebView styles
  webHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  webTitle: { fontSize: 16, fontWeight: '600', color: colors.textMain },
  webview: { flex: 1 },
  webLoading: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
  // Success styles
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  successIcon: { marginBottom: spacing.lg },
  successTitle: { fontSize: 28, fontWeight: '700', color: colors.textMain },
  successSubtitle: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, height: 56, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  secondaryBtnText: { color: colors.textMain, fontSize: 16, fontWeight: '600' },
});
