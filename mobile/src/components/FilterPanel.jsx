import { StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { colors, spacing } from "../theme";
import CategoryChips from "./CategoryChips";
import BuildingPicker from "./BuildingPicker";
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
      <Text style={styles.label}>Date range</Text>

      <TextInput
        style={styles.input}
        placeholder="From (YYYY-MM-DD)"
        placeholderTextColor={colors.placeholder}
        value={dateFrom}
        onChangeText={setDateFrom}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="To (YYYY-MM-DD)"
        placeholderTextColor={colors.placeholder}
        value={dateTo}
        onChangeText={setDateTo}
        autoCapitalize="none"
      />

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
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.sm,
    color: colors.ink,
  },
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
