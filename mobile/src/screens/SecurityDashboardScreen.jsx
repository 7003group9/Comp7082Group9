import { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { decideClaim, fetchClaimsToReview, markHandedOff, markReceived } from '../api/client';
import { where } from '../components/ItemCard';
import StatusLabel from '../components/StatusLabel';
import { useConfirm, useFocusList } from '../hooks';
import { colors, spacing, type, ui } from '../theme';

// Campus Security only: pending claims, each answer beside the finder's expected
// one, so staff can compare them and decide. An approved claim stays here until
// the owner picks the item up: staff press "Received at the security desk" when the
// finder hands it in, then "Picked up by owner" when the owner collects it.
// Every button needs a second tap, since each step is final.
export default function SecurityDashboardScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { list: claims, setList: setClaims, loading, error, setError } = useFocusList(
    useCallback(() => fetchClaimsToReview(user.token), [user.token])
  );
  const [confirm, setConfirm] = useConfirm(); // "<claim id>:<decision>" waiting for a second tap
  const [busyId, setBusyId] = useState(null);

  async function onDecide(claim, decision) {
    if (confirm !== `${claim.id}:${decision}`) return setConfirm(`${claim.id}:${decision}`);
    setError('');
    setBusyId(claim.id);
    try {
      if (decision === 'received') {
        await markReceived(claim.itemId, user.token);
        setClaims((list) => list.map((c) => (c.id === claim.id ? { ...c, itemStatus: 'dropped off' } : c)));
      } else if (decision === 'handed') {
        await markHandedOff(claim.itemId, user.token);
        setClaims((list) => list.filter((c) => c.id !== claim.id)); // done with it; it's in Past posts now
      } else {
        await decideClaim(claim.id, decision, user.token);
        // Approving rejects the other claims on that item, so drop them; the approved
        // one stays, waiting for the item to be received. A rejected one goes.
        setClaims((list) =>
          decision === 'approved'
            ? list
                .filter((c) => c.itemId !== claim.itemId || c.id === claim.id)
                .map((c) => (c.id === claim.id ? { ...c, status: 'approved', itemStatus: 'claimed' } : c))
            : list.filter((c) => c.id !== claim.id)
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} color={colors.teal} />;

  const button = (claim, decision, label, color) => {
    const armed = confirm === `${claim.id}:${decision}`;
    return (
      <Pressable
        style={[styles.action, { borderColor: color }, armed && { backgroundColor: color }]}
        onPress={() => onDecide(claim, decision)}
        disabled={busyId === claim.id}
        accessibilityRole="button"
        accessibilityLabel={`${label} claim by ${claim.claimantEmail}`}
      >
        <Text style={[styles.actionText, { color: armed ? colors.onAccent : color }]}>
          {armed ? 'Tap again' : label}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={claims}
      keyExtractor={(c) => String(c.id)}
      ListHeaderComponent={
        <>
          <Pressable
            style={({ pressed }) => [ui.smallButton, styles.history, pressed && ui.pressed]}
            onPress={() => navigation.navigate('History')}
            accessibilityRole="button"
          >
            <Text style={ui.smallButtonText}>Past posts</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
      ListEmptyComponent={error ? null : <Text style={[type.body, styles.empty]}>No claims waiting for review.</Text>}
      renderItem={({ item: claim }) => (
        <View style={styles.card}>
          <Text style={type.heading}>{claim.title}</Text>
          <Text style={type.meta}>{where(claim)}</Text>
          <Text style={[type.meta, styles.gap]}>Claimed by {claim.claimantEmail}</Text>
          <StatusLabel claim={claim.status} />
          <Pressable
            onPress={() => navigation.navigate('ClaimDetail', { claim })}
            accessibilityRole="button"
            accessibilityLabel={`View claim by ${claim.claimantEmail}`}
          >
            <Text style={styles.details}>View details ›</Text>
          </Pressable>

          {claim.answers.map((a, i) => (
            <View key={a.questionId} style={styles.qa}>
              <Text style={styles.question}>{`${i + 1}. ${a.question}`}</Text>
              <Text style={type.body}>Expected: {a.expected}</Text>
              <Text style={type.body}>Answered: {a.answer}</Text>
            </View>
          ))}

          {claim.status === 'approved' ? (
            <>
              {claim.itemStatus === 'dropped off' ? (
                <>
                  <Text style={styles.approved}>At the desk. Waiting for the owner to pick it up.</Text>
                  <View style={styles.actions}>{button(claim, 'handed', '✓ Picked up by owner', colors.teal)}</View>
                </>
              ) : (
                <>
                  <Text style={styles.approved}>Approved. Waiting for the finder to drop it off.</Text>
                  <View style={styles.actions}>{button(claim, 'received', '✓ Received at the security desk', colors.teal)}</View>
                </>
              )}
            </>
          ) : (
            <View style={styles.actions}>
              {button(claim, 'approved', 'Approve', colors.teal)}
              {button(claim, 'rejected', 'Reject', colors.danger)}
            </View>
          )}
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
  gap: { marginTop: spacing.xs },
  qa: { marginTop: spacing.md, gap: 2 },
  question: { ...type.body, fontWeight: '600' },
  history: { marginBottom: spacing.md },
  approved: { ...type.body, fontWeight: '600', color: colors.teal, marginTop: spacing.md },
  details: { color: colors.teal, fontWeight: '600', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1, borderWidth: 2, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  actionText: { fontSize: 16, fontWeight: '700' },
});
