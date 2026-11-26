import { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchRestrictedUsers, unlockUser, unsuspendUser } from '../api/client';
import { postedAt } from '../components/ItemCard';
import { useConfirm, useFocusList } from '../hooks';
import ErrorRetry from '../components/ErrorRetry';
import { colors, spacing, type, ui } from '../theme';

// Campus Security only: people who are locked out of claiming (3 rejected claims) or
// suspended. A locked-out person can't make claims, so they never appear in Review
// claims; this is where staff find them after checking their proof at the desk.
// Suspending is done from a claim (ClaimDetailScreen). Each button needs a second tap.
export default function AccountsScreen() {
  const { user } = useContext(AuthContext);
  const { list: users, setList: setUsers, loading, error, setError, failed, reload } = useFocusList(
    useCallback(() => fetchRestrictedUsers(user.token), [user.token])
  );
  const [confirm, setConfirm] = useConfirm(); // "<user id>:<action>" waiting for a second tap
  const [busyId, setBusyId] = useState(null);

  async function act(person, action) {
    if (confirm !== `${person.id}:${action}`) return setConfirm(`${person.id}:${action}`);
    setError('');
    setBusyId(person.id);
    try {
      if (action === 'unlock') await unlockUser(person.id, user.token);
      else await unsuspendUser(person.id, user.token);
      const changed = action === 'unlock' ? { locked: false } : { suspendedAt: null };
      // Once neither locked nor suspended, they drop off the list.
      setUsers((list) =>
        list
          .map((u) => (u.id === person.id ? { ...u, ...changed } : u))
          .filter((u) => u.locked || u.suspendedAt)
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const button = (person, action, label) => {
    const armed = confirm === `${person.id}:${action}`;
    return (
      <Pressable
        style={[ui.action, { borderColor: colors.accent }, armed && { backgroundColor: colors.accent }]}
        onPress={() => act(person, action)}
        disabled={busyId === person.id}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${person.email ?? 'guest'}`}
      >
        <Text style={[ui.actionText, { color: armed ? colors.onAccent : colors.accent }]}>
          {armed ? 'Tap again' : label}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={users}
      keyExtractor={(u) => String(u.id)}
      ListHeaderComponent={
        failed ? <ErrorRetry message={error} onRetry={reload} /> : error ? <Text style={styles.error}>{error}</Text> : null
      }
      ListEmptyComponent={
        error ? null : <Text style={[type.body, styles.empty]}>Nobody is locked out or suspended.</Text>
      }
      renderItem={({ item: person }) => (
        <View style={styles.card}>
          <Text style={type.heading}>{person.email ?? `Guest #${person.id}`}</Text>
          {person.suspendedAt ? (
            <Text style={styles.warn}>Suspended on {postedAt(person.suspendedAt)}{person.suspendedBy ? ` by ${person.suspendedBy}` : ''}</Text>
          ) : null}
          {person.locked ? (
            <Text style={styles.warn}>Locked out: {person.rejected} claims rejected</Text>
          ) : null}
          <View style={ui.actions}>
            {person.locked ? button(person, 'unlock', 'Unlock claiming') : null}
            {person.suspendedAt ? button(person, 'unsuspend', 'Unsuspend') : null}
          </View>
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
  warn: { ...type.body, color: colors.danger, fontWeight: '600' },
});
