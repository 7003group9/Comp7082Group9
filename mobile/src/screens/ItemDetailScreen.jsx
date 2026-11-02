import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: load GET /items/:id, show the public description, then the
// claim form with the finder's private questions (fetched only after login).
export default function ItemDetailScreen({ route }) {
  const { id, title, location, latitude, longitude } = route.params;
  return (
    <View style={styles.screen}>
      <Text style={type.heading}>{title}</Text>
      <Text style={[type.meta, { marginTop: spacing.sm }]}>Item No. {id}</Text>
      {location ? <Text style={[type.body, { marginTop: spacing.md }]}>Found at: {location}</Text> : null}
      {latitude != null ? (
        <Pressable
          onPress={() => Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>View on map</Text>
        </Pressable>
      ) : null}
      <Text style={[type.body, { marginTop: spacing.lg }]}>Claim form goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md },
  link: { color: colors.teal, fontWeight: '600', marginTop: spacing.sm },
});
