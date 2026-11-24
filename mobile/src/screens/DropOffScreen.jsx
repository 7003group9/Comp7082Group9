import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, type, ui } from "../theme";

export default function DropOffScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Item posted successfully!</Text>

        <Text style={styles.heading}>Drop-off location</Text>
        <Text style={type.body}>Security Desk — SW1</Text>

        <Text style={styles.heading}>Instructions</Text>
        <Text style={type.body}>
          Bring the found item to the security desk in SW1 and let security
          staff know you've posted it on CampusClaim.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && ui.pressed]}
          onPress={() => navigation.navigate("Home")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...type.title,
    marginBottom: spacing.xl,
  },
  heading: {
    ...type.heading,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonText: {
    color: colors.onAccent,
    fontWeight: "600",
    fontSize: 16,
  },
});
