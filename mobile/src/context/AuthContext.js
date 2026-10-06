// TODO: hold the logged-in user + token, expose login()/logout(),
// and attach the token to requests in src/api/client.js.
import { createContext } from 'react';

export const AuthContext = createContext(null);
