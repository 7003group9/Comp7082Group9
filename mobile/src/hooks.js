// Small hooks shared by several screens.
import { useCallback, useContext, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPhotoUrl } from './api/client';
import { AuthContext } from './context/AuthContext';

// An item's photo as a uri for <Image>: null while loading (or if it has none), false if it failed to load.
// The server decides clear or blurred from the login, so this sends the token.
// The blob URL is freed when the component goes away. thumb: the small copy, for cards.
export function usePhoto(itemId, hasPhoto, thumb = false) {
  const { user } = useContext(AuthContext);
  const [uri, setUri] = useState(null);
  useEffect(() => {
    if (!hasPhoto) return;
    let url = null;
    let cancelled = false;
    fetchPhotoUrl(itemId, user?.token, thumb)
      .then((u) => {
        if (cancelled) return URL.revokeObjectURL(u); // the screen closed while it loaded
        url = u;
        setUri(u);
      })
      .catch(() => !cancelled && setUri(false)); // no photo is better than an error on a card
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [itemId, hasPhoto, user?.token, thumb]);
  return uri;
}

// "Tap again to confirm": [armed, setArmed]. Set armed to a key (e.g. an item id)
// on the first tap and act on the second. It lapses after 4 seconds, so a stray
// tap much later can't act.
export function useConfirm() {
  const [armed, setArmed] = useState(null);
  useEffect(() => {
    if (armed === null) return;
    const timer = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return [armed, setArmed];
}

// A list loaded from the server every time the screen is shown.
// load must be stable (wrap it in useCallback). Returns { list, setList, loading, error,
// setError, failed, reload }: failed means the list itself didn't load (show Try again).
export function useFocusList(load) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false); // the list itself didn't load (show Try again)
  const reload = useCallback(() => {
    setError('');
    setFailed(false);
    return load()
      .then(setList)
      .catch((e) => {
        setError(e.message);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  return { list, setList, loading, error, setError, failed, reload };
}
