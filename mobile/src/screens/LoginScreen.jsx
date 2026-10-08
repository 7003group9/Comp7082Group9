import { useContext, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { requestCode, verifyCode } from "../api/client";
import { colors, spacing, type } from "../theme";

// Two-step login: enter student email -> enter the code emailed to it.
export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false); // false = step 1, true = step 2
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Runs an async step, showing any error and blocking double taps.
  async function run(step) {
    setError("");
    setBusy(true);
    try {
      await step();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      // The server checks the student-email domain; it only sends a code if valid.
      await requestCode(email.trim().toLowerCase());
      setCodeSent(true);
    });

  const submitCode = () =>
    run(async () => {
      const { token, user } = await verifyCode(email.trim().toLowerCase(), code);
      login({ ...user, token });
      navigation.replace("Home");
    });

  return (
    <View style={styles.screen}>
      <Text style={type.title}>Campus Claim</Text>
      <Text style={styles.hint}>
        {codeSent
          ? `We emailed a 6-digit code to ${email.trim()}.`
          : "Enter your student email and we'll email you a login code."}
      </Text>

      {codeSent ? (
        <>
          <Text style={styles.label}>Code</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Student email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@my.bcit.ca"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, busy && styles.disabled]}
        onPress={codeSent ? submitCode : sendCode}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{codeSent ? "Log in" : "Email me a code"}</Text>
      </Pressable>

      {codeSent ? (
        <Pressable
          onPress={() => {
            setCodeSent(false);
            setCode("");
            setError("");
          }}
        >
          <Text style={styles.link}>Use a different email</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
    padding: spacing.md,
    justifyContent: "center",
  },
  hint: { ...type.meta, marginTop: spacing.sm, marginBottom: spacing.lg },
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
  error: { color: "#B00020", marginBottom: spacing.md },
  button: {
    backgroundColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.paper },
  link: {
    color: colors.teal,
    textAlign: "center",
    marginTop: spacing.md,
    fontWeight: "600",
  },
});
