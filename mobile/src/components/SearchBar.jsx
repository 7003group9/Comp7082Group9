import { StyleSheet, TextInput, View } from 'react-native';
import { colors, spacing } from '../theme';

// Text box for filtering the list. Controlled: parent owns the text.
// Props: value, onChangeText.
export default function SearchBar({ value, onChangeText }) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by item or place"
        placeholderTextColor={colors.slate}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search found items"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
});
