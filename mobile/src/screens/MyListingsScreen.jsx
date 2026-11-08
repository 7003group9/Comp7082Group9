import { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";
import { deleteItem, fetchMyItems } from "../api/client";
import { age } from "../components/ItemCard";
import StatusLabel from "../components/StatusLabel";
import { colors, spacing, type } from "../theme";

// The items I posted, each with a delete button. Claims on them are reviewed by
// Campus Security, not the finder.
export default function MyListingsScreen({ navigation }) {
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
            <Text style={type.meta}>{[item.building, item.location].filter(Boolean).join(" · ")}</Text>
            <Text style={type.meta}>Posted {age(item.postedAt).join(" ").trim().replace(/^Now$/, "just now")}</Text>
            <StatusLabel item={item} mine />
            {item.status === "claimed" ? (
              <Text style={styles.dropOff}>
                The owner has been confirmed. Please drop this item off at the Campus Security desk as soon as possible.
              </Text>
            ) : null}
            {item.status === "dropped off" ? (
              <Text style={styles.dropOff}>Thanks! Campus Security has it now.</Text>
            ) : null}
          </View>
          {item.status === "open" ? (
            <Pressable
              onPress={() => navigation.navigate("PostItem", { editId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.title}`}
            >
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          ) : null}
          {/* Only open posts can be deleted: once claimed, the claim history has to stay. */}
          {item.status === "open" ? (
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
          ) : null}
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
  dropOff: { ...type.meta, color: colors.ink, fontWeight: "600", marginTop: spacing.sm },
  edit: { color: colors.teal, fontWeight: "600" },
  delete: { color: "#B00020", fontWeight: "600" },
  deleteConfirm: { fontWeight: "700", textDecorationLine: "underline" },
});
