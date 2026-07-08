import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import VenueForm from '../components/VenueForm';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

// Deployed API URL using vercel
const API_URL = 'https://happymapper.vercel.app';
export default function UploadMenuScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [loadingPicker, setLoadingPicker] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 🌀 Spinner animation setup
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (uploading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [uploading]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return () => fadeAnim.stopAnimation();
    }, [fadeAnim])
  );

  // Preflight permissions to reduce delay on first open
  useEffect(() => {
    (async () => {
      try {
        const [cam, lib] = await Promise.all([
          ImagePicker.getCameraPermissionsAsync(),
          ImagePicker.getMediaLibraryPermissionsAsync(),
        ]);
        await Promise.all([
          cam.status === 'undetermined' ? ImagePicker.requestCameraPermissionsAsync() : Promise.resolve(),
          lib.status === 'undetermined' ? ImagePicker.requestMediaLibraryPermissionsAsync() : Promise.resolve(),
        ]);
      } catch (e) {
        // Ignore; permission requests will be retried on action
      }
    })();
  }, []);

  // 📸 Take photo using native camera
  const takePhoto = async () => {
    setLoadingPicker('Opening camera...');
    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera permission');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setUploadedDocId(null);
      }
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Failed to open camera');
    } finally {
      setLoadingPicker(null);
    }
  };

  // 🖼 Pick image from gallery
  const pickImage = async () => {
    setLoadingPicker('Opening gallery...');
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permission needed', 'Please grant media library permission');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setUploadedDocId(null);
      }
    } catch (e: any) {
      Alert.alert('Gallery error', e?.message ?? 'Failed to open gallery');
    } finally {
      setLoadingPicker(null);
    }
  };

  // 🏠 Handle form submission
  const handleVenueSubmit = async (venueData: any) => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select or take a menu image first');
      return;
    }

    setUploading(true);
    console.log('Starting upload...');
    console.log('API URL:', API_URL);
    console.log('Venue Data:', venueData);

    try {
      const formData = new FormData();
      formData.append('venue_name', venueData.venue_name);
      formData.append('venue_address', JSON.stringify(venueData.address));

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('image', blob, 'menu.jpg');
      } else {
        const filename = selectedImage.split('/').pop() || 'menu.jpg';
        const fileType = filename.split('.').pop();

        // @ts-ignore
        formData.append('image', {
          uri: selectedImage,
          name: filename,
          type: `image/${fileType}`,
        });
      }

      const uploadResponse = await fetch(`${API_URL}/upload-deal`, {
        method: 'POST',
        body: formData,
      });

      const rawBody = await uploadResponse.text();
      let result: any = null;
      try {
        result = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        const preview = rawBody?.slice(0, 120) || 'No response body';
        throw new Error(`Server returned non-JSON (${uploadResponse.status}): ${preview}`);
      }

      if (!uploadResponse.ok) {
        throw new Error(result?.error || `Upload failed (${uploadResponse.status})`);
      }
      if (result.success) {
        setUploadedDocId(result.document_id);

        // Track this deal in user's addedDeals array if user is authenticated
        const currentUser = auth().currentUser;
        if (currentUser) {
          try {
            const userRef = firestore().collection('user_data').doc(currentUser.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
              // Create user document if it doesn't exist (e.g., guest user who later authenticates)
              await userRef.set({
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                createdAt: firestore.FieldValue.serverTimestamp(),
                lastLoginAt: firestore.FieldValue.serverTimestamp(),
                provider: currentUser.providerData[0]?.providerId || 'unknown',
                addedDeals: [result.document_id],
                savedDeals: [],
              });
            } else {
              // Update existing document
              await userRef.update({
                addedDeals: firestore.FieldValue.arrayUnion(result.document_id),
              });
            }
            console.log(`Added deal ${result.document_id} to user ${currentUser.uid}'s addedDeals`);
          } catch (error) {
            console.error('Error updating user addedDeals:', error);
            // Don't fail the entire upload if tracking fails
          }
        }

        Alert.alert(
          'Success!',
          `Menu uploaded successfully!\nThanks for sharing!`,
          [
            {
              text: 'Upload Another',
              onPress: () => {
                setSelectedImage(null);
                setUploadedDocId(null);
              },
            },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Failed to upload: ${error.message || 'Check your connection and try again.'}`);
    } finally {
      setUploading(false);
    }
  };

  // 🌀 Show animated spinner while uploading
  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
          <Text style={styles.spinnerText}>⏳</Text>
        </Animated.View>
        <Text style={styles.loadingText}>Uploading deal data...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>HappyMapper</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Deal</Text>
          <Text style={styles.subtitle}>Capture the menu to add deals</Text>
        </View>

        {!selectedImage ? (
          <View style={styles.uploadSection}>
            {loadingPicker ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator size="large" color="#E8886B" />
                <Text style={styles.pickerLoadingText}>{loadingPicker}</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
                  <Text style={styles.cameraIcon}>📷</Text>
                  <Text style={styles.buttonText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                  <Text style={styles.galleryIcon}>🖼️</Text>
                  <Text style={styles.buttonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.previewSection}>
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage }} style={styles.image} />
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.changeButtonText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <VenueForm onSubmit={handleVenueSubmit} />
            </View>
          </View>
        )}

        {uploadedDocId && (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Deal Added Successfully!</Text>
            <Text style={styles.docIdText}>ID: {uploadedDocId}</Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F5EBE0',
  },
  headerBar: {
    backgroundColor: '#F5EBE0',
    paddingTop: 50,
    paddingBottom: 15,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#D6453B',
    letterSpacing: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5EBE0',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#E8886B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#A67B5B',
    lineHeight: 24,
    textAlign: 'center',
  },
  uploadSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 1,
  },
  pickerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
  },
  pickerLoadingText: {
    color: '#E8886B',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 15,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: '#E8886B',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#D4A08B',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  galleryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSection: {
    gap: 20,
  },
  imagePreview: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 4,
  },
  image: {
    width: '100%',
    height: 350,
    resizeMode: 'cover',
  },
  changeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4EAE1',
  },
  spinner: {
    marginBottom: 15,
  },
  spinnerText: {
    fontSize: 40,
  },
  loadingText: {
    color: '#F57C00',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  successContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 1,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#E8886B',
  },
  successIcon: {
    fontSize: 60,
    color: '#E8886B',
    marginBottom: 10,
  },
  successText: {
    color: '#E8886B',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  docIdText: {
    color: '#A67B5B',
    fontSize: 14,
    textAlign: 'center',
  },
});
