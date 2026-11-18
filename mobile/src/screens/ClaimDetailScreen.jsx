import { useContext, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { decideClaim, fetchItem } from '../api/client';
import { postedAt, where } from '../components/ItemCard';
import StatusLabel from '../components/StatusLabel';
import { useConfirm } from '../hooks';
import { colors, spacing, type, ui } from '../theme';


// One claim opened from Review claims, with what the list doesn't show: the item's
// details and how many of this claimant's earlier claims were rejected.
export default function ClaimDetailScreen({ route }) {
  const { user } = useContext(AuthContext);
  const [claim, setClaim] = useState(route.params.claim);
  const [confirm, setConfirm] = useConfirm(); // 'approved' | 'rejected' waiting for a second tap
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [item, setItem] = useState(null); // null while loading, false if it failed

  useEffect(() => {
    fetchItem(claim.itemId).then(setItem).catch(() => setItem(false));
  }, [claim.itemId]);

  async function onDecide(decision) {
    if (confirm !== decision) return setConfirm(decision);
    setError('');
    setBusy(true);
    try {
      const saved = await decideClaim(claim.id, decision, user.token);
      setClaim((c) => ({ ...c, status: saved?.status ?? decision }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const button = (decision, label, color) => {
    const armed = confirm === decision;
    return (
      <Pressable
        style={[ui.action, { borderColor: color }, armed && { backgroundColor: color }]}
        onPress={() => onDecide(decision)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${label} claim by ${claim.claimantEmail}`}
      >
        <Text style={[ui.actionText, { color: armed ? colors.onAccent : color }]}>
          {armed ? 'Tap again' : label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <Text style={type.heading}>{claim.title}</Text>
      <Text style={type.meta}>{where(claim)}</Text>
      <StatusLabel claim={claim.status} />

      <Text style={styles.section}>Item</Text>
      {item ? (
        <>
          <Text style={type.body}>Category: {item.category}</Text>
          <Text style={type.body}>Found at: {[item.building, item.location].filter(Boolean).join(' · ')}</Text>
          <Text style={type.body}>Posted: {postedAt(item.postedAt)}</Text>
          {item.latitude != null ? (
            <Pressable
              onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}
              accessibilityRole="link"
            >
              <Text style={styles.link}>View on map</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={type.meta}>{item === false ? "Couldn't load the item's details." : 'Loading item details...'}</Text>
      )}

      <Text style={styles.section}>Claimant</Text>
      <Text style={type.body}>{claim.claimantEmail}</Text>
      <Text style={[type.body, claim.rejectedBefore > 0 && styles.warn]}>
        {claim.rejectedBefore > 0
          ? `${claim.rejectedBefore} earlier claim${claim.rejectedBefore === 1 ? '' : 's'} rejected`
          : 'No earlier claims rejected'}
      </Text>

      <Text style={styles.section}>Answers</Text>
      {claim.answers.map((a, i) => (
        <View key={a.questionId} style={i > 0 && styles.qa}>
          <Text style={styles.question}>{`${i + 1}. ${a.question}`}</Text>
          <Text style={type.body}>Expected: {a.expected}</Text>
          <Text style={type.body}>Answered: {a.answer}</Text>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {claim.status === 'pending' ? (
        <View style={[ui.actions, styles.actions]}>
          {button('approved', 'Approve', colors.teal)}
          {button('rejected', 'Reject', colors.danger)}
        </View>
      ) : (
        <Text style={styles.saved}>Decision saved.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { padding: spacing.md, gap: 2 },
  section: { ...type.heading, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.xs },
  link: { color: colors.teal, fontWeight: '600', marginTop: spacing.xs },
  warn: { color: colors.danger, fontWeight: '600' },
  qa: { marginTop: spacing.md, gap: 2 },
  question: { ...type.body, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.md },
  saved: { ...type.body, fontWeight: '600', color: colors.teal, marginTop: spacing.lg },
  actions: { marginTop: spacing.lg },
});
