import { useCallback, useContext } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { fetchMyClaims } from "../api/client";
import { CLAIM_STATUS, claimStage } from "../claimStatus";
import ErrorRetry from "../components/ErrorRetry";
import { postedAt } from "../components/ItemCard";
import { useFocusList } from "../hooks";
import { colors, spacing, type, ui } from "../theme";

// Where each of your claims is up to, latest change first (reloaded every time the
// screen is shown). Tap one to open the item.
export default function NotificationsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { list: claims, loading, error, failed, reload } = useFocusList(
    useCallback(() => fetchMyClaims(user.token), [user.token]),
  );

  if (loading) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={claims}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={failed ? <ErrorRetry message={error} onRetry={reload} /> : null}
      ListEmptyComponent={
        failed ? null : (
          <Text style={styles.empty}>
            {user.role === "guest"
              ? "Log in with your school email to claim items and follow them here."
              : "No updates yet. When you claim an item, its progress shows up here."}
          </Text>
        )
      }
      renderItem={({ item }) => {
        const { headline, next, color, text } = CLAIM_STATUS[claimStage(item.myClaim, item.status)];
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => navigation.navigate("ItemDetail", item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${headline}`}
          >
            <Text style={[styles.headline, { backgroundColor: color, color: text }]}>{headline}</Text>
            <Text style={type.heading}>{item.title}</Text>
            <Text style={type.body}>{next}</Text>
            <Text style={styles.when}>{postedAt(item.updatedAt)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  list: { padding: spacing.md, flexGrow: 1 },
  center: { marginTop: spacing.xl },
  card: { ...ui.card, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
  pressed: { opacity: 0.85 },
  // Same highlighted headline as on the item screen.
  headline: {
    ...type.body,
    fontWeight: "700",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  when: { ...type.meta, marginTop: spacing.xs },
  empty: { ...type.body, color: colors.slate, textAlign: "center", marginTop: spacing.xl },
});
