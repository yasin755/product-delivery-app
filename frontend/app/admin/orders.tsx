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
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function deleteOrder(orderId: string) {
    Alert.alert(
      'Delete Order',
      `Are you sure you want to delete order #${orderId.slice(0, 8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(orderId);
            try {
              await api(`/api/orders/${orderId}`, { method: 'DELETE' });
              setOrders(orders.filter(o => o.id !== orderId));
              Alert.alert('Success', 'Order deleted successfully');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  }

  async function deleteAllOrders() {
    Alert.alert(
      'Delete All Orders',
      `Are you sure you want to delete ALL ${orders.length} orders? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await api('/api/orders', { method: 'DELETE' });
              setOrders([]);
              Alert.alert('Success', result.message || 'All orders deleted');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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
        {orders.length > 0 ? (
          <TouchableOpacity testID="admin-delete-all-orders-btn" onPress={deleteAllOrders} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View testID={`admin-order-${item.id}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardId}>#{item.id.slice(0, 8)}</Text>
                  <Text style={styles.cardUser}>{item.user_name} - {item.user_email}</Text>
                  <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardTotal}>₹{item.total?.toFixed(2)}</Text>
                  <TouchableOpacity
                    testID={`admin-delete-order-${item.id}`}
                    onPress={() => deleteOrder(item.id)}
                    disabled={deleting === item.id}
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                  >
                    {deleting === item.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || colors.textMuted }]}>
                  <Text style={styles.statusText}>{item.status.replace(/_/g, ' ')}</Text>
                </View>
                <View style={[styles.payBadge, { backgroundColor: item.payment_status === 'paid' || item.payment_status === 'cod' ? colors.secondaryLight : '#FEF3C7' }]}>
                  <Text style={[styles.payText, { color: item.payment_status === 'paid' || item.payment_status === 'cod' ? colors.secondary : '#F59E0B' }]}>
                    {item.payment_status === 'paid' ? 'Paid' : item.payment_status === 'cod' ? 'COD' : 'Unpaid'}
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
      )}
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
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  cardTotal: { fontSize: 18, fontWeight: '700', color: colors.textMain },
  deleteBtn: { padding: spacing.xs },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  payBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radii.pill },
  payText: { fontSize: 11, fontWeight: '600' },
  updateBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 2 },
  updateText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 16, color: colors.textMuted },
});
