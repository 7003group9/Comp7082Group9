import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { createItem, deleteDraft, fetchDraft, putDraft } from "../api/client";
import { buildings, categories } from "../data/options";
import CategoryChips from "../components/CategoryChips";
import { colors, spacing, type } from "../theme";

const MAX_QUESTIONS = 3;
// Photo limits; the server checks the same ones.
const MAX_PHOTOS = 3;
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// Lighter than typed text so hints are clearly not real input.
const PLACEHOLDER = "#A5B0BA";
const pickable = categories.filter((c) => c !== "All");
const EMPTY_QA = { question: "", answer: "" };

// Stored as one string, e.g. "Library, 2nd floor", so search still matches it.
const toLocation = (building, detail) => (detail.trim() ? `${building}, ${detail.trim()}` : building);
// The server only saves questions that have both parts filled in.
const isComplete = (q) => !!(q.question.trim() && q.answer.trim());
const isPartial = (q) => !isComplete(q) && !!(q.question.trim() || q.answer.trim());

// Same checks the server makes. Returns { field: message } for anything wrong;
// the field names match the server's (location = the building picker).
function checkForm({ title, building, questions }) {
  const errors = {};
  if (!title.trim()) errors.title = "Say what the item is.";
  if (!building) errors.location = "Pick the building where you found it.";
  if (!questions.some(isComplete)) errors.questions = "Add at least one private question with its answer.";
  return errors;
}

// Opens the device's file picker and calls onPick with the chosen files.
function pickFiles(onPick) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = PHOTO_TYPES.join(",");
  input.multiple = true;
  input.onchange = () => onPick(Array.from(input.files ?? []));
  input.click();
}

// Red message under a field; nothing when there is no error.
const FieldError = ({ message }) => (message ? <Text style={styles.fieldError}>{message}</Text> : null);

