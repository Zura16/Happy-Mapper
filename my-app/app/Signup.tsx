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

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  // Password requirements status
  const getPasswordRequirements = (password: string) => {
    return {
      length: password.length >= 8,
      capital: /[A-Z]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  const requirements = getPasswordRequirements(password);

  const saveUserToFirestore = async (user: any, customDisplayName?: string) => {
    try {
      if (!user || !user.uid) {
        console.error('Invalid user object:', user);
        throw new Error('Invalid user object');
      }

      const userRef = firestore().collection('user_data').doc(user.uid);

      // Get provider info safely
      let provider = 'email';
      if (user.providerData && user.providerData.length > 0 && user.providerData[0]) {
        provider = user.providerData[0].providerId || 'email';
      }

      // Create complete user data object
      const userData = {
        uid: user.uid,
        email: user.email || '',
        displayName: customDisplayName || user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
        provider: provider,
        addedDeals: [],
        savedDeals: [],
      };

      console.log('Saving user data to Firestore:', userData);

      // Use set to create the document
      await userRef.set(userData, { merge: true });

      console.log('User successfully saved to Firestore');
    } catch (error) {
      console.error('Error saving user to Firestore:', error);
      throw error;
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

      showCelebration('Cheers! 🎉', `Welcome to HappyMapper, ${userCredential.user.displayName || 'friend'}!`, '/Map');
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

  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
      return {
        valid: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one capital letter',
      };
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one special character (!@#$%^&*...)',
      };
    }

    return { valid: true, message: '' };
  };

  const handleSignUp = async () => {
    // Trim all inputs
    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    // Validation
    if (!trimmedEmail || !password || !confirmPassword || !trimmedDisplayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert('Weak Password', passwordValidation.message);
      return;
    }

    setIsLoading(true);
    try {
      // Create user with email and password
      const userCredential = await auth().createUserWithEmailAndPassword(trimmedEmail, password);

      console.log('User created with Firebase Auth:', userCredential.user.uid);

      // Update display name in Firebase Auth
      await userCredential.user.updateProfile({
        displayName: trimmedDisplayName,
      });

      console.log('Display name updated in Firebase Auth');

      // Save to Firestore with custom display name
      await saveUserToFirestore(userCredential.user, trimmedDisplayName);

      // Clear form fields
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setPasswordFocused(false);

      showCelebration('Cheers! 🥂', `Welcome to HappyMapper, ${trimmedDisplayName}!`, '/Map');
    } catch (error: any) {
      console.error('Sign-Up Error:', error);

      let errorMessage = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
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
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        {/* Display Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#A67B5B"
            autoCapitalize="words"
            value={displayName}
            onChangeText={setDisplayName}
          />
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
            placeholder="Enter password"
            placeholderTextColor="#A67B5B"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          {(passwordFocused || password.length > 0) && (
            <View style={styles.requirementsContainer}>
              <View style={styles.requirementRow}>
                <Text style={requirements.length ? styles.checkMark : styles.checkMarkEmpty}>
                  {requirements.length ? '✓' : '○'}
                </Text>
                <Text style={requirements.length ? styles.requirementTextMet : styles.requirementText}>
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={requirements.capital ? styles.checkMark : styles.checkMarkEmpty}>
                  {requirements.capital ? '✓' : '○'}
                </Text>
                <Text style={requirements.capital ? styles.requirementTextMet : styles.requirementText}>
                  One capital letter
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text style={requirements.special ? styles.checkMark : styles.checkMarkEmpty}>
                  {requirements.special ? '✓' : '○'}
                </Text>
                <Text style={requirements.special ? styles.requirementTextMet : styles.requirementText}>
                  One special character (!@#$...)
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#A67B5B"
            secureTextEntry
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {/* Sign Up Button */}
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.signUpButtonText}>Create Account</Text>
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

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.signInLink}>Sign In</Text>
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
    marginBottom: 40,
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
    marginBottom: 16,
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
  signUpButton: {
    backgroundColor: '#E8886B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  signInText: {
    color: '#A67B5B',
    fontSize: 16,
  },
  signInLink: {
    color: '#E8886B',
    fontSize: 16,
    fontWeight: '700',
  },
  requirementsContainer: {
    marginTop: 8,
    paddingLeft: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkMark: {
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 6,
    fontWeight: 'bold',
  },
  checkMarkEmpty: {
    fontSize: 14,
    color: '#A67B5B',
    marginRight: 6,
  },
  requirementText: {
    fontSize: 12,
    color: '#A67B5B',
  },
  requirementTextMet: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
});
