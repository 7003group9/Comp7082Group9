import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { createItem, fetchItemForEdit, fetchOptions, updateItem } from "../api/client";
import BuildingPicker from "../components/BuildingPicker";
import CategoryChips from "../components/CategoryChips";
import { colors, spacing, type, ui } from "../theme";

// Photo limits; the server checks the same ones.
const MAX_PHOTOS = 1;
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PLACEHOLDER = colors.placeholder;
const EMPTY_QA = { question: "", answer: "" };

// How long to wait for a GPS fix, and how old a cached one may be.
const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 };
const pinLabel = (pin) => `GPS pin saved${pin.accuracy ? ` (within ${pin.accuracy} m)` : ""}`;

// Message for when the device can't give a position. err.code is one of
// err.PERMISSION_DENIED (1), err.POSITION_UNAVAILABLE (2) or err.TIMEOUT (3).
function describeGeoError(err) {
  switch (err.code) {
    case 1:
      return "Location is blocked for this site. Allow it in your browser settings, then tap the button again.";
    case 3:
      return "Finding your location took too long. Tap the button to try again.";
    default:
      return "Your device couldn't find your location. Move somewhere with a better signal and try again.";
  }
}

// The server only saves questions that have both parts filled in.
const isComplete = (q) => !!(q.question.trim() && q.answer.trim());
const isPartial = (q) => !isComplete(q) && !!(q.question.trim() || q.answer.trim());

// Same checks the server makes. Returns { field: message } for anything wrong;
// the field names match the server's. The GPS pin is required, the building optional.
function checkForm({ title, location, pin, questions }) {
  const errors = {};
  if (!title.trim()) errors.title = "Say what the item is.";
  if (!pin) errors.pin = 'Add a GPS pin with "Use my current location".';
  if (!location.trim()) errors.location = "Describe where you found it.";
  if (!questions.some(isComplete)) errors.questions = "Add at least one private question with its answer.";
  return errors;
}

// Opens the device's file picker and calls onPick with the chosen files.
function pickFiles(onPick) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = PHOTO_TYPES.join(",");
  input.multiple = false;
  input.onchange = () => onPick(Array.from(input.files ?? []));
  input.click();
}

