import { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchHistory, setItemStatus, unhidePost } from '../api/client';
import { postedAt, where } from '../components/ItemCard';
import StatusLabel from '../components/StatusLabel';
import { useConfirm, useFocusList } from '../hooks';
import ErrorRetry from '../components/ErrorRetry';
import { colors, spacing, type, ui } from '../theme';

// What each status can be changed to by hand, and what the option says. Same rules as
// STATUS_CHANGES on the server (which checks them again).
const STATUS_OPTIONS = {
  claimed: [['dropped off', 'Received at the security desk']],
  'dropped off': [
    ['handed off', 'Picked up by owner'],
    ['claimed', 'Not received yet (undo)'],
  ],
};

// Campus Security only: every post, newest first, with who found it and, once
// collected, who picked it up, when, and which staff member handed it over.
// Items waiting on the desk have a status dropdown, and hidden posts an Unhide button
// (which also reopens the claims hiding closed); each needs a second tap.
export default function HistoryScreen() {
  const { user } = useContext(AuthContext);
  const load = useCallback(() => fetchHistory(user.token), [user.token]);
  const { list: items, setList: setItems, loading, error, setError, failed, reload } = useFocusList(load);
  const [openId, setOpenId] = useState(null); // the item whose dropdown is open
  const [confirm, setConfirm] = useConfirm(); // "<item id>:<status>" waiting for a second tap
  const [busyId, setBusyId] = useState(null);

  // status: a new status from STATUS_OPTIONS, or 'unhide'.
  async function choose(item, status) {
    if (confirm !== `${item.id}:${status}`) return setConfirm(`${item.id}:${status}`);
    setError('');
    setBusyId(item.id);
    try {
      if (status === 'unhide') await unhidePost(item.id, user.token);
      else await setItemStatus(item.id, status, user.token);
      setItems(await load()); // reload, so pick-up details show up too
      setOpenId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={
        failed ? <ErrorRetry message={error} onRetry={reload} /> : error ? <Text style={styles.error}>{error}</Text> : null
      }
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
          {item.hidden ? (
            <Pressable
              style={[styles.option, confirm === `${item.id}:unhide` && styles.armed]}
              onPress={() => choose(item, 'unhide')}
              disabled={busyId === item.id}
              accessibilityRole="button"
              accessibilityLabel={`Unhide ${item.title}`}
            >
              <Text style={[type.body, confirm === `${item.id}:unhide` && styles.armedText]}>
                {confirm === `${item.id}:unhide` ? 'Tap again to unhide' : 'Unhide post (reopens its claims)'}
              </Text>
            </Pressable>
          ) : null}
          {STATUS_OPTIONS[item.status] ? (
            <>
              <Pressable
                onPress={() => setOpenId(openId === item.id ? null : item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Change status of ${item.title}`}
              >
                <Text style={styles.change}>Change status {openId === item.id ? '▴' : '▾'}</Text>
              </Pressable>
              {openId === item.id
                ? STATUS_OPTIONS[item.status].map(([status, label]) => {
                    const armed = confirm === `${item.id}:${status}`;
                    return (
                      <Pressable
                        key={status}
                        style={[styles.option, armed && styles.armed]}
                        onPress={() => choose(item, status)}
                        disabled={busyId === item.id}
                        accessibilityRole="button"
                      >
                        <Text style={[type.body, armed && styles.armedText]}>{armed ? 'Tap again to confirm' : label}</Text>
                      </Pressable>
                    );
                  })
                : null}
            </>
          ) : null}
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
  change: { color: colors.accent, fontWeight: '600', marginTop: spacing.sm },
  option: { borderWidth: 2, borderColor: colors.accent, borderRadius: 8, padding: spacing.sm, marginTop: spacing.xs },
  armed: { backgroundColor: colors.accent },
  armedText: { color: colors.onAccent, fontWeight: '700' },
});
