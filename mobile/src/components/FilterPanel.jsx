import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors, spacing } from "../theme";
import CategoryChips from "./CategoryChips";
import BuildingPicker from "./BuildingPicker";

// Today as YYYY-MM-DD in the viewer's time zone (found items can't be from the future).
const today = () => new Date().toLocaleDateString("en-CA");

// The browser's own date picker (the app runs on the web), so the value is always a
// real YYYY-MM-DD date or "" when cleared. min/max stop "From" coming after "To".
function DateField({ label, value, onChange, min, max }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <input
        type="date"
        value={value}
        min={min || undefined}
        max={max || undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} date`}
        style={dateInput}
      />
    </View>
  );
}

// A plain HTML element, so a plain style object (not StyleSheet).
const dateInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  fontSize: 16, // 16px+ stops iPhones zooming in on focus
  fontFamily: "inherit",
  color: colors.ink,
  backgroundColor: colors.paper,
  border: `1px solid ${colors.line}`,
  borderRadius: 8,
};

export default function FilterPanel({
  categories,
  category,
  setCategory,
  buildings,
  location,
  setLocation,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) {
  const clearFilters = () => {
    setCategory("All");
    setLocation("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Filters</Text>

      <Text style={styles.label}>Category</Text>
      <CategoryChips
        categories={categories}
        selected={category}
        onSelect={setCategory}
      />

      <Text style={styles.label}>Location</Text>
      <BuildingPicker
        buildings={buildings}
        selected={location}
        onSelect={setLocation}
      />
      <Text style={styles.label}>Date found</Text>
      <View style={styles.dates}>
        <DateField label="From" value={dateFrom} onChange={setDateFrom} max={dateTo || today()} />
        <DateField label="To" value={dateTo} onChange={setDateTo} min={dateFrom} max={today()} />
      </View>

      <Pressable style={styles.clearButton} onPress={clearFilters}>
        <Text style={styles.clearText}>Clear filters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.paper,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dates: { flexDirection: "row", gap: spacing.sm },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 13, color: colors.slate, marginBottom: spacing.xs },
  clearButton: {
    marginTop: spacing.md,
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.mist,
  },
  clearText: {
    color: colors.accent,
    fontWeight: "600",
  },
});
