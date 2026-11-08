import { useCallback, useContext } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchHistory } from '../api/client';
import { postedAt, where } from '../components/ItemCard';
import StatusLabel from '../components/StatusLabel';
import { useFocusList } from '../hooks';
import { colors, spacing, type, ui } from '../theme';

// Campus Security only: every post, newest first, with who found it and, once
// collected, who picked it up, when, and which staff member handed it over.
export default function HistoryScreen() {
  const { user } = useContext(AuthContext);
  const { list: items, loading, error } = useFocusList(useCallback(() => fetchHistory(user.token), [user.token]));

  if (loading) return <ActivityIndicator style={styles.center} color={colors.teal} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={error ? null : <Text style={[type.body, styles.empty]}>Nothing has been posted yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={type.heading}>{item.title}</Text>
          <Text style={type.meta}>{where(item)}</Text>
          <Text style={type.meta}>
            Found by {item.finderEmail} · {postedAt(item.postedAt)}
          </Text>
          {/* Same wording as the finder sees, so 'Dropped off' = waiting at the desk. */}
          <StatusLabel item={item} mine />
          {item.pickedUpAt ? (
            <Text style={styles.pickup}>
              Picked up by {item.pickedUpBy} on {postedAt(item.pickedUpAt)}
              {'\n'}
              <Text style={type.meta}>Handed over by {item.handedOverBy}</Text>
            </Text>
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
  empty: { textAlign: 'center', color: colors.slate, marginTop: spacing.xl },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { ...ui.card, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
  pickup: { ...type.body, fontWeight: '600', marginTop: spacing.sm },
});
