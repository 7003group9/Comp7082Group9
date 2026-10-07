import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: load GET /items/:id, show the public description, then the
// claim form with the finder's private questions (fetched only after login).
export default function ItemDetailScreen({ route }) {
  return (
    <View style={styles.screen}>
      <Text style={type.heading}>{route.params.title}</Text>
      <Text style={[type.meta, { marginTop: spacing.sm }]}>Item No. {route.params.id}</Text>
      <Text style={[type.body, { marginTop: spacing.lg }]}>Claim form goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md },
});
