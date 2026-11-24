import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { usePhoto } from '../hooks';
import { spacing } from '../theme';

// An item's whole photo (never cropped), 80% wide and centred. Clear for the finder and
// Campus Security, blurred by the server for everyone else. Shows nothing until it has
// loaded, or at all if the item has no photo.
export default function ItemPhoto({ itemId, hasPhoto = true, title }) {
  const photo = usePhoto(itemId, hasPhoto);
  const [ratio, setRatio] = useState(null); // width / height, once known

  // The photo's real shape, so the height fits it instead of cropping to a square.
  useEffect(() => {
    if (photo) Image.getSize(photo, (w, h) => setRatio(w / h), () => {});
  }, [photo]);

  if (!photo || !ratio) return null;
  return <Image source={{ uri: photo }} style={[styles.photo, { aspectRatio: ratio }]} accessibilityLabel={`Photo of ${title}`} />;
}

const styles = StyleSheet.create({
  photo: { width: '80%', alignSelf: 'center', borderRadius: 16, marginTop: spacing.lg },
});
