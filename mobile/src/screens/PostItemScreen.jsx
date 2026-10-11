import { useContext, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { createItem } from "../api/client";
import { buildings, categories } from "../data/options";
import CategoryChips from "../components/CategoryChips";
import { colors, spacing, type } from "../theme";

const MAX_QUESTIONS = 3;
// Lighter than typed text so hints are clearly not real input.
const PLACEHOLDER = "#A5B0BA";
const pickable = categories.filter((c) => c !== "All");

// One draft per user, kept in this browser (not on the server).
const draftKey = (user) => `campusclaim_draft_${user.id}`;
function loadDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null; // nothing saved, or storage unavailable
  }
}

// Form for a finder to post a found item: public description, location,
// category, and private questions only the real owner could answer.
export default function PostItemScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const key = draftKey(user);
  const [draft] = useState(() => loadDraft(key)); // saved earlier, if any
  const [title, setTitle] = useState(draft?.title ?? "");
  const [building, setBuilding] = useState(draft?.building ?? ""); // picked from the list
  const [detail, setDetail] = useState(draft?.detail ?? ""); // optional: floor, room, landmark
  const [category, setCategory] = useState(draft?.category ?? "Other");
  // Each question has the answer the owner must give to claim the item.
  const [questions, setQuestions] = useState(draft?.questions ?? [{ question: "", answer: "" }]);
  const [hasDraft, setHasDraft] = useState(!!draft);
  const [notice, setNotice] = useState(draft ? "Your saved draft was restored." : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // set after a successful post

  const setQA = (i, field, value) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, [field]: value } : q)));

  // Keep what's typed so far; it is restored next time this page opens.
  function saveDraft() {
    setError("");
    try {
      localStorage.setItem(key, JSON.stringify({ title, building, detail, category, questions }));
      setHasDraft(true);
      setNotice("Draft saved on this device. It will be here next time you open this page.");
    } catch {
      setError("Could not save the draft in this browser.");
    }
  }

  function discardDraft() {
    try {
      localStorage.removeItem(key);
    } catch {}
    setTitle("");
    setBuilding("");
    setDetail("");
    setCategory("Other");
    setQuestions([{ question: "", answer: "" }]);
    setHasDraft(false);
    setNotice("Draft discarded.");
  }

  async function submit() {
    setError("");
    if (!building) return setError("Pick the building where you found it.");
    // Stored as one string, e.g. "Library, 2nd floor", so search still matches it.
    const location = detail.trim() ? `${building}, ${detail.trim()}` : building;
    setBusy(true);
    try {
      setResult(await createItem({ title, category, location, questions }, user.token));
      try {
        localStorage.removeItem(key); // posted, so the draft is no longer needed
      } catch {}
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // After posting: confirmation instead of the form.
  if (result) {
    return (
      <View style={styles.screen}>
        <Text style={type.heading}>Thanks for posting!</Text>
        <Text style={[type.body, styles.gap]}>
          {result.routedToSecurity
            ? "This looks like an ID, card or phone, so it won't be listed publicly. Please hand it in to Campus Security."
            : `Your item is listed as No. ${result.id}.`}
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to list</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>What is it?</Text>
      <TextInput placeholderTextColor={PLACEHOLDER} style={styles.input} placeholder="Black water bottle" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Where did you find it?</Text>
      <CategoryChips categories={buildings} selected={building} onSelect={setBuilding} />
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        style={[styles.input, styles.detail]}
        placeholder="Floor or room, e.g. 2nd floor (optional)"
        value={detail}
        onChangeText={setDetail}
      />

      <Text style={styles.label}>Category</Text>
      <CategoryChips categories={pickable} selected={category} onSelect={setCategory} />

      <Text style={[styles.label, styles.gap]}>Private questions</Text>
      <Text style={type.meta}>
        Only the real owner should know the answer (a sticker, what's inside, a scratch). These are never shown publicly.
      </Text>
      {questions.map((q, i) => (
        <View key={i} style={styles.qa}>
          <TextInput placeholderTextColor={PLACEHOLDER}
            style={styles.input}
            placeholder="Question, e.g. What sticker is on it?"
            value={q.question}
            onChangeText={(v) => setQA(i, "question", v)}
          />
          <TextInput placeholderTextColor={PLACEHOLDER}
            style={styles.input}
            placeholder="Correct answer"
            value={q.answer}
            onChangeText={(v) => setQA(i, "answer", v)}
          />
        </View>
      ))}
      {questions.length < MAX_QUESTIONS ? (
        <Pressable onPress={() => setQuestions((qs) => [...qs, { question: "", answer: "" }])}>
          <Text style={styles.link}>+ Add another question</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>Post item</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={saveDraft} disabled={busy}>
        <Text style={styles.secondaryText}>Save draft</Text>
      </Pressable>
      {hasDraft ? (
        <Pressable onPress={discardDraft}>
          <Text style={[styles.link, styles.discard]}>Discard draft</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { flexGrow: 1, backgroundColor: colors.mist, padding: spacing.md, paddingBottom: spacing.xl },
  gap: { marginTop: spacing.lg, marginBottom: spacing.md },
  label: { ...type.body, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.slate,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  detail: { marginTop: spacing.md },
  qa: { marginTop: spacing.md },
  error: { color: "#B00020", marginVertical: spacing.md },
  button: {
    backgroundColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.md,
  },
  secondary: {
    borderWidth: 2,
    borderColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.md,
  },
  secondaryText: { fontSize: 16, fontWeight: "700", color: colors.teal },
  notice: { color: colors.teal, marginTop: spacing.md },
  discard: { marginTop: spacing.md, color: "#B00020" },
  disabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.paper },
  link: { color: colors.teal, fontWeight: "600" },
});
