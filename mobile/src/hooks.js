// Small hooks shared by several screens.
import { useCallback, useContext, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPhotoUrl } from './api/client';
import { AuthContext } from './context/AuthContext';

// An item's photo as a uri for <Image>, or null while loading / if it has none.
// The server decides clear or blurred from the login, so this sends the token.
// The blob URL is freed when the component goes away.
export function usePhoto(itemId, hasPhoto) {
  const { user } = useContext(AuthContext);
  const [uri, setUri] = useState(null);
  useEffect(() => {
    if (!hasPhoto) return;
    let url = null;
    let cancelled = false;
    fetchPhotoUrl(itemId, user?.token)
      .then((u) => {
        if (cancelled) return URL.revokeObjectURL(u); // the screen closed while it loaded
        url = u;
        setUri(u);
      })
      .catch(() => {}); // no photo is better than an error on a card
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [itemId, hasPhoto, user?.token]);
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
// load must be stable (wrap it in useCallback). Returns { list, setList, loading, error, setError }.
export function useFocusList(load) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      setError('');
      load()
        .then(setList)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, [load])
  );
  return { list, setList, loading, error, setError };
}
