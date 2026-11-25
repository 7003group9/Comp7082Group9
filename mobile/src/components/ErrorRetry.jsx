import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type, ui } from '../theme';

// Shown when something failed to load: what went wrong and a "Try again" button.
// onRetry can return a promise; the button says "Trying..." until it settles.
export default function ErrorRetry({ message, onRetry, style }) {
  const [trying, setTrying] = useState(false);
  async function retry() {
    setTrying(true);
    try {
      await onRetry();
    } finally {
      setTrying(false);
    }
  }
  return (
    <View style={[styles.box, style]} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={({ pressed }) => [ui.smallButton, pressed && ui.pressed]}
        onPress={retry}
        disabled={trying}
        accessibilityRole="button"
      >
        <Text style={ui.smallButtonText}>{trying ? 'Trying...' : 'Try again'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...ui.card, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  message: { ...type.body, color: colors.danger },
});
