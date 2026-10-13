// Main screen: searchable, filterable list of found items with a post button.
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchItems, fetchOptions } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import CategoryChips from "../components/CategoryChips";
import ItemCard from "../components/ItemCard";
import PostButton from "../components/PostButton";
import SearchBar from "../components/SearchBar";
import { colors, spacing, type } from "../theme";

// Changes only after `value` has stopped changing for `ms`, so the server
// isn't asked a question on every keystroke.
function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function HomeScreen({ navigation }) {
  const { logout } = useContext(AuthContext);

  // items: what's shown; hasMore: the server has older ones; loading: first load;
  // loadingMore / refreshing: next page / pull-to-refresh; error: message to show;
  // query/category: current filters; categories: "All" plus the server's list.
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState(["All"]);
  const search = useDebounced(query.trim(), 300);
  // Numbers each first-page request, so a slow reply to an old search can't
  // overwrite the results of a newer one.
  const latest = useRef(0);

  // The newest page for the current search and category, replacing what's shown.
  // The server does the searching, so it covers every item, not just the loaded ones.
  const loadFirst = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const page = await fetchItems({ q: search, category });
      if (mine !== latest.current) return;
      setItems(page.items);
      setHasMore(page.hasMore);
      setError(null);
    } catch (e) {
      if (mine === latest.current) setError(e.message);
    }
  }, [search, category]);

  // The filter chips. The list still works if this fails (only "All" shows).
  const loadCategories = () =>
    fetchOptions()
      .then((o) => setCategories(["All", ...o.categories]))
      .catch(() => {});
  useEffect(() => {
    loadCategories();
  }, []);

  // Load when the screen opens, when the search or category changes, and when
  // coming back to it (e.g. after posting).
  useFocusEffect(
    useCallback(() => {
      loadFirst().finally(() => setLoading(false));
    }, [loadFirst]),
  );

  // The next older page, when the list is scrolled near the end.
  async function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    const mine = latest.current;
    setLoadingMore(true);
    try {
      const page = await fetchItems({ q: search, category, before: items[items.length - 1].id });
      if (mine !== latest.current) return; // the search changed while this was loading
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  // Pull-to-refresh handler.
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFirst(), loadCategories()]);
    setRefreshing(false);
  };

  // Scrolls with the list: title, search box and category chips.
  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>Campus Claim</Text>

        <View style={styles.links}>
          <Pressable onPress={() => navigation.navigate("MyListings")}>
            <Text style={styles.logout}>My posts</Text>
          </Pressable>
          <Pressable onPress={logout}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.title}>Lost something?</Text>
      <Text style={type.meta}>
        Find it below and answer the finder's question to claim it.
      </Text>
      <SearchBar value={query} onChangeText={setQuery} />
      <CategoryChips
        categories={categories}
        selected={category}
        onSelect={setCategory}
      />
      {/* A failed refresh while items are on screen: say so instead of failing silently. */}
      {error && items.length ? (
        <Text style={styles.banner}>{error}. Pull down to try again.</Text>
      ) : null}
    </View>
  );

  // What to show when the list has no rows: spinner, error, or no matches.
  let empty = null;
  if (loading)
    empty = <ActivityIndicator style={styles.center} color={colors.teal} />;
  else if (error)
    empty = (
      <Text style={[type.body, styles.center]}>
        {error}. Pull down to try again.
      </Text>
    );
  else
    empty = (
      <Text style={[type.body, styles.center]}>
        No items match. Try a different word or category.
      </Text>
    );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() =>
              navigation.navigate("ItemDetail", {
                id: item.id,
                title: item.title,
              })
            }
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.more} color={colors.teal} /> : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
      <PostButton onPress={() => navigation.navigate("PostItem")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  list: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  brand: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.teal,
  },
  title: { ...type.title, marginBottom: spacing.xs },
  center: { marginTop: spacing.xl, textAlign: "center", color: colors.slate },
  more: { marginVertical: spacing.md },
  banner: { color: "#B00020", marginTop: spacing.md },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },

  links: { flexDirection: "row", gap: spacing.md },
  logout: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.teal,
  },
});
