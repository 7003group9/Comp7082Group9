import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { decideClaim, fetchClaimsToReview, markReceived } from '../api/client';
import { colors, spacing, type } from '../theme';

const RED = '#B00020';

// Campus Security only: pending claims, each answer beside the finder's expected
// one, so staff can compare them and decide. An approved claim stays here until
// the finder hands the item in and staff press "Received at the security desk".
// Every button needs a second tap, since each step is final.
export default function SecurityDashboardScreen() {
  const { user } = useContext(AuthContext);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { id, decision } waiting for a second tap ('received' too)
  const [busyId, setBusyId] = useState(null);

  // Reload whenever the screen is shown.
  useFocusEffect(
    useCallback(() => {
      setError('');
      fetchClaimsToReview(user.token)
        .then(setClaims)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, [user.token])
  );

  // An armed "Tap again" lapses after a few seconds.
  useEffect(() => {
    if (!confirm) return;
    const timer = setTimeout(() => setConfirm(null), 4000);
    return () => clearTimeout(timer);
  }, [confirm]);

  async function onDecide(claim, decision) {
    if (confirm?.id !== claim.id || confirm.decision !== decision) return setConfirm({ id: claim.id, decision });
    setError('');
    setBusyId(claim.id);
    try {
      if (decision === 'received') {
        await markReceived(claim.itemId, user.token);
        setClaims((list) => list.filter((c) => c.id !== claim.id)); // done with it
      } else {
        await decideClaim(claim.id, decision, user.token);
        // Approving rejects the other claims on that item, so drop them; the approved
        // one stays, waiting for the item to be received. A rejected one goes.
        setClaims((list) =>
          decision === 'approved'
            ? list
                .filter((c) => c.itemId !== claim.itemId || c.id === claim.id)
                .map((c) => (c.id === claim.id ? { ...c, status: 'approved' } : c))
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
    const armed = confirm?.id === claim.id && confirm.decision === decision;
    return (
      <Pressable
        style={[styles.action, { borderColor: color }, armed && { backgroundColor: color }]}
        onPress={() => onDecide(claim, decision)}
        disabled={busyId === claim.id}
        accessibilityRole="button"
        accessibilityLabel={`${label} claim by ${claim.claimantEmail}`}
      >
        <Text style={[styles.actionText, { color: armed ? colors.paper : color }]}>
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
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={error ? null : <Text style={[type.body, styles.empty]}>No claims waiting for review.</Text>}
      renderItem={({ item: claim }) => (
        <View style={styles.card}>
          <Text style={type.heading}>{claim.title}</Text>
          <Text style={type.meta}>
            No. {claim.itemId} · {claim.location}
          </Text>
          <Text style={[type.meta, styles.gap]}>Claimed by {claim.claimantEmail}</Text>

          {claim.answers.map((a, i) => (
            <View key={a.questionId} style={styles.qa}>
              <Text style={styles.question}>{`${i + 1}. ${a.question}`}</Text>
              <Text style={type.body}>Expected: {a.expected}</Text>
              <Text style={type.body}>Answered: {a.answer}</Text>
            </View>
          ))}

          {claim.status === 'approved' ? (
            <>
              <Text style={styles.approved}>Approved. Waiting for the finder to drop it off.</Text>
              <View style={styles.actions}>{button(claim, 'received', '✓ Received at the security desk', colors.teal)}</View>
            </>
          ) : (
            <View style={styles.actions}>
              {button(claim, 'approved', 'Approve', colors.teal)}
              {button(claim, 'rejected', 'Reject', RED)}
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
  error: { color: RED, marginBottom: spacing.md },
  card: { backgroundColor: colors.paper, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
  gap: { marginTop: spacing.xs },
  qa: { marginTop: spacing.md, gap: 2 },
  question: { ...type.body, fontWeight: '600' },
  approved: { ...type.body, fontWeight: '600', color: colors.teal, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1, borderWidth: 2, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  actionText: { fontSize: 16, fontWeight: '700' },
});
