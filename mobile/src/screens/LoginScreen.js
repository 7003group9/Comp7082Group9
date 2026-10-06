import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: school email + password (or SSO), POST /auth/login.
export default function LoginScreen() {
  return (
    <View style={styles.screen}>
      <Text style={type.heading}>Log in with your school email</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md, justifyContent: 'center' },
});