// Field label; required adds the red *.
const Label = ({ children, required, style }) => (
  <Text style={[styles.label, style]}>
    {children}
    {required ? <Text style={styles.required} accessibilityLabel="required"> *</Text> : null}
  </Text>
);

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
// With route.params.editId it edits that post instead: the form is filled from
// the server, photos can't be changed, and saving goes back to My posts.
export default function PostItemScreen({ navigation, route }) {
  const editId = route.params?.editId;
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(!!editId); // editing: fetching the post
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(""); // the finder's description of the spot
  const [pin, setPin] = useState(null); // { latitude, longitude, accuracy? } from the device, or null
  const [building, setBuilding] = useState(""); // optional, one of options.buildings
  const [locating, setLocating] = useState(false); // waiting for the device's position
  const [category, setCategory] = useState("Other");
  // What the server offers. Until it answers (or if it can't), the form has no
  // categories or buildings and room for just one question.
  const [options, setOptions] = useState({ categories: [], buildings: [], maxQuestions: 1 });
  // Each question has the answer the owner must give to claim the item.
  const [questions, setQuestions] = useState([EMPTY_QA]);
  // Picked photos as { file, uri }; uri is a preview straight from the device.
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({}); // { field: message }
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false); // showing the review step

  // The category choices and question limit come from the server, so the app and
  // server can never disagree about them.
  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch(() => {});
  }, []);

  const [loadError, setLoadError] = useState(""); // editing: why the post couldn't be opened

  // Editing: fill the form from the post (answers included).
  useEffect(() => {
    if (!editId) return;
    let active = true;
    navigation.setOptions({ title: "Edit post" });
    fetchItemForEdit(editId, user.token)
      .then((post) => {
        if (!active) return;
        setTitle(post.title ?? "");
        setLocation(post.location ?? "");
        setPin(post.latitude != null ? { latitude: post.latitude, longitude: post.longitude } : null);
        setBuilding(post.building ?? "");
        setCategory(post.category ?? "Other");
        setQuestions(post.questions?.length ? post.questions : [EMPTY_QA]);
      })
      .catch((err) => active && setLoadError(err.message)) // e.g. someone claimed it
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user.token, editId, navigation]);

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

  // Ask the device where it is. The browser asks the user for permission the first time.
  function locate() {
    if (!navigator.geolocation) {
      return setFieldErrors((fe) => ({ ...fe, pin: describeGeoError({ code: 2 }) }));
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPin({ latitude: coords.latitude, longitude: coords.longitude, accuracy: Math.round(coords.accuracy) });
        clearError("pin");
        setLocating(false);
      },
      (err) => {
        setFieldErrors((fe) => ({ ...fe, pin: describeGeoError(err) }));
        setLocating(false);
      },
      GEO_OPTIONS
    );
  }

  function addPhotos(files) {
    const room = MAX_PHOTOS - photos.length;
    const ok = files.filter((f) => PHOTO_TYPES.includes(f.type) && f.size <= MAX_PHOTO_MB * 1024 * 1024);
    const problems = [];
    if (ok.length < files.length) problems.push(`Photos must be JPEG, PNG, WebP or GIF and ${MAX_PHOTO_MB} MB or smaller.`);
    if (ok.length > room) problems.push("You can only add one photo.");
    setFieldErrors((fe) => ({ ...fe, photos: problems.join(" ") || undefined }));
    setPhotos((ps) => [...ps, ...ok.slice(0, room).map((file) => ({ file, uri: URL.createObjectURL(file) }))]);
  }

  function removePhoto(i) {
    URL.revokeObjectURL(photos[i].uri);
    setPhotos((ps) => ps.filter((_, j) => j !== i));
    clearError("photos");
  }

  // Only shows the review step for a post the server will accept.
  function review() {
    setError("");
    const errors = checkForm({ title, location, pin, questions });
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
    setBusy(true);
    const post = { title, category, location, building, latitude: pin?.latitude, longitude: pin?.longitude, questions };
    try {
      if (editId) {
        await updateItem(editId, post, user.token);
        navigation.goBack(); // My posts reloads when it comes back into view
        return;
      }
      await createItem({ ...post, photos: photos.map((p) => p.file) }, user.token);
      navigation.navigate("Home"); // the list reloads when it comes back into view
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

  if (loadError) {
    return (
      <View style={styles.screen}>
        <Text style={styles.error}>{loadError}</Text>
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
        <Text style={styles.value}>
          {building ? `${building} · ` : ""}
          {location.trim()}
          {"\n"}
          <Text style={type.meta}>{pinLabel(pin)}</Text>
        </Text>

        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{category}</Text>

        {photos.length ? (
          <>
            <Text style={styles.label}>Photograph</Text>
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
          <Text style={styles.buttonText}>{busy ? "Saving..." : editId ? "Save changes" : "Submit"}</Text>
        </Pressable>
        <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={edit} disabled={busy}>
          <Text style={styles.secondaryText}>Edit</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={[type.meta, styles.requiredNote]}>
        <Text style={styles.required}>*</Text> Required
      </Text>
      <Label required>What is it?</Label>
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

      <Label required>Where did you find it?</Label>
      {pin ? (
        <View style={styles.pinRow}>
          <Text style={[type.body, styles.pinText]}>✓ {pinLabel(pin)}</Text>
          <Pressable onPress={() => setPin(null)} accessibilityRole="button" accessibilityLabel="Remove GPS pin">
            <Text style={styles.link}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.secondary, styles.locate, locating && styles.disabled]}
          onPress={locate}
          disabled={locating}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{locating ? "Finding you..." : "📍 Use my current location"}</Text>
        </Pressable>
      )}
      <FieldError message={fieldErrors.pin} />

      <Label style={styles.detail}>Building</Label>
      {options.buildings.length ? (
        <BuildingPicker
          buildings={options.buildings}
          selected={building}
          onSelect={(b) => {
            setBuilding(b);
            clearError("building");
          }}
        />
      ) : (
        <Text style={type.meta}>Couldn't load the buildings. You can still post without one.</Text>
      )}
      <FieldError message={fieldErrors.building} />

      <Label required style={styles.detail}>Describe the location</Label>
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        style={[styles.input, fieldErrors.location && styles.inputError]}
        placeholder="e.g. 2nd floor, by the vending machines"
        value={location}
        onChangeText={(v) => {
          setLocation(v);
          clearError("location");
        }}
      />
      <FieldError message={fieldErrors.location} />

      <Label>Category</Label>
      {options.categories.length ? (
        <CategoryChips
          categories={options.categories}
          selected={category}
          onSelect={(c) => {
            setCategory(c);
            clearError("category");
          }}
        />
      ) : (
        <Text style={type.meta}>Couldn't load the categories. "Other" will be used.</Text>
      )}
      <FieldError message={fieldErrors.category} />

      {editId ? null : (
        <>
          <Label style={styles.gap}>Photograph</Label>
          <Text style={type.meta}>
            Don't show anything that gives away your private answers, like a sticker or what's inside.
          </Text>
          <Thumbnails photos={photos} onRemove={removePhoto} />
          {photos.length < MAX_PHOTOS ? (
            <Pressable style={[styles.secondary, styles.addButton]} onPress={() => pickFiles(addPhotos)} accessibilityRole="button">
              <Text style={styles.secondaryText}>+ Add photo</Text>
            </Pressable>
          ) : null}
          <FieldError message={fieldErrors.photos} />
        </>
      )}

      <Label required style={styles.gap}>Private questions</Label>
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
      {questions.length < options.maxQuestions ? (
        <Pressable
          style={[styles.secondary, styles.addButton]}
          onPress={() => setQuestions((qs) => [...qs, EMPTY_QA])}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>+ Add another question</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, busy && styles.disabled]} onPress={review} disabled={busy}>
        <Text style={styles.buttonText}>{editId ? "Review changes" : "Post lost item"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.mist },
  screen: { flexGrow: 1, backgroundColor: colors.mist, padding: spacing.md, paddingBottom: spacing.xl },
  center: { alignItems: "center", justifyContent: "center" },
  gap: { marginTop: spacing.lg, marginBottom: spacing.md },
  label: { ...type.body, fontWeight: "600", marginBottom: spacing.xs },
  input: { ...ui.input, marginBottom: spacing.md },
  inputError: { borderColor: colors.danger },
  required: { color: colors.danger }, // the red * on required fields
  requiredNote: { marginBottom: spacing.md },
  fieldError: { color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  detail: { marginTop: spacing.md },
  locate: { marginTop: 0, marginBottom: spacing.md }, // room for the error under it, like the inputs
  pinRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pinText: { flexShrink: 1, color: colors.teal },
  qa: { marginTop: spacing.md },
  intro: { marginTop: spacing.xs, marginBottom: spacing.lg },
  value: { ...type.body, marginBottom: spacing.lg },
  qaReview: { marginTop: spacing.md },
  reviewPhotos: { marginTop: -spacing.md, marginBottom: spacing.lg },
  warning: { color: colors.warning, marginTop: spacing.md },
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
  addButton: { marginTop: spacing.md, marginBottom: spacing.md },
  error: { color: colors.danger, marginVertical: spacing.md },
  button: { ...ui.button, marginTop: spacing.md },
  secondary: {
    borderWidth: 2,
    borderColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.md,
  },
  secondaryText: { fontSize: 16, fontWeight: "700", color: colors.teal },
  disabled: ui.disabled,
  buttonText: ui.buttonText,
  link: { color: colors.teal, fontWeight: "600" },
});
