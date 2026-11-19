
import { FlatList, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type, ui } from "../theme";

export default function NotificationsScreen() {
  // The backend does not provide notifications yet.
  const notifications = [];

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={type.heading}>{item.title}</Text>
          <Text style={type.body}>{item.message}</Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No notifications yet.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  list: {
    padding: spacing.md,
    flexGrow: 1,
  },
  card: {
    ...ui.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: {
    ...type.body,
    color: colors.slate,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
