// Main screen: searchable, filterable list of found items with a post button.
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchItems, fetchOptions } from "../api/client";
import { AuthContext } from "../context/AuthContext";
import ItemCard from "../components/ItemCard";
import PostButton from "../components/PostButton";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import { colors, spacing, type, ui } from "../theme";

// Filled bell (Material "notifications" icon) in the button text colour. The 🕭
// character was too thin next to the text buttons. Built after theme.js has picked
// the colours, so security users get theirs too.
const bellIcon = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors.onAccent}"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`,
)}`;

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
  const { user, logout } = useContext(AuthContext);

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
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState(["All"]);
  const [buildings, setBuildings] = useState([]);
  const search = useDebounced(query.trim(), 300);
  // Numbers each first-page request, so a slow reply to an old search can't
  // overwrite the results of a newer one.
  const latest = useRef(0);

  // The newest page for the current search and category, replacing what's shown.
  // The server does the searching, so it covers every item, not just the loaded ones.
  const validDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : "";

  const validDateTo = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : "";
  const loadFirst = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const page = await fetchItems(
        {
          q: search,
          category,
          location: location.trim(),
          dateFrom: validDateFrom,
          dateTo: validDateTo,
        },
        user.token,
      );
      if (mine !== latest.current) return;
      setItems(page.items);
      setHasMore(page.hasMore);
      setError(null);
    } catch (e) {
      if (mine === latest.current) setError(e.message);
    }
  }, [search, category, location, validDateFrom, validDateTo, user.token]);

  // The filter chips. The list still works if this fails (only "All" shows).
  const loadCategories = () =>
    fetchOptions()
      .then((o) => {
        setCategories(["All", ...o.categories]);
        setBuildings(o.buildings ?? []);
      })
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
      const page = await fetchItems(
        {
          q: search,
          category,
          location: location.trim(),
          dateFrom: validDateFrom,
          dateTo: validDateTo,
          before: items[items.length - 1].id,
        },
        user.token,
      );
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
  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setLocation("");
    setDateFrom("");
    setDateTo("");
  };

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
          <Pressable
            style={pressable}
            onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Image source={{ uri: bellIcon }} style={styles.bell} />
          </Pressable>
          {user.role === "security" ? (
            <Pressable
              style={pressable}
              onPress={() => navigation.navigate("SecurityDashboard")}
              accessibilityRole="button"
            >
              <Text style={ui.smallButtonText}>Review claims</Text>
            </Pressable>
          ) : null}
          {user.role !== "guest" ? (
            <Pressable
              style={pressable}
              onPress={() => navigation.navigate("MyListings")}
              accessibilityRole="button"
            >
              <Text style={ui.smallButtonText}>My posts</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={pressable}
            onPress={logout}
            accessibilityRole="button"
          >
            <Text style={ui.smallButtonText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.title}>Lost something?</Text>
      <Text style={type.meta}>
        Find it below and answer the finder's question to claim it.
      </Text>
      <SearchBar value={query} onChangeText={setQuery} />

      <Pressable
        style={styles.filterButton}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Text style={styles.filterButtonText}>
          {showFilters ? "Hide filters ▲" : "Filters ▼"}
        </Text>
      </Pressable>

      {showFilters ? (
        <FilterPanel
          categories={categories}
          category={category}
          setCategory={setCategory}
          location={location}
          setLocation={setLocation}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          buildings={buildings}
        />
      ) : null}
      {/* A failed refresh while items are on screen: say so instead of failing silently. */}
      {error && items.length ? (
        <Text style={styles.banner}>{error}. Pull down to try again.</Text>
      ) : null}
    </View>
  );

  // What to show when the list has no rows: spinner, error, or no matches.
  let empty = null;
  if (loading)
    empty = <ActivityIndicator style={styles.center} color={colors.accent} />;
  else if (error)
    empty = (
      <Text style={[type.body, styles.center]}>
        {error}. Pull down to try again.
      </Text>
    );
  else
    empty = (
      <View style={styles.center}>
        <Text style={type.body}>
          No items match. Try a different word or category.
        </Text>
        {/* Only when there's something to clear, and not twice: the open panel has its own. */}
        {!showFilters && (query || category !== "All" || location || dateFrom || dateTo) ? (
          <Pressable onPress={clearFilters} style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    );
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => navigation.navigate("ItemDetail", item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.more} color={colors.accent} />
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      />
      {user.role !== "guest" ? (
        <PostButton onPress={() => navigation.navigate("PostItem")} />
      ) : null}
    </SafeAreaView>
  );
}

// Small header buttons, darker while pressed.
const pressable = ({ pressed }) => [ui.smallButton, pressed && ui.pressed];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  list: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  brand: {
    fontSize: 22, // between body text (16) and the "Lost something?" title (30)
    fontWeight: "700",
    color: colors.accent,
  },
  title: { ...type.title, marginBottom: spacing.xs },
  center: { marginTop: spacing.xl, textAlign: "center", color: colors.slate },
  more: { marginVertical: spacing.md },
  banner: { color: colors.danger, marginTop: spacing.md },
  // Title on its own line, buttons underneath, so they don't crowd each other.
  topRow: {
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  // Right-aligned under the title; wraps on narrow phones (still right-aligned).
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", alignSelf: "stretch", gap: spacing.sm },
  bell: { width: 18, height: 18 }, // about the height of the other buttons' text
  filterButton: {
    marginTop: spacing.md,
    padding: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: "center",
  },
  filterButtonText: {
    color: colors.onAccent,
    fontWeight: "600",
    fontSize: 14,
  },
});
