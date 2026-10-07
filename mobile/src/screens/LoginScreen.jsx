import { useContext, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { colors, spacing, type } from "../theme";
import { loginUser } from "../api/client";

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.endsWith("@my.bcit.ca")) {
      setError("Please enter a valid BCIT email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError("");

    try {
      const user = await loginUser(cleanEmail, password);

      login(user);
      navigation.replace("Home");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={type.title}>Campus Claim</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="@my.bcit.ca"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign in with school account</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Don't have an account? Create Account</Text>
      </Pressable>
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

  text: {
    ...type.body,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  button: {
    backgroundColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.paper,
  },
  label: {
    ...type.body,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },

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

  error: {
    color: "#B00020",
    marginBottom: spacing.md,
  },
  link: {
    color: colors.teal,
    textAlign: "center",
    marginTop: spacing.md,
    fontWeight: "600",
  },
});
