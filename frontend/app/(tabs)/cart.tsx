import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function CartScreen() {
  const router = useRouter();
  const [cart, setCart] = useState<any>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const data = await api('/api/cart');
      setCart(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCart(); }, [fetchCart]));

  async function updateQuantity(productId: string, quantity: number) {
    setUpdating(productId);
    try {
      await api('/api/cart/update', { method: 'PUT', body: JSON.stringify({ product_id: productId, quantity }) });
      await fetchCart();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(productId: string) {
    setUpdating(productId);
    try {
      await api(`/api/cart/item/${productId}`, { method: 'DELETE' });
      await fetchCart();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        <Text style={styles.headerCount}>{cart.items.length} items</Text>
      </View>

      {cart.items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse products and add items</Text>
          <TouchableOpacity testID="cart-browse-btn" style={styles.browseBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <Text style={styles.browseBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={(item) => item.product_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View testID={`cart-item-${item.product_id}`} style={styles.cartItem}>
                <Image source={{ uri: item.product?.image }} style={styles.itemImg} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.product?.name}</Text>
                  <Text style={styles.itemPrice}>${item.product?.price?.toFixed(2)} / {item.product?.unit}</Text>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      testID={`cart-decrease-${item.product_id}`}
                      style={styles.qtyBtn}
                      onPress={() => item.quantity > 1 ? updateQuantity(item.product_id, item.quantity - 1) : removeItem(item.product_id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={item.quantity > 1 ? 'remove' : 'trash-outline'} size={16} color={item.quantity > 1 ? colors.textMain : colors.error} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{updating === item.product_id ? '...' : item.quantity}</Text>
                    <TouchableOpacity
                      testID={`cart-increase-${item.product_id}`}
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.itemTotal}>${(item.product?.price * item.quantity).toFixed(2)}</Text>
              </View>
            )}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${cart.total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              testID="cart-checkout-btn"
              style={styles.checkoutBtn}
              onPress={() => router.push('/checkout')}
              activeOpacity={0.7}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textMain },
  headerCount: { fontSize: 14, color: colors.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  emptySubtitle: { fontSize: 14, color: colors.textMuted },
  browseBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.xl, paddingVertical: 14, marginTop: spacing.md },
  browseBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm, ...shadows.sm },
  itemImg: { width: 72, height: 72, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  itemInfo: { flex: 1, marginLeft: spacing.md },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  itemPrice: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.md },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 16, fontWeight: '700', color: colors.textMain, minWidth: 20, textAlign: 'center' },
  itemTotal: { fontSize: 16, fontWeight: '700', color: colors.primary },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, backgroundColor: colors.surface },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { fontSize: 16, color: colors.textMuted },
  totalValue: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  checkoutBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
