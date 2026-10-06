import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: security staff only: sensitive items + log handoffs.
export default function SecurityDashboardScreen() {
  return (
    <View style={styles.screen}>
      <Text style={type.body}>Security dashboard goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md } });
