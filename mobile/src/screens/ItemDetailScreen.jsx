import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchClaimForm, submitClaim } from '../api/client';
import { colors, spacing, type } from '../theme';

// What a claimant sees once they've claimed (they only get one try per item).
const CLAIM_STATUS = {
  pending: "Your claim was sent. Campus Security will check your answers. Check back here for the result.",
  approved: 'Your claim was approved. Collect the item from Campus Security.',
  rejected: "Your claim wasn't approved. If this really is yours, visit Campus Security with proof.",
};

// One found item from the list, and the claim form: the finder's private
// questions (text only, never the answers). Campus Security reviews each claim.
export default function ItemDetailScreen({ route }) {
  const { id, title, location, latitude, longitude } = route.params;
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
  if (unavailable) claimSection = <Text style={type.body}>{unavailable}</Text>;
  else if (!form) claimSection = <ActivityIndicator color={colors.teal} />;
  else if (form.myClaim) claimSection = <Text style={styles.status}>{CLAIM_STATUS[form.myClaim]}</Text>;
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
      {location ? <Text style={[type.body, { marginTop: spacing.md }]}>Found at: {location}</Text> : null}
      {latitude != null ? (
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>View on map</Text>
        </Pressable>
      ) : null}

      <Text style={[type.heading, styles.section]}>Is this yours?</Text>
      {claimSection}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { flexGrow: 1, backgroundColor: colors.mist, padding: spacing.md, paddingBottom: spacing.xl },
  link: { color: colors.teal, fontWeight: '600', marginTop: spacing.sm },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  qa: { marginTop: spacing.md },
  label: { ...type.body, fontWeight: '600', marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.slate,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  status: { ...type.body, color: colors.teal },
  error: { color: '#B00020', marginTop: spacing.md },
  button: {
    backgroundColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  disabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.paper },
});
