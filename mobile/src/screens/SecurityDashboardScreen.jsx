import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { decideClaim, fetchClaimsToReview } from '../api/client';
import { colors, spacing, type } from '../theme';

const RED = '#B00020';

// Campus Security only: pending claims, each answer beside the finder's expected
// one. "Matches" ignores case and spacing and is only a hint; staff decide.
// Approve and Reject each need a second tap, since a decision is final.
export default function SecurityDashboardScreen() {
  const { user } = useContext(AuthContext);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { id, decision } waiting for a second tap
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
      await decideClaim(claim.id, decision, user.token);
      // Approving also rejects the other claims on that item, so drop them too.
      setClaims((list) =>
        list.filter((c) => c.id !== claim.id && !(decision === 'approved' && c.itemId === claim.itemId))
      );
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
              <Text style={type.body}>
                Answered: {a.answer}{' '}
                <Text style={{ color: a.matches ? colors.teal : RED }}>{a.matches ? '✓' : '✗'}</Text>
              </Text>
            </View>
          ))}
          <Text style={[styles.verdict, { color: claim.matches ? colors.teal : RED }]}>
            {claim.matches ? 'All answers match' : "Some answers don't match"}
          </Text>

          <View style={styles.actions}>
            {button(claim, 'approved', 'Approve', colors.teal)}
            {button(claim, 'rejected', 'Reject', RED)}
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
  error: { color: RED, marginBottom: spacing.md },
  card: { backgroundColor: colors.paper, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: 2 },
  gap: { marginTop: spacing.xs },
  qa: { marginTop: spacing.md, gap: 2 },
  question: { ...type.body, fontWeight: '600' },
  verdict: { fontWeight: '700', marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1, borderWidth: 2, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  actionText: { fontSize: 16, fontWeight: '700' },
});
