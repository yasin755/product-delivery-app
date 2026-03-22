import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, spacing, radii, shadows } from '../../src/theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cats, prods] = await Promise.all([
          api('/api/categories'),
          api(`/api/products?category_id=${id}&limit=50`),
        ]);
        const cat = cats.find((c: any) => c.id === id);
        setCategory(cat);
        setProducts(prods.products || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="category-back-btn" style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{category?.name || 'Category'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {products.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="basket-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No products in this category</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`category-product-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/product/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardImgWrap}>
                <Image source={{ uri: item.image }} style={styles.cardImg} />
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardWeight}>{item.weight}</Text>
              <View style={styles.cardBottom}>
                <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
                <View style={styles.cardAdd}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
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
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textMain },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 16, color: colors.textMuted },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, marginBottom: spacing.md, ...shadows.sm },
  cardImgWrap: { width: '100%', aspectRatio: 1, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginBottom: spacing.sm },
  cardImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardName: { fontSize: 14, fontWeight: '600', color: colors.textMain },
  cardWeight: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  cardPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  cardAdd: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
});
