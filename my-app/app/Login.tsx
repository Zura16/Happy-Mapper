import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import CheerModal from '../components/CheerModal';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '122197808815-hbnkec1t6hi9og08blonscociahij130.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [celebration, setCelebrationState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    nextRoute: string | null;
  }>({ visible: false, title: '', message: '', nextRoute: null });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const saveUserToFirestore = async (user: any) => {
    try {
      const userRef = firestore().collection('user_data').doc(user.uid);

      // Use set with merge to create or update the document
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
        provider: user.providerData[0]?.providerId || 'unknown',
      }, { merge: true });

      // If this is a new user (no createdAt field), add it
      const userDoc = await userRef.get();
      if (!userDoc.data()?.createdAt) {
        await userRef.set({
          createdAt: firestore.FieldValue.serverTimestamp(),
          addedDeals: [],
          savedDeals: [],
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error saving user to Firestore:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      console.log('Google Sign-In response:', JSON.stringify(response, null, 2));

      // For @react-native-google-signin/google-signin v16+, the structure is response.data
      let idToken = response?.data?.idToken || response?.idToken;

      if (!idToken) {
        console.error('Response structure:', response);
        throw new Error('No ID token received from Google Sign-In. Check console for details.');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      await saveUserToFirestore(userCredential.user);

      showCelebration('Cheers! 🍹', `Welcome aboard, ${userCredential.user.displayName || 'friend'}!`, '/Map');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);

      // Handle user cancellation
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '-5') {
        console.log('User cancelled the sign-in flow');
        return;
      }

      // Handle other errors
      const errorMessage = error?.message || 'Failed to sign in with Google. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    // Trim inputs
    const trimmedEmail = email.trim();

    // Validation
    if (!trimmedEmail || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      // Sign in with Firebase Auth
      const userCredential = await auth().signInWithEmailAndPassword(trimmedEmail, password);

      console.log('User signed in:', userCredential.user.uid);

      // Update last login time in Firestore
      await saveUserToFirestore(userCredential.user);

      showCelebration('Cheers! 🍻', `Great to see you again, ${userCredential.user.displayName || 'friend'}!`, '/Map');
    } catch (error: any) {
      console.error('Login Error:', error);

      let errorMessage = 'Failed to sign in. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const showCelebration = (title: string, message: string, route: string) => {
    setCelebrationState({
      visible: true,
      title,
      message,
      nextRoute: route,
    });
  };

  const handleCelebrationClose = () => {
    const route = celebration.nextRoute;
    setCelebrationState({ visible: false, title: '', message: '', nextRoute: null });
    if (route) {
      router.replace(route);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>happy{'\n'}mapper</Text>
          <Text style={styles.subtitle}>Find deals all day, every day</Text>
        </View>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#A67B5B"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#A67B5B"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OR</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#E8886B" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/Signup')}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
        <CheerModal
          visible={celebration.visible}
          title={celebration.title}
          message={celebration.message}
          onClose={handleCelebrationClose}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EBE0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    fontSize: 48,
    fontWeight: '300',
    color: '#E8886B',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#A67B5B',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A67B5B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  loginButton: {
    backgroundColor: '#E8886B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8D5C4',
  },
  separatorText: {
    color: '#A67B5B',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 15,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8886B',
    marginRight: 10,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  signUpText: {
    color: '#A67B5B',
    fontSize: 16,
  },
  signUpLink: {
    color: '#E8886B',
    fontSize: 16,
    fontWeight: '700',
  },
});
