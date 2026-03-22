import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
  out_for_delivery: '#EC4899', delivered: '#10B981', cancelled: '#EF4444',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/api/orders/${id}`);
        setOrder(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }
  if (!order) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><Text>Order not found</Text></View></SafeAreaView>;
  }

  const currentStep = STATUS_STEPS.indexOf(order.status);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="order-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] || colors.textMuted }]}>
            <Text style={styles.statusBadgeText}>{order.status.replace(/_/g, ' ')}</Text>
          </View>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</Text>

          {/* Progress */}
          {order.status !== 'cancelled' && (
            <View style={styles.progressRow}>
              {STATUS_STEPS.map((step, i) => (
                <View key={step} style={styles.progressItem}>
                  <View style={[styles.progressDot, i <= currentStep && { backgroundColor: colors.primary }]}>
                    {i <= currentStep && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  {i < STATUS_STEPS.length - 1 && (
                    <View style={[styles.progressLine, i < currentStep && { backgroundColor: colors.primary }]} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items?.map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Image source={{ uri: item.image }} style={styles.itemImg} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressBox}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={styles.addressText}>
              {order.address?.address_line}, {order.address?.city}, {order.address?.state} {order.address?.pincode}
            </Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Status</Text>
            <Text style={[styles.payValue, { color: order.payment_status === 'paid' ? colors.success : colors.error }]}>
              {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
            </Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Total</Text>
            <Text style={styles.payTotal}>${order.total?.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  content: { flex: 1, paddingHorizontal: spacing.md },
  statusCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radii.pill },
  statusBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  orderId: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginTop: spacing.md },
  orderDate: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  progressLine: { flex: 1, height: 3, backgroundColor: colors.border },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginBottom: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.sm, ...shadows.sm },
  itemImg: { width: 50, height: 50, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  itemInfo: { flex: 1, marginLeft: spacing.md },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  itemQty: { fontSize: 12, color: colors.textMuted },
  itemPrice: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  addressBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, ...shadows.sm },
  addressText: { flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  payLabel: { fontSize: 14, color: colors.textMuted },
  payValue: { fontSize: 14, fontWeight: '600' },
  payTotal: { fontSize: 20, fontWeight: '700', color: colors.textMain },
});
