import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchProducts();
      } else if (query.trim().length === 0) {
        setProducts([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function searchProducts() {
    setLoading(true);
    try {
      const data = await api(`/api/products?search=${encodeURIComponent(query.trim())}&limit=20`);
      setProducts(data.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search for products..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity testID="search-clear-btn" onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color={colors.primary} />}

      {!loading && products.length === 0 && query.length >= 2 && (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      )}

      {!loading && products.length === 0 && query.length < 2 && (
        <View style={styles.empty}>
          <Ionicons name="basket-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>Search for your favorite products</Text>
        </View>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`search-result-${item.id}`}
            style={styles.resultCard}
            onPress={() => router.push(`/product/${item.id}`)}
            activeOpacity={0.7}
          >
            <Image source={{ uri: item.image }} style={styles.resultImg} />
            <View style={styles.resultInfo}>
              <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.resultWeight}>{item.weight}</Text>
              <Text style={styles.resultPrice}>₹{item.price.toFixed(2)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.md, height: 48, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 16, color: colors.textMain },
  loader: { marginTop: spacing.xl },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: spacing.md },
  emptyText: { fontSize: 16, color: colors.textMuted },
  list: { paddingHorizontal: spacing.md },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm, ...shadows.sm },
  resultImg: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt },
  resultInfo: { flex: 1, marginLeft: spacing.md },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  resultWeight: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  resultPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: 2 },
});
