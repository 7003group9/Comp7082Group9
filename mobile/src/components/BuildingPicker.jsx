import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing, type } from "../theme";

const MAX_SHOWN = 12;
// Ignore case and spaces so "se12" and "SE 12" both find SE12.
const squash = (s) => s.toLowerCase().replace(/\s+/g, "");

// Pick one building from a long list: type to narrow it down, tap a match.
// Once chosen it shows as a single pill with a Change link.
// Props: buildings (string[]), selected (string, "" for none), onSelect(building).
export default function BuildingPicker({ buildings, selected, onSelect }) {
  const [text, setText] = useState("");

  if (selected) {
    return (
      <View style={styles.chosen}>
        <View style={[styles.chip, styles.chipActive]}>
          <Text style={[styles.label, styles.labelActive]}>{selected}</Text>
        </View>
        <Pressable onPress={() => onSelect("")} accessibilityRole="button" accessibilityLabel="Change building">
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>
    );
  }

  const matches = buildings.filter((b) => squash(b).includes(squash(text)));
  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Search buildings, e.g. SE12"
        placeholderTextColor={colors.placeholder}
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        accessibilityLabel="Search buildings"
      />
      <View style={styles.wrap}>
        {matches.slice(0, MAX_SHOWN).map((b) => (
          <Pressable
            key={b}
            style={styles.chip}
            onPress={() => {
              onSelect(b);
              setText("");
            }}
            accessibilityRole="button"
          >
            <Text style={styles.label}>{b}</Text>
          </Pressable>
        ))}
      </View>
      {matches.length > MAX_SHOWN ? (
        <Text style={type.meta}>{matches.length - MAX_SHOWN} more. Keep typing to narrow it down.</Text>
      ) : null}
      {!matches.length ? <Text style={type.meta}>No building matches "{text.trim()}".</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.slate,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chosen: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  chipActive: { backgroundColor: colors.ink },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  labelActive: { color: "#fff" },
  link: { color: colors.teal, fontWeight: "600" },
});
