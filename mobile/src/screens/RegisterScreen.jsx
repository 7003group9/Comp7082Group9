import { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { registerUser } from '../api/client';
import { colors, spacing, type } from '../theme';

export default function RegisterScreen({ navigation }) {
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleRegister() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanStudentId = studentId.trim().toUpperCase();

    if (!cleanEmail.endsWith('@my.bcit.ca')) {
      setError('Please enter a valid BCIT email.');
      return;
    }

    if (!/^A0\d{7}$/.test(cleanStudentId)) {
      setError('Please enter a valid BCIT student ID.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');

    try {
      const user = await registerUser(
        cleanEmail,
        cleanStudentId,
        password
      );

      login(user);
      navigation.replace('Home');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={type.title}>Create Account</Text>

      <Text style={styles.label}>BCIT Email</Text>
      <TextInput
        style={styles.input}
        placeholder="@my.bcit.ca"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Student ID</Text>
      <TextInput
        style={styles.input}
        placeholder="A0"
        value={studentId}
        onChangeText={setStudentId}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter password again"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Create Account</Text>
      </Pressable>

      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
    padding: spacing.md,
    justifyContent: 'center',
  },

  label: {
    ...type.body,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.slate,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },

  error: {
    color: '#B00020',
    marginTop: spacing.md,
  },

  button: {
    backgroundColor: colors.teal,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.paper,
  },

  link: {
    color: colors.teal,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
  },
});