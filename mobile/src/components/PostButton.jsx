import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, ui } from '../theme';

// Big floating button pinned to the bottom of the screen ("I found something").
// Prop: onPress.
export default function PostButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, pressed && ui.pressed]}
    >
      <Text style={styles.label}>I found something</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { color: colors.onAccent, fontSize: 17, fontWeight: '700' },
});
