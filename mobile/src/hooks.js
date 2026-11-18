// Small hooks shared by several screens.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

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
