import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Image,
  ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

const UNIT_OPTIONS = ['piece', 'kg', 'pack', 'can', 'bottle', 'jar', 'bag', 'loaf', 'carton', 'box', 'tube', 'bunch'];

const emptyForm = {
  name: '',
  description: '',
  price: '',
  category_id: '',
  image: '',
  unit: 'piece',
  stock: '100',
  weight: '',
};

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchProducts() {
    try {
      const data = await api('/api/products?limit=100');
      setProducts(data.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchCategories() {
    try {
      const data = await api('/api/categories');
      setCategories(data || []);
    } catch (e) { console.error(e); }
  }

  function openAddProduct() {
    setEditingProductId(null);
    setForm({ ...emptyForm, category_id: categories.length > 0 ? categories[0].id : '' });
    setShowFormModal(true);
  }

  function openEditProduct(product: any) {
    setEditingProductId(product.id);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      category_id: product.category_id || '',
      image: product.image || '',
      unit: product.unit || 'piece',
      stock: String(product.stock ?? 100),
      weight: product.weight || '',
    });
    setShowFormModal(true);
  }

  function confirmDelete(product: any) {
    setDeleteTarget(product);
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      setProducts(products.filter(p => p.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Product name is required.');
      return;
    }
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price.');
      return;
    }
    if (!form.category_id) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      category_id: form.category_id,
      image: form.image.trim(),
      unit: form.unit,
      stock: parseInt(form.stock) || 0,
      weight: form.weight.trim(),
    };

    try {
      if (editingProductId) {
        await api(`/api/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowFormModal(false);
      setEditingProductId(null);
      setForm({ ...emptyForm });
      setLoading(true);
      await fetchProducts();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save product');
    }
    setSaving(false);
  }

  function getCategoryName(categoryId: string) {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Unknown';
  }

  const filteredProducts = searchQuery.trim()
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  // iOS needs presentationStyle for transparent modals
  const modalProps = Platform.OS === 'ios'
    ? { presentationStyle: 'overFullScreen' as const }
    : {};

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="admin-products-back-btn"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>Products ({products.length})</Text>
        <Pressable
          testID="admin-add-product-btn"
          onPress={openAddProduct}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="admin-product-search"
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching products' : 'No products yet'}
            </Text>
            {!searchQuery && (
              <Pressable style={styles.emptyBtn} onPress={openAddProduct}>
                <Text style={styles.emptyBtnText}>Add First Product</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`admin-product-${item.id}`} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.cardImg} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardCategory}>
                {getCategoryName(item.category_id)} · {item.unit} · Stock: {item.stock}
              </Text>
              <Text style={styles.cardPrice}>₹{item.price?.toFixed(2)}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                testID={`admin-edit-product-${item.id}`}
                style={({ pressed }) => [
                  styles.cardActionBtn,
                  pressed && { opacity: 0.6, backgroundColor: colors.primaryLight },
                ]}
                onPress={() => openEditProduct(item)}
                hitSlop={6}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                testID={`admin-delete-product-${item.id}`}
                style={({ pressed }) => [
                  styles.cardActionBtn,
                  pressed && { opacity: 0.6, backgroundColor: '#FEE2E2' },
                ]}
                onPress={() => confirmDelete(item)}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Floating Add Button */}
      <Pressable
        testID="admin-fab-add-product"
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
        ]}
        onPress={openAddProduct}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add/Edit Product Modal */}
      <Modal
        visible={showFormModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFormModal(false)}
        {...modalProps}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrap}
          >
            <View style={styles.modalBox}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingProductId ? 'Edit Product' : 'Add New Product'}
                </Text>
                <Pressable
                  testID="close-product-modal"
                  onPress={() => { setShowFormModal(false); setEditingProductId(null); }}
                  hitSlop={10}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={24} color={colors.textMain} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Name */}
                <Text style={styles.fieldLabel}>Product Name *</Text>
                <TextInput
                  testID="product-name-input"
                  style={styles.fieldInput}
                  value={form.name}
                  onChangeText={(t) => setForm({ ...form, name: t })}
                  placeholder="e.g. Basmati Rice 5kg"
                  placeholderTextColor={colors.textMuted}
                />

                {/* Description */}
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  testID="product-desc-input"
                  style={[styles.fieldInput, styles.multiline]}
                  value={form.description}
                  onChangeText={(t) => setForm({ ...form, description: t })}
                  placeholder="Product description..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Price & Stock */}
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Price (₹) *</Text>
                    <TextInput
                      testID="product-price-input"
                      style={styles.fieldInput}
                      value={form.price}
                      onChangeText={(t) => setForm({ ...form, price: t })}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Stock</Text>
                    <TextInput
                      testID="product-stock-input"
                      style={styles.fieldInput}
                      value={form.stock}
                      onChangeText={(t) => setForm({ ...form, stock: t })}
                      placeholder="100"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                {/* Category Picker */}
                <Text style={styles.fieldLabel}>Category *</Text>
                <Pressable
                  testID="product-category-picker"
                  style={({ pressed }) => [
                    styles.pickerBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={[styles.pickerBtnText, !form.category_id && { color: colors.textMuted }]}>
                    {form.category_id ? getCategoryName(form.category_id) : 'Select category'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </Pressable>

                {/* Unit & Weight */}
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Unit</Text>
                    <Pressable
                      testID="product-unit-picker"
                      style={({ pressed }) => [
                        styles.pickerBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setShowUnitPicker(true)}
                    >
                      <Text style={styles.pickerBtnText}>{form.unit}</Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <TextInput
                      testID="product-weight-input"
                      style={styles.fieldInput}
                      value={form.weight}
                      onChangeText={(t) => setForm({ ...form, weight: t })}
                      placeholder="e.g. 500g, 1L"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                {/* Image URL */}
                <Text style={styles.fieldLabel}>Image URL</Text>
                <TextInput
                  testID="product-image-input"
                  style={styles.fieldInput}
                  value={form.image}
                  onChangeText={(t) => setForm({ ...form, image: t })}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />

                {/* Image Preview */}
                {form.image.trim().length > 0 && (
                  <View style={styles.imagePreviewWrap}>
                    <Image
                      source={{ uri: form.image }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Save Button */}
                <Pressable
                  testID="save-product-btn"
                  style={({ pressed }) => [
                    styles.saveBtn,
                    saving && { opacity: 0.6 },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingProductId ? 'Update Product' : 'Add Product'}
                    </Text>
                  )}
                </Pressable>

                <View style={{ height: spacing.xxl }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
        {...modalProps}
      >
        <Pressable style={styles.deleteOverlay} onPress={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
          <Pressable style={styles.deleteBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={32} color={colors.error} />
            </View>
            <Text style={styles.deleteTitle}>Delete Product</Text>
            <Text style={styles.deleteSubtitle}>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <Pressable
                testID="cancel-delete-btn"
                style={({ pressed }) => [styles.deleteCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="confirm-delete-btn"
                style={({ pressed }) => [styles.deleteConfirmBtn, pressed && { opacity: 0.7 }]}
                onPress={handleDelete}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitPicker(false)}
        {...modalProps}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowUnitPicker(false)}>
          <Pressable style={styles.pickerBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Unit</Text>
              <Pressable onPress={() => setShowUnitPicker(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textMain} />
              </Pressable>
            </View>
            <ScrollView bounces={false}>
              {UNIT_OPTIONS.map((unit) => (
                <Pressable
                  key={unit}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    form.unit === unit && styles.pickerOptionActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => { setForm({ ...form, unit }); setShowUnitPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, form.unit === unit && styles.pickerOptionTextActive]}>
                    {unit}
                  </Text>
                  {form.unit === unit && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
        {...modalProps}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowCategoryPicker(false)}>
          <Pressable style={styles.pickerBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              <Pressable onPress={() => setShowCategoryPicker(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textMain} />
              </Pressable>
            </View>
            <ScrollView bounces={false}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    form.category_id === cat.id && styles.pickerOptionActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => { setForm({ ...form, category_id: cat.id }); setShowCategoryPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, form.category_id === cat.id && styles.pickerOptionTextActive]}>
                    {cat.name}
                  </Text>
                  {form.category_id === cat.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  headerBtn: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  closeBtn: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textMain },
  // List
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radii.md,
    padding: spacing.sm, marginBottom: spacing.sm, ...shadows.sm,
  },
  cardImg: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  cardCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  cardActionBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },
  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    zIndex: 999, elevation: 8,
    ...shadows.md,
  },
  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: spacing.md },
  emptyBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Form Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: spacing.lg, paddingHorizontal: spacing.md },
  modalWrap: { flex: 1, width: '100%', maxHeight: '85%' },
  modalBox: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMain, marginBottom: 4, marginTop: spacing.md },
  fieldInput: {
    backgroundColor: colors.surfaceAlt, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, height: 48, fontSize: 15, color: colors.textMain,
  },
  multiline: { height: 90, paddingTop: spacing.sm },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  // Picker button
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, height: 48,
  },
  pickerBtnText: { fontSize: 15, color: colors.textMain, textTransform: 'capitalize' },
  // Image Preview
  imagePreviewWrap: { marginTop: spacing.sm, borderRadius: radii.md, overflow: 'hidden' },
  imagePreview: { width: '100%', height: 150, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  // Save
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radii.pill,
    height: 52, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Delete Modal
  deleteOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl,
  },
  deleteBox: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.xl, width: '100%', maxWidth: 340, alignItems: 'center',
  },
  deleteIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  deleteTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  deleteSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  deleteActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, width: '100%' },
  deleteCancelBtn: {
    flex: 1, height: 48, borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },
  deleteCancelText: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  deleteConfirmBtn: {
    flex: 1, height: 48, borderRadius: radii.pill,
    backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center',
  },
  deleteConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  // Picker Modals
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg,
  },
  pickerBox: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.lg, width: '100%', maxWidth: 340, maxHeight: 400,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerOptionActive: { backgroundColor: colors.primaryLight, borderRadius: radii.sm },
  pickerOptionText: { fontSize: 15, color: colors.textMain, textTransform: 'capitalize' },
  pickerOptionTextActive: { fontWeight: '600', color: colors.primary },
});
