import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: items I posted + incoming claims to review.
export default function MyListingsScreen() {
  return (
    <View style={styles.screen}>
      <Text style={type.body}>My listings go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md } });
