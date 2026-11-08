// App root: sets up navigation and the three screens that exist so far.

import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import ItemDetailScreen from "./src/screens/ItemDetailScreen";
import PostItemScreen from "./src/screens/PostItemScreen";
import MyListingsScreen from "./src/screens/MyListingsScreen";
import SecurityDashboardScreen from "./src/screens/SecurityDashboardScreen";
import { colors } from "./src/theme";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import { useContext } from "react";

// Phone-width column, centred when viewed in a desktop browser.
const frame = {
  flex: 1,
  width: "100%",
  maxWidth: 480,
  marginHorizontal: "auto",
};

// Stack navigator: screens push on top of each other with a back button.
const Stack = createNativeStackNavigator();
// The app is dark; tell the browser, so scrollbars and form controls match.
if (typeof document !== "undefined") document.documentElement.style.colorScheme = "dark";
// React Navigation's own colours (header, screen background) to match the app's.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.mist, card: colors.mist, text: colors.ink, primary: colors.teal, border: colors.line },
};
function AppNavigator() {
  const { user } = useContext(AuthContext);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.mist },
          headerShadowVisible: false,
        }}
      >
        {user ? (
          // Logged in: the app. Logging out (or an expired login) swaps these for Login.
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="ItemDetail"
              component={ItemDetailScreen}
              options={{ title: "Found item" }}
            />

            <Stack.Screen
              name="PostItem"
              component={PostItemScreen}
              options={{ title: "Post a found item" }}
            />

            <Stack.Screen
              name="MyListings"
              component={MyListingsScreen}
              options={{ title: "My posts" }}
            />

            {/* Campus Security only; the server also refuses everyone else. */}
            {user.role === "security" ? (
              <Stack.Screen
                name="SecurityDashboard"
                component={SecurityDashboardScreen}
                options={{ title: "Review claims" }}
              />
            ) : null}
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  // SafeAreaProvider lets screens avoid the notch / status bar.
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.mist }}>
          <View style={frame}>
            <AppNavigator />
          </View>
        </View>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
