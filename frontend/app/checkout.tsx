import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { api, getApiBase } from '../src/api';
import { useAuth } from '../src/context/AuthContext';
import { colors, spacing, radii, shadows } from '../src/theme';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const params = useLocalSearchParams();
  const [cart, setCart] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddr, setEditAddr] = useState({ label: 'Home', address_line: '', city: '', state: '', pincode: '', phone: '' });
  const [detecting, setDetecting] = useState(false);

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('card');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [showCouponsSheet, setShowCouponsSheet] = useState(false);

  useEffect(() => {
    if (params.session_id && params.status === 'success') {
      pollPaymentStatus(params.session_id as string, params.order_id as string);
    } else {
      fetchCart();
      fetchCoupons();
    }
  }, [params.session_id]);

  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0) {
      setSelectedAddress(user.addresses[user.addresses.length - 1]);
    }
  }, [user?.addresses]);

  async function fetchCart() {
    try {
      const data = await api('/api/cart');
      setCart(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchCoupons() {
    try {
      const data = await api('/api/coupons');
      setAvailableCoupons(data);
    } catch (e) { console.error(e); }
  }

  async function pollPaymentStatus(sessionId: string, oid: string, attempts = 0) {
    if (attempts >= 5) {
      Alert.alert('Payment Status', 'Could not confirm payment. Check your orders.');
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
    } catch {
      setTimeout(() => pollPaymentStatus(sessionId, oid, attempts + 1), 2000);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const data = await api('/api/coupons/apply', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode.trim(), cart_total: cart.total }),
      });
      setAppliedCoupon(data.coupon);
      setDiscount(data.discount);
      setCouponError('');
    } catch (e: any) {
      setCouponError(e.message || 'Invalid coupon code');
      setAppliedCoupon(null);
      setDiscount(0);
    }
    setApplyingCoupon(false);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode('');
    setCouponError('');
  }

  function selectCoupon(coupon: any) {
    setCouponCode(coupon.code);
    setShowCouponsSheet(false);
    // Auto-apply
    setTimeout(async () => {
      setApplyingCoupon(true);
      setCouponError('');
      try {
        const data = await api('/api/coupons/apply', {
          method: 'POST',
          body: JSON.stringify({ code: coupon.code, cart_total: cart.total }),
        });
        setAppliedCoupon(data.coupon);
        setDiscount(data.discount);
      } catch (e: any) {
        setCouponError(e.message || 'Invalid coupon code');
        setAppliedCoupon(null);
        setDiscount(0);
      }
      setApplyingCoupon(false);
    }, 100);
  }

  const finalTotal = Math.max(0, cart.total - discount);

  async function handleCheckout() {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please add a delivery address.');
      setShowAddressModal(true);
      return;
    }
    setProcessing(true);
    try {
      const originUrl = getApiBase();
      const data = await api('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({ 
          address: selectedAddress, 
          origin_url: originUrl,
          payment_method: paymentMethod 
        }),
      });
      setOrderId(data.order_id);
      
      // Handle COD - directly show success
      if (data.payment_method === 'cod' || paymentMethod === 'cod') {
        setPaymentSuccess(true);
        setProcessing(false);
        return;
      }
      
      // Handle card payment - show WebView
      if (data.checkout_url) {
        setCheckoutUrl(data.checkout_url);
      }
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

  async function detectLocation() {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location in settings.');
        setDetecting(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) {
        setEditAddr({
          label: 'Current Location',
          address_line: [geo.name, geo.street].filter(Boolean).join(', ') || geo.formattedAddress || '',
          city: geo.city || geo.subregion || '',
          state: geo.region || '',
          pincode: geo.postalCode || '',
          phone: user?.phone || '',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to detect location.');
    }
    setDetecting(false);
  }

  async function saveAndSelectAddress() {
    if (!editAddr.address_line.trim() || !editAddr.city.trim()) {
      Alert.alert('Error', 'Address line and city are required.');
      return;
    }
    try {
      const res = await api('/api/auth/address', {
        method: 'POST',
        body: JSON.stringify({ ...editAddr, phone: editAddr.phone || user?.phone || '' }),
      });
      await refreshProfile();
      setSelectedAddress(res.address);
      setShowAddressModal(false);
      setEditAddr({ label: 'Home', address_line: '', city: '', state: '', pincode: '', phone: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
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
        <WebView source={{ uri: checkoutUrl }} onNavigationStateChange={handleWebViewNavigation} style={styles.webview} startInLoadingState renderLoading={() => <ActivityIndicator style={styles.webLoading} size="large" color={colors.primary} />} />
      </SafeAreaView>
    );
  }

  // Payment Success
  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={80} color={colors.success} /></View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successSubtitle}>Your order has been confirmed and will be delivered soon.</Text>
          {discount > 0 && (
            <View style={styles.savingsBadge}>
              <Ionicons name="pricetag" size={16} color={colors.success} />
              <Text style={styles.savingsText}>You saved ₹{discount.toFixed(2)} with coupon!</Text>
            </View>
          )}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity testID="checkout-change-address-btn" onPress={() => setShowAddressModal(true)} activeOpacity={0.7}>
              <Text style={styles.changeBtn}>{selectedAddress ? 'Change' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
          {selectedAddress ? (
            <View style={styles.addressCard}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.addressLabel}>{selectedAddress.label}</Text>
                <Text style={styles.addressText}>{selectedAddress.address_line}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity testID="checkout-add-address-btn" style={styles.noAddressCard} onPress={() => setShowAddressModal(true)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.noAddressText}>Add a delivery address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {cart.items.map((item: any) => (
            <View key={item.product_id} style={styles.summaryItem}>
              <Text style={styles.summaryName}>{item.product?.name} x{item.quantity}</Text>
              <Text style={styles.summaryPrice}>₹{(item.product?.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Coupon Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apply Coupon</Text>
          {appliedCoupon ? (
            <View style={styles.appliedCouponCard}>
              <View style={styles.appliedCouponLeft}>
                <View style={styles.couponBadge}>
                  <Ionicons name="pricetag" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appliedCouponCode}>{appliedCoupon.code}</Text>
                  <Text style={styles.appliedCouponSaving}>You save ₹{discount.toFixed(2)}</Text>
                </View>
              </View>
              <TouchableOpacity testID="remove-coupon-btn" onPress={removeCoupon} activeOpacity={0.7} style={styles.removeCouponBtn}>
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.couponInputRow}>
                <TextInput
                  testID="coupon-code-input"
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={(t) => { setCouponCode(t.toUpperCase()); setCouponError(''); }}
                  placeholder="Enter coupon code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  testID="apply-coupon-btn"
                  style={[styles.applyCouponBtn, (!couponCode.trim() || applyingCoupon) && { opacity: 0.5 }]}
                  onPress={applyCoupon}
                  disabled={!couponCode.trim() || applyingCoupon}
                  activeOpacity={0.7}
                >
                  {applyingCoupon ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.applyCouponBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {couponError ? (
                <View style={styles.couponErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={styles.couponErrorText}>{couponError}</Text>
                </View>
              ) : null}

              {availableCoupons.length > 0 && (
                <TouchableOpacity testID="view-coupons-btn" style={styles.viewCouponsBtn} onPress={() => setShowCouponsSheet(true)} activeOpacity={0.7}>
                  <Ionicons name="pricetags-outline" size={18} color={colors.primary} />
                  <Text style={styles.viewCouponsBtnText}>
                    View {availableCoupons.length} available coupon{availableCoupons.length > 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity 
            testID="payment-method-card"
            style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('card')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentOptionLeft}>
              <View style={[styles.paymentIconWrap, paymentMethod === 'card' && styles.paymentIconWrapSelected]}>
                <Ionicons name="card" size={22} color={paymentMethod === 'card' ? colors.primary : colors.textMuted} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[styles.paymentOptionTitle, paymentMethod === 'card' && styles.paymentOptionTitleSelected]}>Credit/Debit Card</Text>
                <Text style={styles.paymentOptionDesc}>Pay securely with card (Test Mode)</Text>
              </View>
            </View>
            <Ionicons 
              name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'} 
              size={22} 
              color={paymentMethod === 'card' ? colors.primary : colors.textMuted} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            testID="payment-method-cod"
            style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('cod')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentOptionLeft}>
              <View style={[styles.paymentIconWrap, paymentMethod === 'cod' && styles.paymentIconWrapSelected]}>
                <Ionicons name="cash" size={22} color={paymentMethod === 'cod' ? colors.primary : colors.textMuted} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[styles.paymentOptionTitle, paymentMethod === 'cod' && styles.paymentOptionTitleSelected]}>Cash on Delivery</Text>
                <Text style={styles.paymentOptionDesc}>Pay when your order arrives</Text>
              </View>
            </View>
            <Ionicons 
              name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'} 
              size={22} 
              color={paymentMethod === 'cod' ? colors.primary : colors.textMuted} 
            />
          </TouchableOpacity>
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ({cart.items.length} items)</Text>
            <Text style={styles.totalValue}>₹{cart.total.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.success }]}>Coupon Discount</Text>
              <Text style={[styles.totalValue, { color: colors.success }]}>-₹{discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery</Text>
            <Text style={[styles.totalValue, { color: colors.success }]}>FREE</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>₹{finalTotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.savingsRow}>
              <Ionicons name="happy-outline" size={16} color={colors.success} />
              <Text style={styles.savingsRowText}>You're saving ₹{discount.toFixed(2)} on this order!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="checkout-pay-btn"
          style={[styles.payBtn, (!selectedAddress || cart.items.length === 0) && { opacity: 0.5 }]}
          onPress={handleCheckout}
          disabled={processing || !selectedAddress || cart.items.length === 0}
          activeOpacity={0.7}
        >
          {processing ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name={paymentMethod === 'cod' ? 'checkmark-circle' : 'lock-closed'} size={18} color="#fff" />
              <Text style={styles.payBtnText}>
                {paymentMethod === 'cod' ? `Place Order ₹${finalTotal.toFixed(2)}` : `Pay ₹${finalTotal.toFixed(2)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Available Coupons Modal */}
      <Modal visible={showCouponsSheet} transparent animationType="slide" onRequestClose={() => setShowCouponsSheet(false)}>
        <View style={styles.couponSheetOverlay}>
          <View style={styles.couponSheetBox}>
            <View style={styles.couponSheetHeader}>
              <Text style={styles.couponSheetTitle}>Available Coupons</Text>
              <TouchableOpacity testID="close-coupons-sheet" onPress={() => setShowCouponsSheet(false)}>
                <Ionicons name="close" size={24} color={colors.textMain} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableCoupons.map((coupon, index) => (
                <View key={coupon.id || index} style={styles.couponCard}>
                  <View style={styles.couponCardLeft}>
                    <View style={styles.couponCodeBadge}>
                      <Text style={styles.couponCodeBadgeText}>{coupon.code}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.couponDesc}>
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}% OFF`
                          : `₹${coupon.discount_value} OFF`}
                        {coupon.max_discount > 0 ? ` up to ₹${coupon.max_discount}` : ''}
                      </Text>
                      {coupon.min_order > 0 && (
                        <Text style={styles.couponMinOrder}>Min. order ₹{coupon.min_order}</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    testID={`apply-coupon-${index}`}
                    style={[
                      styles.couponApplyBtn,
                      cart.total < coupon.min_order && { opacity: 0.4 },
                    ]}
                    onPress={() => selectCoupon(coupon)}
                    disabled={cart.total < coupon.min_order}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.couponApplyBtnText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Address Modal */}
      <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.addrModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.addrModalWrap}>
            <View style={styles.addrModalBox}>
              <View style={styles.addrModalHeader}>
                <Text style={styles.addrModalTitle}>Select Address</Text>
                <TouchableOpacity testID="close-checkout-addr-modal" onPress={() => setShowAddressModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textMain} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Saved Addresses - Select */}
                {user?.addresses && user.addresses.length > 0 && (
                  <View style={styles.addrSection}>
                    <Text style={styles.addrSectionTitle}>Saved Addresses</Text>
                    {user.addresses.map((addr: any, i: number) => (
                      <TouchableOpacity
                        key={addr.id || i}
                        testID={`select-address-${i}`}
                        style={[styles.savedAddr, selectedAddress?.id === addr.id && styles.savedAddrSelected]}
                        onPress={() => { setSelectedAddress(addr); setShowAddressModal(false); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={selectedAddress?.id === addr.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.primary} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={styles.savedAddrLabel}>{addr.label}</Text>
                          <Text style={styles.savedAddrText}>{addr.address_line}, {addr.city}, {addr.state} {addr.pincode}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Add New */}
                <View style={styles.addrSection}>
                  <Text style={styles.addrSectionTitle}>Add New Address</Text>
                  <TouchableOpacity testID="checkout-detect-location-btn" style={styles.detectBtn} onPress={detectLocation} disabled={detecting} activeOpacity={0.7}>
                    {detecting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={18} color={colors.primary} />}
                    <Text style={styles.detectBtnText}>{detecting ? 'Detecting...' : 'Use Current Location'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Label</Text>
                  <TextInput testID="checkout-addr-label" style={styles.fieldInput} value={editAddr.label} onChangeText={(t) => setEditAddr({ ...editAddr, label: t })} placeholder="Home, Work..." placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Address Line</Text>
                  <TextInput testID="checkout-addr-line" style={styles.fieldInput} value={editAddr.address_line} onChangeText={(t) => setEditAddr({ ...editAddr, address_line: t })} placeholder="Street, building" placeholderTextColor={colors.textMuted} />
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>City</Text>
                      <TextInput testID="checkout-addr-city" style={styles.fieldInput} value={editAddr.city} onChangeText={(t) => setEditAddr({ ...editAddr, city: t })} placeholder="City" placeholderTextColor={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>State</Text>
                      <TextInput testID="checkout-addr-state" style={styles.fieldInput} value={editAddr.state} onChangeText={(t) => setEditAddr({ ...editAddr, state: t })} placeholder="State" placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Pincode</Text>
                      <TextInput testID="checkout-addr-pincode" style={styles.fieldInput} value={editAddr.pincode} onChangeText={(t) => setEditAddr({ ...editAddr, pincode: t })} placeholder="Pincode" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Phone</Text>
                      <TextInput testID="checkout-addr-phone" style={styles.fieldInput} value={editAddr.phone} onChangeText={(t) => setEditAddr({ ...editAddr, phone: t })} placeholder="Phone" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                    </View>
                  </View>
                  <TouchableOpacity testID="checkout-save-address-btn" style={styles.saveAddrBtn} onPress={saveAndSelectAddress} activeOpacity={0.7}>
                    <Text style={styles.saveAddrBtnText}>Save & Use This Address</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginBottom: spacing.sm },
  changeBtn: { fontSize: 14, fontWeight: '600', color: colors.primary },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, ...shadows.sm },
  addressLabel: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  addressText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  noAddressCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' },
  noAddressText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryName: { fontSize: 14, color: colors.textMain, flex: 1 },
  summaryPrice: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  // Coupon
  couponInputRow: { flexDirection: 'row', gap: spacing.sm },
  couponInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, paddingHorizontal: spacing.md, height: 48, fontSize: 15, color: colors.textMain, fontWeight: '600', letterSpacing: 1 },
  applyCouponBtn: { backgroundColor: colors.primary, borderRadius: radii.sm, paddingHorizontal: spacing.lg, height: 48, justifyContent: 'center', alignItems: 'center' },
  applyCouponBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  couponErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  couponErrorText: { fontSize: 12, color: colors.error },
  viewCouponsBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingVertical: spacing.sm },
  viewCouponsBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary, flex: 1 },
  appliedCouponCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#DCFCE7', borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: '#BBF7D0' },
  appliedCouponLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  couponBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#BBF7D0', justifyContent: 'center', alignItems: 'center' },
  appliedCouponCode: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  appliedCouponSaving: { fontSize: 13, color: colors.success, fontWeight: '600', marginTop: 2 },
  removeCouponBtn: { padding: spacing.xs },
  // Coupon Sheet
  couponSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  couponSheetBox: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: '70%' },
  couponSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  couponSheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  couponCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  couponCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  couponCodeBadge: { backgroundColor: colors.primaryLight, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  couponCodeBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary, letterSpacing: 1 },
  couponDesc: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  couponMinOrder: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  couponApplyBtn: { backgroundColor: colors.primary, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  couponApplyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  grandTotal: { borderTopWidth: 2, borderTopColor: colors.textMain, marginTop: spacing.sm, paddingTop: spacing.md },
  grandLabel: { fontSize: 18, fontWeight: '700', color: colors.textMain },
  grandValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  savingsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#DCFCE7', borderRadius: radii.sm, padding: spacing.sm, marginTop: spacing.sm },
  savingsRowText: { fontSize: 13, fontWeight: '600', color: colors.success },
  savingsBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#DCFCE7', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.lg },
  savingsText: { fontSize: 14, fontWeight: '600', color: colors.success },
  // Payment Method
  paymentOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.border },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  paymentOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  paymentIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  paymentIconWrapSelected: { backgroundColor: '#fff' },
  paymentOptionTitle: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  paymentOptionTitleSelected: { color: colors.primary },
  paymentOptionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Footer
  footer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.pill, height: 56 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  webHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  webTitle: { fontSize: 16, fontWeight: '600', color: colors.textMain },
  webview: { flex: 1 },
  webLoading: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  successIcon: { marginBottom: spacing.lg },
  successTitle: { fontSize: 28, fontWeight: '700', color: colors.textMain },
  successSubtitle: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, height: 56, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  secondaryBtnText: { color: colors.textMain, fontSize: 16, fontWeight: '600' },
  // Address Modal
  addrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  addrModalWrap: { maxHeight: '90%' },
  addrModalBox: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: '100%' },
  addrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addrModalTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  addrSection: { marginBottom: spacing.lg },
  addrSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: spacing.sm },
  savedAddr: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
  savedAddrSelected: { borderWidth: 2, borderColor: colors.primary },
  savedAddrLabel: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  savedAddrText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  detectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radii.md, paddingVertical: 12, marginBottom: spacing.md },
  detectBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMain, marginBottom: 4, marginTop: spacing.sm },
  fieldInput: { backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, paddingHorizontal: spacing.md, height: 44, fontSize: 15, color: colors.textMain },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  saveAddrBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  saveAddrBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
