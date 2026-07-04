import { Tabs, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firebase from '@react-native-firebase/app';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FavoritesProvider } from '../src/favorites';

// Initialize Firebase.
// This should only be done once, at the root of your application.
if (firebase.apps.length === 0) {
  console.log('Initializing Firebase...');
  firebase.initializeApp();
} else {
  console.log('Firebase already initialized.');
}

export default function TabLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isIndexScreen = pathname === '/' || pathname === '/index';
  const isLoginScreen = pathname === '/Login';
  const isSignUpScreen = pathname === '/Signup';

  return (
    <FavoritesProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8D5C4',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 8,
          height: Platform.OS === 'android' ? 65 + insets.bottom : 65,
          display: (isIndexScreen || isLoginScreen || isSignUpScreen) ? 'none' : 'flex',
        },
        tabBarActiveTintColor: '#E8886B',
        tabBarInactiveTintColor: '#A67B5B',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="Map"
        options={{
          title: 'Map',
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Favorites"
        options={{
          title: 'Favorites',
          tabBarLabel: 'Favorites',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="SearchAndUpload"
        options={{
          title: 'Add Deal',
          tabBarLabel: 'Add Deal',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'camera-plus' : 'camera-plus-outline'}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="SearchList"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="SearchAndUpload"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="UploadDeal"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="upload-deal"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="Splash"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="MainScreen"
        options={{
          href: null, // This hides the tab
        }}
      />
       <Tabs.Screen
        name="Login"
        options={{
          href: null, // This hides the tab
        }}
      />
      <Tabs.Screen
        name="Signup"
        options={{
          href: null, // This hides the tab
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null, // This hides the tab
        }}
      />

    </Tabs>
    </FavoritesProvider>
  );
}
