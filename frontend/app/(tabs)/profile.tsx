import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addresses, setAddresses] = useState<any[]>(user?.addresses || []);
  const [editAddr, setEditAddr] = useState({ label: 'Home', address_line: '', city: '', state: '', pincode: '', phone: '' });
  const [detecting, setDetecting] = useState(false);

  useFocusEffect(useCallback(() => {
    if (user?.addresses) setAddresses(user.addresses);
  }, [user?.addresses]));

  async function confirmLogout() {
    setShowLogoutModal(false);
    await logout();
    router.replace('/(auth)/login');
  }

  async function detectLocation() {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location in settings.');
        setDetecting(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
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
    } catch (e) {
      Alert.alert('Error', 'Failed to detect location.');
    }
    setDetecting(false);
  }

  async function saveAddress() {
    if (!editAddr.address_line.trim() || !editAddr.city.trim()) {
      Alert.alert('Error', 'Address line and city are required.');
      return;
    }
    try {
      await api('/api/auth/address', {
        method: 'POST',
        body: JSON.stringify({ ...editAddr, phone: editAddr.phone || user?.phone || '' }),
      });
      await refreshProfile();
      setShowAddressModal(false);
      setEditAddr({ label: 'Home', address_line: '', city: '', state: '', pincode: '', phone: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const menuItems = [
    { icon: 'receipt-outline', label: 'My Orders', onPress: () => router.push('/(tabs)/orders'), testID: 'profile-orders-btn' },
    { icon: 'location-outline', label: 'Delivery Addresses', onPress: () => setShowAddressModal(true), testID: 'profile-addresses-btn' },
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
              style={[styles.menuItem, index === menuItems.length - 1 && { borderBottomWidth: 0 }]}
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

        <TouchableOpacity testID="profile-logout-btn" style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Logout Modal */}
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

      {/* Address Modal */}
      <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.addrModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.addrModalWrap}>
            <View style={styles.addrModalBox}>
              <View style={styles.addrModalHeader}>
                <Text style={styles.addrModalTitle}>Delivery Addresses</Text>
                <TouchableOpacity testID="close-address-modal" onPress={() => setShowAddressModal(false)}>
                  <Ionicons name="close" size={24} color={colors.textMain} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Saved Addresses */}
                {addresses.length > 0 && (
                  <View style={styles.addrSection}>
                    <Text style={styles.addrSectionTitle}>Saved Addresses</Text>
                    {addresses.map((addr, i) => (
                      <View key={addr.id || i} testID={`saved-address-${i}`} style={styles.savedAddr}>
                        <Ionicons name="location" size={18} color={colors.primary} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={styles.savedAddrLabel}>{addr.label}</Text>
                          <Text style={styles.savedAddrText}>{addr.address_line}, {addr.city}, {addr.state} {addr.pincode}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add New Address */}
                <View style={styles.addrSection}>
                  <Text style={styles.addrSectionTitle}>Add New Address</Text>

                  <TouchableOpacity testID="detect-location-btn" style={styles.detectBtn} onPress={detectLocation} disabled={detecting} activeOpacity={0.7}>
                    {detecting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={18} color={colors.primary} />}
                    <Text style={styles.detectBtnText}>{detecting ? 'Detecting...' : 'Use Current Location'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Label</Text>
                  <TextInput testID="addr-label-input" style={styles.fieldInput} value={editAddr.label} onChangeText={(t) => setEditAddr({ ...editAddr, label: t })} placeholder="Home, Work, etc." placeholderTextColor={colors.textMuted} />

                  <Text style={styles.fieldLabel}>Address Line</Text>
                  <TextInput testID="addr-line-input" style={styles.fieldInput} value={editAddr.address_line} onChangeText={(t) => setEditAddr({ ...editAddr, address_line: t })} placeholder="Street, building, area" placeholderTextColor={colors.textMuted} />

                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>City</Text>
                      <TextInput testID="addr-city-input" style={styles.fieldInput} value={editAddr.city} onChangeText={(t) => setEditAddr({ ...editAddr, city: t })} placeholder="City" placeholderTextColor={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>State</Text>
                      <TextInput testID="addr-state-input" style={styles.fieldInput} value={editAddr.state} onChangeText={(t) => setEditAddr({ ...editAddr, state: t })} placeholder="State" placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Pincode</Text>
                      <TextInput testID="addr-pincode-input" style={styles.fieldInput} value={editAddr.pincode} onChangeText={(t) => setEditAddr({ ...editAddr, pincode: t })} placeholder="Pincode" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Phone</Text>
                      <TextInput testID="addr-phone-input" style={styles.fieldInput} value={editAddr.phone} onChangeText={(t) => setEditAddr({ ...editAddr, phone: t })} placeholder="Phone" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                    </View>
                  </View>

                  <TouchableOpacity testID="save-address-btn" style={styles.saveAddrBtn} onPress={saveAddress} activeOpacity={0.7}>
                    <Text style={styles.saveAddrBtnText}>Save Address</Text>
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
  // Logout Modal
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
  // Address Modal
  addrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  addrModalWrap: { maxHeight: '90%' },
  addrModalBox: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: '100%' },
  addrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addrModalTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  addrSection: { marginBottom: spacing.lg },
  addrSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: spacing.sm },
  savedAddr: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
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
