import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  AppState,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const PLACES_KEY = Constants.expoConfig?.extra?.googlePlacesKey;
const API_URL = 'https://happymapper.vercel.app';

export default function SearchAndUpload() {
  const [apiKey] = useState(String(PLACES_KEY || ""));
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [loadingPicker, setLoadingPicker] = useState<string | null>(null);
  const [galleryInProgress, setGalleryInProgress] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [prewarmCamera, setPrewarmCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const appStateRef = useRef(AppState.currentState);


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
      } catch {
        // Ignore; permissions will be requested on action
      }
    })();
  }, []);

  // Some Android gallery pickers may not always resolve on cancel.
  // Clear transient loading state when app returns to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
      if (wasBackground && nextState === 'active' && galleryInProgress) {
        setGalleryInProgress(false);
        setLoadingPicker(null);
      }
    });
    return () => {
      sub.remove();
    };
  }, [galleryInProgress]);

  // Get user location for form
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log("Did not get user's location, using default in LA")
        setUserLocation({lon: -118.243683, lat: 34.052235});
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({ 
        lon: location.coords.longitude,
        lat: location.coords.latitude, 
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setUserLocation({ lon: -118.243683, lat: 34.052235 });
    }
  };

  const openCamera = async () => {
    setLoadingPicker('Cooking...');
    try {
      if (!cameraPermission?.granted) {
        const req = await requestCameraPermission();
        if (!req.granted) {
          Alert.alert('Permission needed', 'Please grant camera permission');
          return;
        }
      }
      setPrewarmCamera(true);
      setShowCamera(true);
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Failed to open camera');
    } finally {
      setLoadingPicker(null);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        skipProcessing: true,
      });
      if (photo?.uri) {
        setSelectedImage(photo.uri);
        setShowCamera(false);
      }
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Failed to take photo');
    }
  };

  // Pick image from gallery
