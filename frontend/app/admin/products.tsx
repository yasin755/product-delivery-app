import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    try {
      const data = await api('/api/products?limit=100');
      setProducts(data.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function deleteProduct(pid: string) {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api(`/api/products/${pid}`, { method: 'DELETE' });
          setProducts(products.filter(p => p.id !== pid));
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="admin-products-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Products ({products.length})</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View testID={`admin-product-${item.id}`} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.cardImg} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardCategory}>{item.unit} - Stock: {item.stock}</Text>
              <Text style={styles.cardPrice}>₹{item.price.toFixed(2)}</Text>
            </View>
            <TouchableOpacity testID={`admin-delete-product-${item.id}`} onPress={() => deleteProduct(item.id)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm, ...shadows.sm },
  cardImg: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  cardInfo: { flex: 1, marginLeft: spacing.md },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  cardCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: 2 },
});
