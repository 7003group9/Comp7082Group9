import { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";
import { deleteItem, fetchMyItems } from "../api/client";
import { colors, spacing, type } from "../theme";

// The items I posted, each with a delete button.
// TODO: also show incoming claims to review.
export default function MyListingsScreen() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null); // item waiting for a second tap
  const [deletingId, setDeletingId] = useState(null);

  // Reload whenever the screen is shown.
  useFocusEffect(
    useCallback(() => {
      setError("");
      fetchMyItems(user.token)
        .then(setItems)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, [user.token]),
  );

  // An armed "Tap again to confirm" lapses after a few seconds, so a stray tap
  // much later can't delete a post.
  useEffect(() => {
    if (confirmId === null) return;
    const timer = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  // First tap asks "sure?", second tap deletes (works the same on web and phone).
  async function onDelete(id) {
    if (confirmId !== id) return setConfirmId(id);
    setError("");
    setDeletingId(id);
    try {
      await deleteItem(id, user.token);
      setItems((list) => list.filter((i) => i.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={colors.teal} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      // After a failed load the error above says what happened; "no posts" would be untrue.
      ListEmptyComponent={error ? null : <Text style={[type.body, styles.empty]}>You haven't posted anything yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.info}>
            <Text style={type.heading}>{item.title}</Text>
            <Text style={type.meta}>{item.location}</Text>
            <Text style={type.meta}>
              No. {item.id} · {item.isSensitive ? "With Campus Security" : item.status}
            </Text>
          </View>
          <Pressable
            onPress={() => onDelete(item.id)}
            disabled={deletingId === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.title}`}
          >
            <Text style={[styles.delete, confirmId === item.id && styles.deleteConfirm]}>
              {confirmId === item.id ? "Tap again to confirm" : "Delete"}
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  list: { padding: spacing.md },
  center: { marginTop: spacing.xl },
  empty: { textAlign: "center", color: colors.slate, marginTop: spacing.xl },
  error: { color: "#B00020", marginBottom: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  info: { flex: 1, gap: 2 },
  delete: { color: "#B00020", fontWeight: "600" },
  deleteConfirm: { fontWeight: "700", textDecorationLine: "underline" },
});