const pickImage = async () => {
  setLoadingPicker('Cooking...');
  setShowCamera(false);
  setGalleryInProgress(true);
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
        quality: 0.45,
        exif: false,
      });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setSelectedImage(uri);
    } else {
      setSelectedImage(null);
      setShowCamera(false);
    }
    } catch (e: any) {
      Alert.alert('Gallery error', e?.message ?? 'Failed to open gallery');
    } finally {
      setGalleryInProgress(false);
      setLoadingPicker(null);
    }
  };

  // Parse Google Places response into VenueFormData format
  const parseVenueData = (placeData) => {
    const venue_name = placeData.structured_formatting?.main_text || placeData.description || '';
    const addressComponents = placeData.terms || [];
    
    // Extract address components from terms array
    let street = '';
    let city = '';
    let state = '';
    let zip = '';

    // Try to extract from structured data first
    if (placeData.description) {
      const addressParts = placeData.description.split(', ');
      if (addressParts.length >= 3) {
        street = addressParts[0] || '';
        city = addressParts[1] || '';
        const stateZip = addressParts[2]?.split(' ') || [];
        state = stateZip[0] || '';
        zip = stateZip[1] || '';
      }
    }

    // Fallback to terms array if description parsing fails
    if (!street && addressComponents.length > 0) {
      street = addressComponents[0].value || '';
    }
    if (!city && addressComponents.length > 1) {
      city = addressComponents[addressComponents.length - 3]?.value || '';
    }
    if (!state && addressComponents.length > 2) {
      state = addressComponents[addressComponents.length - 2]?.value || '';
    }
    if (!zip && addressComponents.length > 1) {
      zip = addressComponents[addressComponents.length - 1]?.value || '';
    }

    return {
      venue_name,
      address: {
        street,
        city,
        state,
        zip
      }
    };
  };

  // Handles submit 
  const handleSubmit = async () => {
    if (!selectedVenue) {
      Alert.alert('Error', 'Please select a venue first');
      return;
    }

    if (!selectedImage) {
      Alert.alert('Error', 'Please take or select a menu image');
      return;
    }

    setUploading(true);

    try {
      // Parse venue data into correct format
      const venueData = parseVenueData(selectedVenue);
      console.log('Parsed venue data:', venueData);

      const formData = new FormData();
      formData.append('venue_name', venueData.venue_name);
      formData.append('venue_address', JSON.stringify(venueData.address));

      // Add image
      const filename = selectedImage.split('/').pop() || 'menu.jpg';
      const fileType = filename.split('.').pop();
      formData.append('image', {
        uri: selectedImage,
        name: filename,
        type: `image/${fileType}`,
      });

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
        // Track in user's addedDeals
        const currentUser = auth().currentUser;
        if (currentUser) {
          try {
            const userRef = firestore().collection('user_data').doc(currentUser.uid);
            await userRef.update({
              addedDeals: firestore.FieldValue.arrayUnion(result.document_id),
            });
          } catch (error) {
            console.error('Error tracking user deal:', error);
          }
        }

        Alert.alert(
          'Success!',
          'Deal uploaded successfully!\nThanks for sharing!',
          [
            {
              text: 'Upload Another',
              onPress: () => {
                setSelectedVenue(null);
                setSelectedImage(null);
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

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8886B" />
        <Text style={styles.loadingText}>Image is uploading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.screen}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Add Deal at Venue</Text>
      </View>

      <View style={styles.body}>
        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Venue</Text>
          <View style={styles.searchBlock}>
            <Ionicons name="search" size={20} color="#E8886B" style={styles.searchIcon} />
            <GooglePlacesAutocomplete
              placeholder="Search for venues..."
              fetchDetails
              onPress={(data, details = null) => {
                console.log("Selected:", data);
                console.log("Details:", details);
                setSelectedVenue(data);
                if (!userLocation) {
                  getCurrentLocation();
                }
              }}
              onFail={(error) => {
                console.log("Places API Error:", error)
                Alert.alert('Search Error', 'Could not search for venues. Please try again.');
              }}
              onNotFound={() => console.log("No results found")}
              query={{
                key: apiKey,
                language: "en",
                types: "establishment",
                components: "country:us",
              }}
              enablePoweredByContainer={false}
              keyboardShouldPersistTaps="handled"
              listViewDisplayed="auto"
              debounce={300}
              minLength={2}
              styles={{
                container: { flex: 0 },
                textInputContainer: {
                  backgroundColor: "transparent",
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  padding: 0,
                },
                textInput: {
                  height: 52,
                  borderRadius: 12,
                  fontSize: 16,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#ddd",
                  color: "#333",
                  paddingLeft: 44,
                  paddingRight: 14,
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 2,
                },
                listView: {
                  position: "absolute",
                  top: 60,
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#eee",
                  elevation: 3,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  zIndex: 9999,
                  overflow: "hidden",
                },
                row: {
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  backgroundColor: "#fff",
                  flexDirection: "row",
                  alignItems: "center",
                },
                separator: {
                  height: 1,
                  backgroundColor: "#f0f0f0",
                },
                description: {
                  fontSize: 15,
                  color: "#333",
                },
              }}
              renderRow={(data) => {
                const primary =
                  data.structured_formatting?.main_text ||
                  data.description ||
                  data.name ||
                  "";

                const secondary =
                  data.structured_formatting?.secondary_text || "";

                return (
                  <View style={styles.rowInner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.primaryText} numberOfLines={1}>
                        {primary}
                      </Text>
                      {!!secondary && (
                        <Text style={styles.secondaryText} numberOfLines={1}>
                          {secondary}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </View>
                );
              }}
            />
          </View>
          
          {selectedVenue && (
            <View style={styles.selectedVenue}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.selectedVenueText}>
                {selectedVenue.structured_formatting?.main_text || selectedVenue.description}
              </Text>
            </View>
          )}
        </View>

        {/* Image Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Upload Menu Image</Text>
          
          {!selectedImage ? (
            <View style={styles.imageUploadSection}>
              {prewarmCamera && (
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraPrewarm}
                  facing={cameraFacing}
                  flash={flashMode}
                />
              )}
              {!showCamera ? (
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
                    <Text style={styles.cameraIcon}>📷</Text>
                    <Text style={styles.buttonText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                    <Text style={styles.galleryIcon}>🖼️</Text>
                    <Text style={styles.buttonText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraWrap}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.cameraPreview}
                    facing={cameraFacing}
                    flash={flashMode}
                  />
                  <View style={styles.cameraTopControls}>
                    <TouchableOpacity
                      style={styles.cameraTopButton}
                      onPress={() => setFlashMode((prev) => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'))}
                    >
                      <Ionicons
                        name={flashMode === 'off' ? 'flash-off' : flashMode === 'on' ? 'flash' : 'flash-outline'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.cameraTopText}>{flashMode.toUpperCase()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cameraTopButton}
                      onPress={() => setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
                    >
                      <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
                      <Text style={styles.cameraTopText}>Flip</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.cameraControls, { bottom: 72 + insets.bottom }]}>
                    <TouchableOpacity style={styles.cameraControlButton} onPress={() => setShowCamera(false)}>
                      <Text style={styles.cameraControlText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
                      <View style={styles.shutterOuter}>
                        <View style={styles.shutterInner} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.imagePreview}>
              <Text style={styles.imageLabel}>Menu Image:</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.imagePreviewCard}
                  onPress={() => setImageModalVisible(true)}
                >
                <View style={styles.imageContainer}>
                  <Text style={styles.imageFileName}>{selectedImage.split('/').pop()}</Text>
                  <TouchableOpacity
                    style={styles.changeImageButton}
                    onPress={() => {
                      setSelectedImage(null);
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#E8886B" />
                    <Text style={styles.changeImageText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.imageThumbRow}>
                  <Ionicons name="image" size={18} color="#E8886B" />
                  <Text style={styles.imageTapHint}>Tap to view full photo</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            (!selectedVenue || !selectedImage) && styles.submitButtonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={!selectedVenue || !selectedImage || uploading}
        >
          <Ionicons name="cloud-upload" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>Submit Deal</Text>
        </TouchableOpacity>
      </View>
      <Modal
        animationType="fade"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setImageModalVisible(false)}>
          <View style={styles.imageModalContent}>
            <Ionicons
              name="close-circle"
              size={34}
              color="#FFFFFF"
              style={styles.imageModalClose}
            />
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.imageModalImage} resizeMode="contain" />
            )}
          </View>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!loadingPicker}
      >
        <View style={styles.galleryOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.galleryOverlayText}>{loadingPicker}</Text>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5EBE0",
  },
  headerBar: {
    paddingTop: 50,
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "500",
    color: "#E8886B",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  searchBlock: {
    position: "relative",
    zIndex: 1000,
    elevation: 1000,
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 16,
    zIndex: 20,
    pointerEvents: "none",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  primaryText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  secondaryText: {
    marginTop: 2,
    fontSize: 13,
    color: "#777",
  },
  selectedVenue: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  selectedVenueText: {
    fontSize: 14,
    color: "#2E7D32",
    fontWeight: "500",
  },
  imageUploadSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 1,
  },
  cameraPrewarm: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  cameraWrap: {
    width: '100%',
    height: 460,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraTopControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  cameraTopText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  cameraControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  cameraControlButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  cameraControlText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  shutterButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shutterInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
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
  imagePreview: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  imagePreviewCard: {
    marginTop: 6,
  },
  imageLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  imageContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  imageThumbRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageTapHint: {
    fontSize: 12,
    color: '#666',
  },
  imageFileName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  changeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 6,
  },
  changeImageText: {
    fontSize: 12,
    color: "#E8886B",
    fontWeight: "500",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '94%',
    height: '84%',
  },
  imageModalClose: {
    position: 'absolute',
    top: 30,
    right: 18,
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  galleryOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8886B",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#CCC",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5EBE0",
    gap: 16,
  },
  loadingText: {
    color: "#E8886B",
    fontSize: 18,
    fontWeight: "600",
  },
});
