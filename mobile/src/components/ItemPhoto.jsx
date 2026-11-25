import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { usePhoto } from '../hooks';
import { colors, spacing } from '../theme';

// An item's whole photo (never cropped), 80% wide and centred. Clear for the finder and
// Campus Security, blurred by the server for everyone else. While it loads, a placeholder
// holds its space so the screen doesn't jump; nothing shows if there's no photo or it fails.
export default function ItemPhoto({ itemId, hasPhoto = false, title }) {
  const photo = usePhoto(itemId, hasPhoto);
  const [ratio, setRatio] = useState(null); // width / height, once known

  // The photo's real shape, so the height fits it instead of cropping to a square.
  useEffect(() => {
    if (photo) Image.getSize(photo, (w, h) => setRatio(w / h), () => setRatio(4 / 3));
  }, [photo]);

  if (!hasPhoto || photo === false) return null;
  if (!photo || !ratio) {
    return (
      <View style={[styles.photo, styles.placeholder]} accessibilityLabel="Loading photo">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Image source={{ uri: photo }} style={[styles.photo, { aspectRatio: ratio }]} accessibilityLabel={`Photo of ${title}`} />;
}

const styles = StyleSheet.create({
  photo: { width: '80%', alignSelf: 'center', borderRadius: 16, marginTop: spacing.lg },
  // Most phone photos are 4:3, so the real photo usually lands in the same space.
  placeholder: { aspectRatio: 4 / 3, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
