import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { fetchClaimForm, fetchOptions, reportItem, submitClaim } from '../api/client';
import ErrorRetry from '../components/ErrorRetry';
import ItemPhoto from '../components/ItemPhoto';
import { colors, spacing, type, ui } from '../theme';
import { where } from '../components/ItemCard';
import { CLAIM_STATUS, claimStage } from '../claimStatus';

// One found item from the list, and the claim form: the finder's private
// questions (text only, never the answers). Campus Security reviews each claim.
export default function ItemDetailScreen({ route }) {
  const { id, title, location, building, latitude, longitude } = route.params;
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(null); // { questions, myClaim } from the server
  const [unavailable, setUnavailable] = useState(''); // why this item can't be claimed
  const [loadFailed, setLoadFailed] = useState(''); // the claim form didn't load (offline, server error)
  const [attempt, setAttempt] = useState(0); // bumped by "Try again" to load the form again
  const [answers, setAnswers] = useState({}); // { questionId: answer }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [reportReasons, setReportReasons] = useState([]); // from the server (GET /items/options)

  useEffect(() => {
    fetchOptions()
      .then((o) => setReportReasons(o.reportReasons ?? []))
      .catch(() => {}); // the report form says it couldn't load them
  }, []);

  async function submitReport() {
    if (!reportReason) return setReportMessage('Choose a reason for your report.');
    setReportBusy(true);
    setReportMessage('');
    try {
      await reportItem(id, reportReason, reportDetails, user.token);
      setReportOpen(false);
      setReportDetails('');
      setReportMessage('Report submitted. Campus Security will review it.');
    } catch (err) {
      setReportMessage(err.message);
    } finally {
      setReportBusy(false);
    }
  }

  useEffect(() => {
    // Guests can look but not claim (the server refuses them too).
    if (user.role === 'guest') return setUnavailable('Log in with your school email to claim this item.');
    let active = true;
    fetchClaimForm(id, user.token)
      .then((f) => active && setForm(f))
      // Offline or a server error: worth trying again. Anything else (own post, already
      // claimed, locked out) is the answer, so it's shown as is.
      .catch((err) => active && (err.retry ? setLoadFailed(err.message) : setUnavailable(err.message)));
    return () => {
      active = false;
    };
  }, [id, user.token, user.role, attempt]);

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
  // A highlighted headline in the status colour, then what it means.
  const statusBlock = ({ headline, next, color, text }) => (
    <View style={styles.section}>
      <Text style={[styles.headline, { backgroundColor: color, color: text }]}>{headline}</Text>
      <Text style={type.heading}>{next}</Text>
    </View>
  );

  if (loadFailed) {
    claimSection = (
      <ErrorRetry
        message={loadFailed}
        onRetry={() => {
          setLoadFailed('');
          setAttempt((n) => n + 1);
        }}
        style={styles.section}
      />
    );
  } else if (unavailable) {
    // Someone else's claim was approved: shown like a claim status, in green.
    const closed = ['claimed', 'dropped off', 'handed off'].includes(route.params.status);
    claimSection = closed
      ? statusBlock({ headline: 'Claimed', next: unavailable, color: colors.tagDone, text: colors.tagDoneText })
      : <Text style={[type.body, styles.section]}>{unavailable}</Text>;
  }
  else if (!form) claimSection = <ActivityIndicator color={colors.accent} />;
  else if (form.myClaim) {
    claimSection = statusBlock(CLAIM_STATUS[claimStage(form.myClaim, form.itemStatus)]);
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

      {/* The finder's photo, above the claim section. */}
      <ItemPhoto itemId={id} hasPhoto={route.params.hasPhoto} title={title} />

      {/* The heading only goes with the claim form; a claim status stands on its own. */}
      {form && !form.myClaim ? <Text style={[type.heading, styles.section]}>Is this yours?</Text> : null}
      {claimSection}

      {/* Students only: the server refuses reports from guests (throwaway accounts). */}
      {['open', 'claim pending'].includes(route.params.status) && user.role !== 'guest' && route.params.myClaim !== 'post hidden' ? (
        <View style={styles.reportArea}>
          {reportMessage ? <Text style={reportMessage.includes('submitted') ? styles.confirmation : styles.error}>{reportMessage}</Text> : null}
          <Pressable
            style={[styles.reportButton, reportBusy && ui.disabled]}
            onPress={() => setReportOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.reportButtonText}>Report this post</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={type.heading}>Report this post</Text>
            <Text style={[type.meta, styles.modalHint]}>Tell Campus Security why this post should be reviewed.</Text>
            {reportReasons.length ? null : (
              <Text style={styles.error}>Couldn't load the report reasons. Check your connection and try again.</Text>
            )}
            {reportReasons.map((reason) => (
              <Pressable
                key={reason}
                style={[styles.reason, reportReason === reason && styles.reasonSelected]}
                onPress={() => {
                  setReportReason(reason);
                  setReportMessage('');
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: reportReason === reason }}
              >
                <Text style={[type.body, reportReason === reason && styles.reasonTextSelected]}>{reason}</Text>
              </Pressable>
            ))}
            <Text style={[styles.label, styles.detailsLabel]}>Details (optional)</Text>
            <TextInput
              style={[ui.input, styles.detailsInput]}
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Add useful context"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
            />
            {reportMessage ? <Text style={reportMessage.includes('submitted') ? styles.confirmation : styles.error}>{reportMessage}</Text> : null}
            <View style={ui.actions}>
              <Pressable style={[styles.modalButton, styles.modalCancel]} onPress={() => setReportOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSubmit, reportBusy && ui.disabled]} onPress={submitReport} disabled={reportBusy}>
                <Text style={ui.smallButtonText}>{reportBusy ? 'Submitting...' : 'Submit report'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  reportArea: { marginTop: spacing.xl, alignItems: 'flex-start' },
  reportButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  reportButtonText: { color: colors.danger, fontWeight: '700' },
  confirmation: { color: colors.tagDoneText, marginBottom: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: spacing.md },
  modalCard: { ...ui.card, padding: spacing.md, maxHeight: '90%' },
  modalHint: { marginTop: spacing.sm, marginBottom: spacing.md },
  reason: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
  reasonSelected: { borderColor: colors.accent, backgroundColor: colors.tagDone },
  reasonTextSelected: { color: colors.accent, fontWeight: '700' },
  detailsLabel: { marginTop: spacing.sm },
  detailsInput: { minHeight: 72, textAlignVertical: 'top' },
  modalButton: { flex: 1, borderRadius: 8, padding: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { borderWidth: 1, borderColor: colors.line },
  modalCancelText: { color: colors.ink, fontWeight: '700' },
  modalSubmit: { backgroundColor: colors.accent },
});
