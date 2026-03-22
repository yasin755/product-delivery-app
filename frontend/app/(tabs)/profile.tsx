import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  async function confirmLogout() {
    setShowLogoutModal(false);
    await logout();
    router.replace('/(auth)/login');
  }

  function handleLogout() {
    setShowLogoutModal(true);
  }

  const menuItems = [
    { icon: 'receipt-outline', label: 'My Orders', onPress: () => router.push('/(tabs)/orders'), testID: 'profile-orders-btn' },
    { icon: 'location-outline', label: 'Delivery Addresses', onPress: () => {}, testID: 'profile-addresses-btn' },
    { icon: 'card-outline', label: 'Payment Methods', onPress: () => {}, testID: 'profile-payments-btn' },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => {}, testID: 'profile-notifications-btn' },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {}, testID: 'profile-help-btn' },
  ];

  if (user?.role === 'admin') {
    menuItems.unshift({
      icon: 'shield-checkmark-outline', label: 'Admin Dashboard', onPress: () => router.push('/admin'), testID: 'profile-admin-btn',
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {user?.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield" size={14} color="#fff" />
              <Text style={styles.adminText}>Admin</Text>
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              testID={item.testID}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon as any} size={22} color={colors.textMain} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity testID="profile-logout-btn" style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalSubtitle}>Are you sure you want to logout?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity testID="logout-cancel-btn" style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="logout-confirm-btn" style={styles.modalConfirmBtn} onPress={confirmLogout} activeOpacity={0.7}>
                <Text style={styles.modalConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '700', color: colors.textMain, marginTop: spacing.md },
  userEmail: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.secondary, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 4, marginTop: spacing.sm },
  adminText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  menuSection: { marginHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, ...shadows.sm },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '500', color: colors.textMain },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.md },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.error },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.md, paddingBottom: spacing.xxl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  modalBox: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  modalSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, width: '100%' },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  modalConfirmBtn: { flex: 1, height: 48, borderRadius: radii.pill, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