// Row of photo previews. With onRemove, each one gets a remove button.
function Thumbnails({ photos, onRemove }) {
  if (!photos.length) return null;
  return (
    <View style={styles.thumbs}>
      {photos.map((p, i) => (
        <View key={p.uri}>
          <Image source={{ uri: p.uri }} style={styles.thumb} accessibilityLabel={`Photo ${i + 1}`} />
          {onRemove ? (
            <Pressable
              style={styles.remove}
              onPress={() => onRemove(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// Form for a finder to post a found item: public description, location,
// category, photos, and private questions only the real owner could answer.
export default function PostItemScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true); // checking the server for a saved draft
  const [title, setTitle] = useState("");
  const [building, setBuilding] = useState(""); // picked from the list
  const [detail, setDetail] = useState(""); // optional: floor, room, landmark
  const [category, setCategory] = useState("Other");
  // Each question has the answer the owner must give to claim the item.
  const [questions, setQuestions] = useState([EMPTY_QA]);
  // Picked photos as { file, uri }; uri is a preview straight from the device.
  const [photos, setPhotos] = useState([]);
  const [hasDraft, setHasDraft] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({}); // { field: message }
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false); // showing the review step
  const [result, setResult] = useState(null); // set after a successful post

  // Restore the draft saved on the server, if any. If it can't be loaded,
  // start with an empty form; posting still works.
  useEffect(() => {
    let active = true;
    fetchDraft(user.token)
      .then((draft) => {
        if (!active || !draft) return;
        setTitle(draft.title ?? "");
        setBuilding(draft.building ?? "");
        setDetail(draft.detail ?? "");
        setCategory(draft.category ?? "Other");
        setQuestions(draft.questions?.length ? draft.questions : [EMPTY_QA]);
        setHasDraft(true);
        setNotice("Your saved draft was restored.");
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user.token]);

  // Free the photo previews when leaving the page.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.uri)), []);

  // Changing a field clears its error message.
  const clearError = (field) => setFieldErrors((fe) => (fe[field] ? { ...fe, [field]: undefined } : fe));

  const setQA = (i, field, value) => {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, [field]: value } : q)));
    clearError("questions");
  };

  function addPhotos(files) {
    const room = MAX_PHOTOS - photos.length;
    const ok = files.filter((f) => PHOTO_TYPES.includes(f.type) && f.size <= MAX_PHOTO_MB * 1024 * 1024);
    const problems = [];
    if (ok.length < files.length) problems.push(`Photos must be JPEG, PNG, WebP or GIF and ${MAX_PHOTO_MB} MB or smaller.`);
    if (ok.length > room) problems.push(`You can add up to ${MAX_PHOTOS} photos.`);
    setFieldErrors((fe) => ({ ...fe, photos: problems.join(" ") || undefined }));
    setPhotos((ps) => [...ps, ...ok.slice(0, room).map((file) => ({ file, uri: URL.createObjectURL(file) }))]);
  }

  function removePhoto(i) {
    URL.revokeObjectURL(photos[i].uri);
    setPhotos((ps) => ps.filter((_, j) => j !== i));
    clearError("photos");
  }

  // Keep what's typed so far on the server; it is restored next time this page opens.
  async function saveDraft() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await putDraft({ title, building, detail, category, questions }, user.token);
      setHasDraft(true);
      setNotice(
        photos.length
          ? "Draft saved. Photos aren't saved in drafts, so add them again when you come back."
          : "Draft saved. It will be here next time you open this page."
      );
    } catch (err) {
      setError(`Could not save the draft: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await deleteDraft(user.token);
    } catch (err) {
      setError(`Could not discard the draft: ${err.message}`);
      return;
    } finally {
      setBusy(false);
    }
    photos.forEach((p) => URL.revokeObjectURL(p.uri));
    setTitle("");
    setBuilding("");
    setDetail("");
    setCategory("Other");
    setQuestions([EMPTY_QA]);
    setPhotos([]);
    setFieldErrors({});
    setHasDraft(false);
    setNotice("Draft discarded.");
  }

  // Only shows the review step for a post the server will accept.
  function review() {
    setError("");
    setNotice("");
    const errors = checkForm({ title, building, questions });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return setError("Fix the fields marked above first.");
    setReviewing(true);
  }

  function edit() {
    setError("");
    setReviewing(false);
  }

  async function submit() {
    setError("");
    const location = toLocation(building, detail);
    setBusy(true);
    try {
      const posted = await createItem(
        { title, category, location, questions, photos: photos.map((p) => p.file) },
        user.token
      );
      deleteDraft(user.token).catch(() => {}); // posted, so the draft is no longer needed
      setResult(posted);
    } catch (err) {
      // The server said which fields are wrong: back to the form to show them there.
      if (err.fields) {
        setFieldErrors(err.fields);
        setReviewing(false);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
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

  // Before posting: show what will be saved, with Edit to go back to the form.
  if (reviewing) {
    const complete = questions.filter(isComplete);
    const partial = questions.filter(isPartial).length;
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
        <Text style={type.heading}>Check your post</Text>
        <Text style={[type.meta, styles.intro]}>Make sure everything is right before you post it.</Text>

        <Text style={styles.label}>What is it?</Text>
        <Text style={styles.value}>{title.trim()}</Text>

        <Text style={styles.label}>Where did you find it?</Text>
        <Text style={styles.value}>{toLocation(building, detail)}</Text>

        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{category}</Text>

        {photos.length ? (
          <>
            <Text style={styles.label}>Photos</Text>
            <View style={styles.reviewPhotos}>
              <Thumbnails photos={photos} />
            </View>
          </>
        ) : null}

        <Text style={styles.label}>Private questions</Text>
        <Text style={type.meta}>Only you can see these answers. They are never shown publicly.</Text>
        {complete.map((q, i) => (
          <View key={i} style={styles.qaReview}>
            <Text style={type.body}>{`${i + 1}. ${q.question.trim()}`}</Text>
            <Text style={type.meta}>{`Answer: ${q.answer.trim()}`}</Text>
          </View>
        ))}
        {partial ? (
          <Text style={styles.warning}>
            {partial === 1
              ? "1 question is missing its question or answer and won't be saved."
              : `${partial} questions are missing a question or answer and won't be saved.`}
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Posting..." : "Submit"}</Text>
        </Pressable>
        <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={edit} disabled={busy}>
          <Text style={styles.secondaryText}>Edit</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>What is it?</Text>
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        style={[styles.input, fieldErrors.title && styles.inputError]}
        placeholder="Black water bottle"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          clearError("title");
        }}
      />
      <FieldError message={fieldErrors.title} />

      <Text style={styles.label}>Where did you find it?</Text>
      <CategoryChips
        categories={buildings}
        selected={building}
        onSelect={(b) => {
          setBuilding(b);
          clearError("location");
        }}
      />
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        style={[styles.input, styles.detail]}
        placeholder="Floor or room, e.g. 2nd floor (optional)"
        value={detail}
        onChangeText={setDetail}
      />
      <FieldError message={fieldErrors.location} />

      <Text style={styles.label}>Category</Text>
      <CategoryChips
        categories={pickable}
        selected={category}
        onSelect={(c) => {
          setCategory(c);
          clearError("category");
        }}
      />
      <FieldError message={fieldErrors.category} />

      <Text style={[styles.label, styles.gap]}>Photos (optional)</Text>
      <Text style={type.meta}>
        Up to {MAX_PHOTOS}. Don't show anything that gives away your private answers, like a sticker or what's inside.
      </Text>
      <Thumbnails photos={photos} onRemove={removePhoto} />
      {photos.length < MAX_PHOTOS ? (
        <Pressable style={styles.addPhotos} onPress={() => pickFiles(addPhotos)}>
          <Text style={styles.link}>+ Add photos</Text>
        </Pressable>
      ) : null}
      <FieldError message={fieldErrors.photos} />

      <Text style={[styles.label, styles.gap]}>Private questions</Text>
      <Text style={type.meta}>
        Only the real owner should know the answer (a sticker, what's inside, a scratch). These are never shown publicly.
      </Text>
      {questions.map((q, i) => (
        <View key={i} style={styles.qa}>
          <TextInput placeholderTextColor={PLACEHOLDER}
            style={[styles.input, fieldErrors.questions && styles.inputError]}
            placeholder="Question, e.g. What sticker is on it?"
            value={q.question}
            onChangeText={(v) => setQA(i, "question", v)}
          />
          <TextInput placeholderTextColor={PLACEHOLDER}
            style={[styles.input, fieldErrors.questions && styles.inputError]}
            placeholder="Correct answer"
            value={q.answer}
            onChangeText={(v) => setQA(i, "answer", v)}
          />
        </View>
      ))}
      <FieldError message={fieldErrors.questions} />
      {questions.length < MAX_QUESTIONS ? (
        <Pressable onPress={() => setQuestions((qs) => [...qs, EMPTY_QA])}>
          <Text style={styles.link}>+ Add another question</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable style={[styles.button, busy && styles.disabled]} onPress={review} disabled={busy}>
        <Text style={styles.buttonText}>Review post</Text>
      </Pressable>
      <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={saveDraft} disabled={busy}>
        <Text style={styles.secondaryText}>Save draft</Text>
      </Pressable>
      {hasDraft ? (
        <Pressable onPress={discardDraft} disabled={busy}>
          <Text style={[styles.link, styles.discard]}>Discard draft</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { flexGrow: 1, backgroundColor: colors.mist, padding: spacing.md, paddingBottom: spacing.xl },
  center: { alignItems: "center", justifyContent: "center" },
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
  inputError: { borderColor: "#B00020" },
  fieldError: { color: "#B00020", marginTop: -spacing.sm, marginBottom: spacing.md },
  detail: { marginTop: spacing.md },
  qa: { marginTop: spacing.md },
  intro: { marginTop: spacing.xs, marginBottom: spacing.lg },
  value: { ...type.body, marginBottom: spacing.lg },
  qaReview: { marginTop: spacing.md },
  reviewPhotos: { marginTop: -spacing.md, marginBottom: spacing.lg },
  warning: { color: "#8A5A00", marginTop: spacing.md },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: colors.line },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: colors.paper, fontSize: 16, fontWeight: "700", lineHeight: 18 },
  addPhotos: { marginTop: spacing.md, marginBottom: spacing.md },
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
