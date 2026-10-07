import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

// TODO: form with a general description, location, category and the
// private questions only the owner could answer.
export default function PostItemScreen() {
  return (
    <View style={styles.screen}>
      <Text style={type.body}>Post a found item form goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist, padding: spacing.md },
});
