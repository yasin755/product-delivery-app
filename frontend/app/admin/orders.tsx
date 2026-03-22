import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

const STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
  out_for_delivery: '#EC4899', delivered: '#10B981', cancelled: '#EF4444',
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    try {
      const data = await api('/api/orders');
      setOrders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function updateStatus(orderId: string, currentStatus: string) {
    const currentIdx = STATUSES.indexOf(currentStatus);
    const nextStatuses = STATUSES.filter((_, i) => i > currentIdx);
    if (nextStatuses.length === 0) return;

    Alert.alert('Update Status', 'Select new status:', [
      ...nextStatuses.map(s => ({
        text: s.replace(/_/g, ' '),
        onPress: async () => {
          try {
            await api(`/api/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status: s }) });
            fetchOrders();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="admin-orders-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders ({orders.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View testID={`admin-order-${item.id}`} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardId}>#{item.id.slice(0, 8)}</Text>
                <Text style={styles.cardUser}>{item.user_name} - {item.user_email}</Text>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.cardTotal}>${item.total?.toFixed(2)}</Text>
            </View>
            <View style={styles.cardBottom}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.textMuted }]}>
                <Text style={styles.statusText}>{item.status.replace(/_/g, ' ')}</Text>
              </View>
              <View style={[styles.payBadge, { backgroundColor: item.payment_status === 'paid' ? colors.secondaryLight : '#FEF3C7' }]}>
                <Text style={[styles.payText, { color: item.payment_status === 'paid' ? colors.secondary : '#F59E0B' }]}>
                  {item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                </Text>
              </View>
              {item.status !== 'delivered' && item.status !== 'cancelled' && (
                <TouchableOpacity
                  testID={`admin-update-status-${item.id}`}
                  style={styles.updateBtn}
                  onPress={() => updateStatus(item.id, item.status)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.updateText}>Update</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardId: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  cardUser: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.textMuted },
  cardTotal: { fontSize: 18, fontWeight: '700', color: colors.textMain },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  payBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  payText: { fontSize: 11, fontWeight: '600' },
  updateBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 2 },
  updateText: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
