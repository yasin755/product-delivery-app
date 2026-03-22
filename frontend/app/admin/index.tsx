import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function AdminDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchDashboard() {
    try {
      const data = await api('/api/admin/dashboard');
      setDashboard(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  const stats = [
    { label: 'Total Orders', value: dashboard?.total_orders || 0, icon: 'receipt', color: '#3B82F6', bg: '#DBEAFE' },
    { label: 'Revenue', value: `$${dashboard?.total_revenue?.toFixed(2) || '0.00'}`, icon: 'cash', color: '#10B981', bg: '#D1FAE5' },
    { label: 'Products', value: dashboard?.total_products || 0, icon: 'cube', color: '#8B5CF6', bg: '#EDE9FE' },
    { label: 'Users', value: dashboard?.total_users || 0, icon: 'people', color: '#F59E0B', bg: '#FEF3C7' },
  ];

  const orderStats = [
    { label: 'Pending', value: dashboard?.pending_orders || 0, color: '#F59E0B' },
    { label: 'Confirmed', value: dashboard?.confirmed_orders || 0, color: '#3B82F6' },
    { label: 'Delivered', value: dashboard?.delivered_orders || 0, color: '#10B981' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity testID="admin-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={24} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Order Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          <View style={styles.orderStatRow}>
            {orderStats.map((s, i) => (
              <View key={i} style={styles.orderStatItem}>
                <Text style={[styles.orderStatValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.orderStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <TouchableOpacity testID="admin-manage-products-btn" style={styles.actionBtn} onPress={() => router.push('/admin/products')} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="cube" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Products</Text>
              <Text style={styles.actionDesc}>Add, edit or remove products</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity testID="admin-manage-orders-btn" style={styles.actionBtn} onPress={() => router.push('/admin/orders')} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="receipt" size={22} color="#3B82F6" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Orders</Text>
              <Text style={styles.actionDesc}>Manage and update orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {dashboard?.recent_orders?.slice(0, 5).map((order: any) => (
            <View key={order.id} style={styles.recentOrder}>
              <View>
                <Text style={styles.recentId}>#{order.id.slice(0, 8)}</Text>
                <Text style={styles.recentUser}>{order.user_name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.recentTotal}>${order.total?.toFixed(2)}</Text>
                <Text style={[styles.recentStatus, { color: order.status === 'delivered' ? colors.success : colors.primary }]}>{order.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  statCard: { width: '47%', borderRadius: radii.md, padding: spacing.md },
  statValue: { fontSize: 24, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginBottom: spacing.md },
  orderStatRow: { flexDirection: 'row', gap: spacing.md },
  orderStatItem: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  orderStatValue: { fontSize: 22, fontWeight: '700' },
  orderStatLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionInfo: { flex: 1, marginLeft: spacing.md },
  actionTitle: { fontSize: 16, fontWeight: '600', color: colors.textMain },
  actionDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  recentOrder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  recentId: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  recentUser: { fontSize: 12, color: colors.textMuted },
  recentTotal: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  recentStatus: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
});
