// App root: sets up navigation and the three screens that exist so far.
// Login, MyListings and SecurityDashboard are stubs not wired in yet.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import PostItemScreen from './src/screens/PostItemScreen';
import { colors } from './src/theme';

// Phone-width column, centred when viewed in a desktop browser.
const frame = { flex: 1, width: '100%', maxWidth: 480, marginHorizontal: 'auto' };

// Stack navigator: screens push on top of each other with a back button.
const Stack = createNativeStackNavigator();

export default function App() {
  // SafeAreaProvider lets screens avoid the notch / status bar.
  return (
    <SafeAreaProvider>
      <View style={frame}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerTintColor: colors.ink,
            headerStyle: { backgroundColor: colors.mist },
            headerShadowVisible: false,
          }}
        >
          {/* Home draws its own header, so the native one is hidden. */}
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Found item' }} />
          <Stack.Screen name="PostItem" component={PostItemScreen} options={{ title: 'Post a found item' }} />
        </Stack.Navigator>
      </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
