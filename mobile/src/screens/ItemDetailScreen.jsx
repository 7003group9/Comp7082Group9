import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchClaimForm, submitClaim } from '../api/client';
import { colors, spacing, type, ui } from '../theme';
import { where } from '../components/ItemCard';

// What a claimant sees once they've claimed (they only get one try per item):
// a highlighted headline in the status colour, then what to do next.
const CLAIM_STATUS = {
  pending: { headline: 'Your claim was sent.', next: 'Campus Security will check your answers. Check back here for the result.', color: colors.tagWait, text: colors.tagWaitText },
  approved: { headline: 'Your claim was approved.', next: 'Collect the item from Campus Security.', color: colors.tagDone, text: colors.tagDoneText },
  rejected: { headline: "Your claim wasn't approved.", next: 'If this really is yours, visit Campus Security with proof.', color: colors.tagNo, text: colors.tagNoText },
};

// One found item from the list, and the claim form: the finder's private
// questions (text only, never the answers). Campus Security reviews each claim.
export default function ItemDetailScreen({ route }) {
  const { id, title, location, building, latitude, longitude } = route.params;
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(null); // { questions, myClaim } from the server
  const [unavailable, setUnavailable] = useState(''); // why this item can't be claimed
  const [answers, setAnswers] = useState({}); // { questionId: answer }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchClaimForm(id, user.token)
      .then((f) => active && setForm(f))
      .catch((err) => active && setUnavailable(err.message)); // own post, already claimed, or offline
    return () => {
      active = false;
    };
  }, [id, user.token]);

  async function send() {
    setError('');
    if (form.questions.some((q) => !answers[q.id]?.trim())) return setError('Answer every question.');
    setBusy(true);
    try {
      const claim = await submitClaim(
        id,
        form.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] })),
        user.token
      );
      setForm({ questions: [], myClaim: claim.status });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  let claimSection;
  if (unavailable) claimSection = <Text style={[type.body, styles.section]}>{unavailable}</Text>;
  else if (!form) claimSection = <ActivityIndicator color={colors.teal} />;
  else if (form.myClaim) {
    const { headline, next, color, text } = CLAIM_STATUS[form.myClaim];
    claimSection = (
      <View style={styles.section}>
        <Text style={[styles.headline, { backgroundColor: color, color: text }]}>{headline}</Text>
        <Text style={type.heading}>{next}</Text>
      </View>
    );
  }
  else {
    claimSection = (
      <>
        <Text style={type.meta}>
          Answer the finder's questions. You only get one try, and Campus Security checks your answers.
        </Text>
        {form.questions.map((q, i) => (
          <View key={q.id} style={styles.qa}>
            <Text style={styles.label}>{`${i + 1}. ${q.question}`}</Text>
            <TextInput
              style={styles.input}
              placeholder="Your answer"
              placeholderTextColor={colors.placeholder}
              value={answers[q.id] ?? ''}
              onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              accessibilityLabel={q.question}
            />
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={send} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Sending...' : 'Send claim'}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={type.heading}>{title}</Text>
      <Text style={[type.meta, { marginTop: spacing.sm }]}>Item No. {id}</Text>
      {location ? <Text style={[type.body, { marginTop: spacing.md }]}>Found at: {where({ building, location })}</Text> : null}
      {latitude != null ? (
        <Pressable
          style={({ pressed }) => [ui.smallButton, styles.mapButton, pressed && ui.pressed]}
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`)}
          accessibilityRole="link"
        >
          <Text style={ui.smallButtonText}>View on map</Text>
        </Pressable>
      ) : null}

      {/* The heading only goes with the claim form; a claim status stands on its own. */}
      {form && !form.myClaim ? <Text style={[type.heading, styles.section]}>Is this yours?</Text> : null}
      {claimSection}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { flexGrow: 1, backgroundColor: colors.mist, padding: spacing.md, paddingBottom: spacing.xl },
  mapButton: { marginTop: spacing.sm },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  headline: {
    ...type.heading,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  qa: { marginTop: spacing.md },
  label: { ...type.body, fontWeight: '600', marginBottom: spacing.xs },
  input: ui.input,
  error: { color: colors.danger, marginTop: spacing.md },
  button: { ...ui.button, marginTop: spacing.lg },
  disabled: ui.disabled,
  buttonText: ui.buttonText,
});
