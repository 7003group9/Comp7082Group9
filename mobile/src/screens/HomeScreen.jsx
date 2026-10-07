// Main screen: searchable, filterable list of found items with a post button.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchItems } from '../api/client';
import { categories } from '../data/mockItems';
import CategoryChips from '../components/CategoryChips';
import ItemCard from '../components/ItemCard';
import PostButton from '../components/PostButton';
import SearchBar from '../components/SearchBar';
import { colors, spacing, type } from '../theme';

export default function HomeScreen({ navigation }) {
  // items: loaded list; loading: first load; refreshing: pull-to-refresh;
  // error: message to show; query/category: current filters.
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  // Fetch items and store them (or the error message).
  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await fetchItems());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Load once when the screen opens.
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Pull-to-refresh handler.
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Apply the search text (title or location) and category filter.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === 'All' || i.category === category) &&
        (!q || i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q))
    );
  }, [items, query, category]);

  // Scrolls with the list: title, search box and category chips.
  const header = (
    <View style={styles.header}>
      <Text style={styles.brand}>Campus Claim</Text>
      <Text style={styles.title}>Lost something?</Text>
      <Text style={type.meta}>Find it below and answer the finder's question to claim it.</Text>
      <SearchBar value={query} onChangeText={setQuery} />
      <CategoryChips categories={categories} selected={category} onSelect={setCategory} />
    </View>
  );

  // What to show when the list has no rows: spinner, error, or no matches.
  let empty = null;
  if (loading) empty = <ActivityIndicator style={styles.center} color={colors.teal} />;
  else if (error) empty = <Text style={[type.body, styles.center]}>{error}. Pull down to try again.</Text>;
  else empty = <Text style={[type.body, styles.center]}>No items match. Try a different word or category.</Text>;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={() => navigation.navigate('ItemDetail', { id: item.id, title: item.title })} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
        keyboardShouldPersistTaps="handled"
      />
      <PostButton onPress={() => navigation.navigate('PostItem')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  list: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  brand: { fontSize: 16, fontWeight: '700', color: colors.teal, marginBottom: spacing.sm },
  title: { ...type.title, marginBottom: spacing.xs },
  center: { marginTop: spacing.xl, textAlign: 'center', color: colors.slate },
});
