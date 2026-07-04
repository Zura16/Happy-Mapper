import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';

export default function StartupScreen() {
  const router = useRouter();

  // if the user is logged in, go straight to the /map screen
  useEffect(() => {
    let isActive = true;
    const startedAt = Date.now();

    const unsubscribe = auth().onAuthStateChanged(user => {
      const target = user ? '/Map' : '/Login';
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, 3000 - elapsed);

      setTimeout(() => {
        if (isActive) {
          router.replace(target);
        }
      }, delay);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>happy{'\n'}mapper</Text>
        <Text style={styles.tagline}>all day, every day</Text>
      </View>
      <View style={styles.loader}>
        <Text style={styles.loadingText}>Cooking…</Text>
        <ActivityIndicator color="#D6453B" size="small" style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EBE0',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#F7E8DE',
    borderRadius: 24,
    paddingVertical: 60,
    paddingHorizontal: 50,
    borderWidth: 2,
    borderColor: '#E0C5B1',
    alignItems: 'center',
    shadowColor: '#C68C75',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  logo: {
    fontSize: 48,
    fontWeight: '500',
    color: '#D6453B',
    textAlign: 'center',
    lineHeight: 54,
    letterSpacing: 4,
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
    textShadowColor: 'rgba(214, 69, 59, 0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#A67B5B',
    marginTop: 12,
    textAlign: 'center',
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  loadingText: {
    color: '#A67B5B',
    fontSize: 14,
    marginRight: 8,
  },
  spinner: {
    marginLeft: 4,
  },
});
