import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/api/products/${id}`);
        setProduct(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function addToCart() {
    setAdding(true);
    try {
      await api('/api/cart/add', { method: 'POST', body: JSON.stringify({ product_id: id, quantity }) });
      Alert.alert('Added to Cart', `${product.name} x${quantity} added!`, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'Go to Cart', onPress: () => router.push('/(tabs)/cart') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add to cart');
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }
  if (!product) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><Text>Product not found</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="product-back-btn" style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.image }} style={styles.image} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.weight}>{product.weight} / {product.unit}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.rating}>{product.rating}</Text>
              <Text style={styles.reviews}>({product.review_count} reviews)</Text>
            </View>
          </View>
          <Text style={styles.price}>₹{product.price.toFixed(2)}</Text>
          <Text style={styles.desc}>{product.description}</Text>

          {/* Quantity */}
          <View style={styles.qtySection}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity testID="product-qty-decrease" style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))} activeOpacity={0.7}>
                <Ionicons name="remove" size={20} color={colors.textMain} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity testID="product-qty-increase" style={styles.qtyBtn} onPress={() => setQuantity(quantity + 1)} activeOpacity={0.7}>
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {product.stock > 0 ? (
            <View style={styles.stockBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.stockText}>In Stock ({product.stock} available)</Text>
            </View>
          ) : (
            <View style={[styles.stockBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <Text style={[styles.stockText, { color: colors.error }]}>Out of Stock</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomPrice}>₹{(product.price * quantity).toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          testID="product-add-to-cart-btn"
          style={[styles.addCartBtn, product.stock <= 0 && { opacity: 0.5 }]}
          onPress={addToCart}
          disabled={adding || product.stock <= 0}
          activeOpacity={0.7}
        >
          {adding ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addCartText}>Add to Cart</Text>
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
  scroll: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', ...shadows.sm },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  info: { padding: spacing.lg },
  productName: { fontSize: 24, fontWeight: '700', color: colors.textMain, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  weight: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  reviews: { fontSize: 12, color: colors.textMuted },
  price: { fontSize: 28, fontWeight: '700', color: colors.primary, marginTop: spacing.md },
  desc: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  qtySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  qtyLabel: { fontSize: 16, fontWeight: '600', color: colors.textMain },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  qtyValue: { fontSize: 20, fontWeight: '700', color: colors.textMain, minWidth: 30, textAlign: 'center' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.secondaryLight, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: spacing.md, alignSelf: 'flex-start' },
  stockText: { fontSize: 13, fontWeight: '500', color: colors.secondary },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  bottomLabel: { fontSize: 13, color: colors.textMuted },
  bottomPrice: { fontSize: 22, fontWeight: '700', color: colors.textMain },
  addCartBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: spacing.xl, height: 52 },
  addCartText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
