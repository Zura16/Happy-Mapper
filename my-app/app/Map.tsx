import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Text, TextInput, TouchableOpacity, Platform, Dimensions, Animated, PanResponder, FlatList, Keyboard, Modal } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFavorites } from '../src/favorites';

// Minimal local types
type Deal = {
  name?: string;
  description?: string | null;
  days?: string[];
  start_time?: string;
  end_time?: string;
};

type Venue = {
  venue_id: string;
  venue_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | Record<string, any> | null;
  image_url?: string | null;
  deals?: Deal[];
};

const DEFAULT_REGION = {
  latitude: 34.0522,
  longitude: -118.2437,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { toggleFavorite, isFavorited } = useFavorites();
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortKey, setSortKey] = useState<'distance'>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sheetState, setSheetState] = useState<'open' | 'peek' | 'hidden'>('peek');
  const [maxDistanceMi, setMaxDistanceMi] = useState<number>(10);
  const [showRadius, setShowRadius] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [searchedVenue, setSearchedVenue] = useState<Venue | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [locationButtonState, setLocationButtonState] = useState<'idle' | 'centered' | 'tilted'>('idle');
  const geocodeCache = useRef<Record<string, { latitude: number; longitude: number }>>({});
  const unsubRef = useRef<() => void | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const sliderTrackWidth = useRef(0);
  const sliderTrackRef = useRef<any>(null);
  const sliderX = useRef(new Animated.Value(0)).current;
  const { height: screenHeight } = Dimensions.get('window');
  const sheetHeight = Math.min(screenHeight * 0.72, 1000);
  const peekHeight = 200 + insets.bottom;
  const hiddenPeek = 24 + insets.bottom;
  const peekTranslate = Math.max(0, sheetHeight - peekHeight);
  const hiddenTranslate = Math.max(0, sheetHeight - hiddenPeek);
  const translateY = useRef(new Animated.Value(peekTranslate)).current;
  const dragStartY = useRef(peekTranslate);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        translateY.stopAnimation((v: number) => {
          dragStartY.current = v;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(hiddenTranslate, Math.max(0, dragStartY.current + gesture.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const next = Math.min(hiddenTranslate, Math.max(0, dragStartY.current + gesture.dy));
        const snapPoints = [0, peekTranslate, hiddenTranslate];
        const closest = snapPoints.reduce((prev, curr) => (Math.abs(curr - next) < Math.abs(prev - next) ? curr : prev));
        setSheetState(closest === 0 ? 'open' : closest === hiddenTranslate ? 'hidden' : 'peek');
        Animated.spring(translateY, {
          toValue: closest,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }).start();
      },
    })
  ).current;

  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2,
      onPanResponderMove: (_, gesture) => {
        if (!sliderTrackWidth.current) return;
        const maxX = Math.max(1, sliderTrackWidth.current - sliderThumbSize);
        const nextX = Math.min(maxX, Math.max(0, gesture.moveX - sliderTrackLeft.current));
        sliderX.setValue(nextX);
        const value = sliderValueFromX(nextX);
        setMaxDistanceMi(value);
      },
      onPanResponderGrant: (_, gesture) => {
        if (!sliderTrackWidth.current) return;
        const maxX = Math.max(1, sliderTrackWidth.current - sliderThumbSize);
        const nextX = Math.min(maxX, Math.max(0, gesture.x0 - sliderTrackLeft.current));
        sliderX.setValue(nextX);
        const value = sliderValueFromX(nextX);
        setMaxDistanceMi(value);
      },
    })
  ).current;

  const sliderTrackLeft = useRef(0);
  const sliderMin = 1;
  const sliderMax = 25;
  const sliderThumbSize = 32;
  const sliderHalfThumb = sliderThumbSize / 2;
  const sliderFillWidth = useMemo(
    () => Animated.add(sliderX, new Animated.Value(sliderHalfThumb)),
    [sliderX]
  );
  const sliderValueFromX = (x: number) => {
    if (!sliderTrackWidth.current) return maxDistanceMi;
    const maxX = Math.max(1, sliderTrackWidth.current - sliderThumbSize);
    const ratio = x / maxX;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    return Math.round(sliderMin + clampedRatio * (sliderMax - sliderMin));
  };
  const sliderXFromValue = (value: number) => {
    if (!sliderTrackWidth.current) return 0;
    const maxX = Math.max(1, sliderTrackWidth.current - sliderThumbSize);
    const ratio = (value - sliderMin) / (sliderMax - sliderMin);
    return Math.max(0, Math.min(maxX, ratio * maxX));
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const results: { title: string; subtitle: string; venue: Venue }[] = [];
    for (const v of venues) {
      const name = (v.venue_name ?? '').trim();
      const addr = formatAddress(v.address).trim();
      if (!name) continue;
      const matches = name.toLowerCase().includes(q) || addr.toLowerCase().includes(q);
      if (matches && !seen.has(v.venue_id)) {
        seen.add(v.venue_id);
        results.push({ title: name, subtitle: addr, venue: v });
      }
      if (results.length >= 6) break;
    }
    return results;
  }, [query, venues]);

  // user location
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          setRegion(prev => prev ?? DEFAULT_REGION);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        // Zoom out enough to show the full radius (10mi ≈ 0.29° lat)
        const radiusDeg = (maxDistanceMi / 69) * 2.5;
        const r = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: radiusDeg,
          longitudeDelta: radiusDeg,
        };
        setRegion(r);
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 5000,
          },
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        );
      } catch (e) {
        console.warn('Current location unavailable', e);
        setRegion(prev => prev ?? DEFAULT_REGION);
      }
    })();
    return () => {
      try { sub?.remove(); } catch {}
    };
  }, []);

  // load venues (dynamic import to avoid native crash in Expo Go)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('../src/get_venues');
        if (!mounted) return;
        if (mod.watchAllVenuesWithDeals) {
          unsubRef.current = mod.watchAllVenuesWithDeals(
            (v: Venue[]) => setVenues(v),
            (err: any) => console.warn('watch venues error', err)
          );
        } else {
          const v = await mod.getAllVenuesWithDeals();
          if (mounted) setVenues(v);
        }
      } catch (e) {
        console.log('Could not load native get_venues (likely Expo Go). Falling back to local data.', e);
        try {
          const local = await import('../assets/data/venues.json');
          if (mounted) setVenues(local?.default ?? local);
        } catch (e2) {
          console.warn('Failed to load local venues.json', e2);
        }
      }
    })();
    return () => {
      mounted = false;
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, []);

  // geocode addresses for venues missing coords (one-time cached)
  useEffect(() => {
    const toGeocode = venues.filter(v => (!v.latitude || !v.longitude) && v.address && !geocodeCache.current[v.venue_id]);
    if (toGeocode.length === 0) return;
    (async () => {
      for (const v of toGeocode) {
        let addrStr = '';
        if (typeof v.address === 'string') addrStr = v.address;
        else if (v.address && typeof v.address === 'object') {
          const { street, city, state, postalCode, country } = v.address as any;
          addrStr = [street, city, state, postalCode, country].filter(Boolean).join(', ');
        }
        if (!addrStr) continue;
        try {
          const results = await Location.geocodeAsync(addrStr);
          if (results && results[0]) {
            geocodeCache.current[v.venue_id] = { latitude: results[0].latitude, longitude: results[0].longitude };
            setVenues(prev => prev.map(x => (x.venue_id === v.venue_id ? { ...x } : x)));
          }
        } catch (e) {
          console.warn('Geocode failed for', v.venue_id, addrStr, e);
        }
      }
    })();
  }, [venues]);

  function formatAddress(a?: string | Record<string, any> | null) {
    if (!a) return '';
    if (typeof a === 'string') return a;
    const { street, city, state, postalCode, country } = a as any;
    return [street, city, state, postalCode, country].filter(Boolean).join(', ');
  }

  function formatFirstDeal(d?: Deal[] | null) {
    if (!d || d.length === 0) return null;
    const first = d[0];
    const name = first.name ?? '';
    const description = first.description ?? '';
    const days = Array.isArray(first.days) ? first.days.join(', ') : '';
    const times = (first.start_time ? first.start_time : '') + (first.end_time ? ` - ${first.end_time}` : '');
    const parts = [name, description, days, times].filter(Boolean);
    return parts.join('\n');
  }

  function getCoords(v: Venue) {
    const cached = geocodeCache.current[v.venue_id];
    const lat = v.latitude ?? cached?.latitude;
    const lng = v.longitude ?? cached?.longitude;
    if (lat == null || lng == null) return null;
    return { latitude: lat, longitude: lng };
  }

  function haversineDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const km = 2 * R * Math.asin(Math.sqrt(h));
    return km * 0.621371;
  }

  const nearbyVenues = useMemo(() => {
    if (!region && !userLocation) return [];
    
    // Validate origin has valid coordinates
    const originCandidate = userLocation ?? { latitude: region!.latitude, longitude: region!.longitude };
    if (!originCandidate || 
        typeof originCandidate.latitude !== 'number' ||
        typeof originCandidate.longitude !== 'number' ||
        isNaN(originCandidate.latitude) ||
        isNaN(originCandidate.longitude)) {
      return [];
    }
    
    const origin = originCandidate;
    const withDistance = venues
      .map(v => {
        const coords = getCoords(v);
        if (!coords) return null;
        
        // Validate coordinates are valid numbers
        if (typeof coords.latitude !== 'number' ||
            typeof coords.longitude !== 'number' ||
            isNaN(coords.latitude) ||
            isNaN(coords.longitude)) {
          return null;
        }
        
        const distanceMi = haversineDistance(origin, coords);
        return { venue: v, coords, distanceMi };
      })
      .filter((item): item is { venue: Venue; coords: { latitude: number; longitude: number }; distanceMi: number } => 
        item !== null && 
        item.coords !== null && 
        typeof item.coords.latitude === 'number' && 
        typeof item.coords.longitude === 'number' &&
        !isNaN(item.coords.latitude) &&
        !isNaN(item.coords.longitude)
      );

    // Filter by distance, but always include searched venue
    const filtered = withDistance
      .filter((item) => {
        // Always include the searched venue
        if (searchedVenue && item.venue.venue_id === searchedVenue.venue_id) {
          return true;
        }
        // Otherwise filter by distance
        return item.distanceMi <= maxDistanceMi;
      })
      .sort((a, b) => {
        const delta = a.distanceMi - b.distanceMi;
        return sortOrder === 'asc' ? delta : -delta;
      });

    return filtered;
  }, [venues, region, sortKey, maxDistanceMi, sortOrder, searchedVenue, userLocation]);

  async function handleSearchSubmit() {
    const q = query.trim();
    if (!q) return;

    const qLower = q.toLowerCase();
    const matches = venues.filter(v => {
      const addr = formatAddress(v.address).toLowerCase();
      const name = (v.venue_name ?? '').toLowerCase();
      return name.includes(qLower) || addr.includes(qLower);
    });

    if (matches.length > 0) {
      // choose first match with coords or attempt to geocode its address
      let chosen = matches.find(m => (m.latitude != null && m.longitude != null) || geocodeCache.current[m.venue_id]);
      if (!chosen) {
        const m = matches[0];
        const addrStr = formatAddress(m.address);
        if (addrStr) {
          try {
            const res = await Location.geocodeAsync(addrStr);
            if (res && res[0]) {
              geocodeCache.current[m.venue_id] = { latitude: res[0].latitude, longitude: res[0].longitude };
              chosen = m;
            }
          } catch (e) {
            console.warn('Geocode during search failed', e);
          }
        }
      }
      if (chosen) {
        const lat = chosen.latitude ?? geocodeCache.current[chosen.venue_id]?.latitude;
        const lng = chosen.longitude ?? geocodeCache.current[chosen.venue_id]?.longitude;
        if (lat != null && lng != null) {
          const r = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
          setRegion(r);
          setSearchedVenue({ ...chosen, latitude: lat, longitude: lng });
          // Keep the venue name in the search bar
          setQuery(chosen.venue_name ?? '');
          try { mapRef.current?.animateToRegion(r, 500); } catch {}
        }
      }
      setShowSuggestions(false);
      Keyboard.dismiss();
      return;
    }

    // No venue matched: try geocoding the query itself (e.g., "Long Beach")
    try {
      const res = await Location.geocodeAsync(q);
      if (res && res[0]) {
        const r = { latitude: res[0].latitude, longitude: res[0].longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
        setRegion(r);
        try { mapRef.current?.animateToRegion(r, 500); } catch {}
      } else {
        console.log('No geocode result for query:', q);
      }
      setShowSuggestions(false);
      Keyboard.dismiss();
    } catch (e) {
      console.warn('Geocode failed for query', q, e);
    }
  }

  if (!region) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <>
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        followsUserLocation
        showsMyLocationButton={false}
        onPanDrag={() => {
          if (locationButtonState !== 'idle') setLocationButtonState('idle');
        }}
      >
        {userLocation && 
         typeof userLocation.latitude === 'number' && 
         typeof userLocation.longitude === 'number' &&
         !isNaN(userLocation.latitude) &&
         !isNaN(userLocation.longitude) && (() => {
           const stableUserCoords = {
             latitude: Number(userLocation.latitude),
             longitude: Number(userLocation.longitude)
           };
           return (
             <Marker 
               key="user-location"
               coordinate={stableUserCoords} 
               title="You Are Here" 
               tracksViewChanges={false}
               stopPropagation={true}
             />
           );
         })()}
        {showRadius && 
         userLocation && 
         typeof userLocation.latitude === 'number' && 
         typeof userLocation.longitude === 'number' &&
         !isNaN(userLocation.latitude) &&
         !isNaN(userLocation.longitude) && (() => {
           const stableUserCoords = {
             latitude: Number(userLocation.latitude),
             longitude: Number(userLocation.longitude)
           };
           return (
             <Circle 
               key="radius-circle"
               center={stableUserCoords}
               radius={maxDistanceMi * 1609.34}
               strokeWidth={2}
               strokeColor="#3399ff"
               fillColor="rgba(51, 153, 255, 0.2)"
             />
           );
         })()}

        {nearbyVenues.map((item: any) => {
          const v = item.venue;
          const coords = item.coords;
          
          // Strict coordinate validation
          if (!coords || 
              typeof coords.latitude !== 'number' || 
              typeof coords.longitude !== 'number' ||
              isNaN(coords.latitude) || 
              isNaN(coords.longitude)) {
            return null;
          }

          const addressText = formatAddress(v.address);
          const dealText = formatFirstDeal(v.deals);
          const calloutText = [addressText, dealText].filter(Boolean).join('\n\n');

          // Create stable coordinate object
          const stableCoords = { 
            latitude: Number(coords.latitude), 
            longitude: Number(coords.longitude) 
          };

          return (
            <Marker
              key={`marker-${v.venue_id}`}
              coordinate={stableCoords}
              title={v.venue_name ?? 'Venue'}
              description={Platform.OS === 'android' ? (calloutText || 'No address or deal info available') : undefined}
              tracksViewChanges={false}
              stopPropagation={true}
              onPress={() => {
                if (Platform.OS === 'android') {
                  requestAnimationFrame(() => {
                    try { markerRefs.current[v.venue_id]?.showCallout(); } catch {}
                  });
                }
              }}
            >
              {Platform.OS === 'ios' && (
                <Callout tooltip={false}>
                  <View style={{ maxWidth: 260, padding: 8 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>{v.venue_name ?? 'Venue'}</Text>
                    <Text>{calloutText || 'No address or deal info available'}</Text>
                  </View>
                </Callout>
              )}
            </Marker>
          );
        })}

        {(() => {
          if (!searchedVenue || 
              searchedVenue.latitude == null || 
              searchedVenue.longitude == null ||
              typeof searchedVenue.latitude !== 'number' ||
              typeof searchedVenue.longitude !== 'number' ||
              isNaN(searchedVenue.latitude) ||
              isNaN(searchedVenue.longitude)) {
            return null;
          }
          
          const stableCoords = { 
            latitude: Number(searchedVenue.latitude), 
            longitude: Number(searchedVenue.longitude) 
          };
          const addressText = formatAddress(searchedVenue.address);
          const dealText = formatFirstDeal(searchedVenue.deals);
          const calloutText = [addressText, dealText].filter(Boolean).join('\n\n');
          return (
            <Marker
              key={`searched-${searchedVenue.venue_id}`}
              coordinate={stableCoords}
              title={searchedVenue.venue_name ?? 'Venue'}
              description={Platform.OS === 'android' ? (calloutText || 'No address or deal info available') : undefined}
              tracksViewChanges={false}
              stopPropagation={true}
            >
              {Platform.OS === 'ios' && (
                <Callout tooltip={false}>
                  <View style={{ maxWidth: 260, padding: 8 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>{searchedVenue.venue_name ?? 'Venue'}</Text>
                    <Text>{calloutText || 'No address or deal info available'}</Text>
                  </View>
                </Callout>
              )}
            </Marker>
          );
        })()}
      </MapView>
      {/* Search bar overlay */}
      <View
        style={[styles.searchContainer, { top: insets.top + 12 }]}
        onStartShouldSetResponder={() => true}
      >
        <TextInput
          placeholder="Search city, venue, or address (e.g. Long Beach)"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShowSuggestions(text.trim().length > 0);
            // Clear searched venue if user starts typing again
            if (searchedVenue && text !== searchedVenue.venue_name) {
              setSearchedVenue(null);
            }
          }}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          style={styles.searchInput}
          clearButtonMode="never"
          accessible={true}
          importantForAutofill="yes"
          onFocus={() => setShowSuggestions(query.trim().length > 0)}
        />
        {searchedVenue && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchedVenue(null);
              setQuery('');
              setShowSuggestions(false);
            }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color="#6C7280" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit} accessibilityLabel="Search">
          <Text style={{ color: '#fff', fontWeight: '700' }}>Search</Text>
        </TouchableOpacity>
      </View>
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionBox, { top: insets.top + 58 }]}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.venue.venue_id}
              style={styles.suggestionItem}
              onPress={() => {
                const coords = getCoords(s.venue);
                if (coords) {
                  const r = { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
                  setRegion(r);
                  setSearchedVenue({ ...s.venue, latitude: coords.latitude, longitude: coords.longitude });
                  setQuery(s.title); // Keep the venue name in search bar
                  setShowSuggestions(false);
                  Keyboard.dismiss();
                  try { mapRef.current?.animateToRegion(r, 500); } catch {}
                } else {
                  setQuery(s.title);
                  setShowSuggestions(false);
                  Keyboard.dismiss();
                  handleSearchSubmit();
                }
              }}
            >
              <Text style={styles.suggestionTitle} numberOfLines={1}>{s.title}</Text>
              {s.subtitle ? (
                <Text style={styles.suggestionSubtitle} numberOfLines={1}>{s.subtitle}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Location button (Google Maps-style: idle → centered 2D → tilted 3D → back) */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={async () => {
          if (locationButtonState === 'idle') {
            // Center on user location (2D)
            let coords = userLocation;
            if (!coords) {
              try {
                const loc = await Location.getCurrentPositionAsync({});
                coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
              } catch (e) {
                console.warn('Failed to get current location', e);
              }
            }
            if (coords) {
              const r = { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
              setRegion(r);
              try {
                mapRef.current?.animateCamera({ center: coords, pitch: 0, heading: 0, zoom: 16 }, { duration: 500 });
              } catch {
                try { mapRef.current?.animateToRegion(r, 500); } catch {}
              }
            }
            setLocationButtonState('centered');
          } else if (locationButtonState === 'centered') {
            // Tilt to 3D
            let coords = userLocation;
            if (!coords) {
              try {
                const loc = await Location.getCurrentPositionAsync({});
                coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
              } catch (e) {
                console.warn('Failed to get current location', e);
              }
            }
            if (coords) {
              try {
                mapRef.current?.animateCamera({ center: coords, pitch: 60, heading: 0, zoom: 18 }, { duration: 500 });
              } catch {}
            }
            setLocationButtonState('tilted');
          } else {
            // Back to centered 2D
            let coords = userLocation;
            if (!coords) {
              try {
                const loc = await Location.getCurrentPositionAsync({});
                coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setUserLocation(coords);
              } catch (e) {
                console.warn('Failed to get current location', e);
              }
            }
            if (coords) {
              const r = { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
              setRegion(r);
              try {
                mapRef.current?.animateCamera({ center: coords, pitch: 0, heading: 0, zoom: 16 }, { duration: 500 });
              } catch {
                try { mapRef.current?.animateToRegion(r, 500); } catch {}
              }
            }
            setLocationButtonState('centered');
          }
        }}
        accessibilityLabel={
          locationButtonState === 'idle' ? 'Center on your location' :
          locationButtonState === 'centered' ? 'Switch to 3D view' : 'Switch to 2D view'
        }
      >
        <MaterialCommunityIcons
          name={
            locationButtonState === 'idle' ? 'crosshairs' :
            locationButtonState === 'centered' ? 'crosshairs-gps' : 'rotate-3d-variant'
          }
          size={22}
          color={locationButtonState === 'idle' ? '#666' : '#4285F4'}
        />
      </TouchableOpacity>

      {/* Draggable list overlay */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: 12 + insets.bottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nearby Restaurants</Text>
            <View style={styles.sheetHeaderRight}>
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                <Text style={styles.sortButtonText}>
                  {sortOrder === 'asc' ? 'Closest' : 'Farthest'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.sheetSubtitle}>{nearbyVenues.length} places</Text>
            </View>
          </View>
        </View>
        {selectedVenue ? (
          <ScrollView style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedVenue.venue_name ?? 'Venue'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => toggleFavorite(selectedVenue.venue_id)}>
                  <Ionicons
                    name={isFavorited(selectedVenue.venue_id) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isFavorited(selectedVenue.venue_id) ? '#E8886B' : '#B7BDC8'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedVenue(null)}>
                  <Text style={styles.detailClose}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.detailAddress}>{formatAddress(selectedVenue.address) || 'No address available'}</Text>
            <View style={styles.detailImageWrap}>
              <TouchableOpacity 
                style={styles.detailImageTouchable}
                activeOpacity={0.9}
                onPress={() => selectedVenue?.image_url && setImageModalVisible(true)}
                disabled={!selectedVenue?.image_url}
              >
                {selectedVenue.image_url ? (
                  <Image source={{ uri: selectedVenue.image_url }} style={styles.detailImage} contentFit="cover" />
                ) : (
                  <View style={styles.detailImagePlaceholder}>
                    <MaterialCommunityIcons name="image-off-outline" size={32} color="#9AA0AA" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            {selectedVenue.deals && selectedVenue.deals.length > 0 ? (
              <View style={styles.detailDeals}>
                {selectedVenue.deals.map((d, idx) => (
                  <View key={`${selectedVenue.venue_id}-deal-${idx}`} style={styles.detailDealItem}>
                    <Text style={styles.detailDealName}>{d.name ?? 'Deal'}</Text>
                    {d.description ? <Text style={styles.detailDealText}>{d.description}</Text> : null}
                    {Array.isArray(d.days) && d.days.length > 0 ? (
                      <Text style={styles.detailDealText}>{d.days.join(', ')}</Text>
                    ) : null}
                    {(d.start_time || d.end_time) ? (
                      <Text style={styles.detailDealText}>
                        {[d.start_time, d.end_time].filter(Boolean).join(' - ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.detailDealText}>No deals available</Text>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={nearbyVenues}
            keyExtractor={(item: any) => item.venue.venue_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No nearby restaurants found</Text>
                <Text style={styles.emptySubtext}>Try increasing the search distance</Text>
              </View>
            }
            ListHeaderComponent={
              <View style={styles.filterRow}>
                <View style={styles.filterChip}>
                  <Text style={styles.filterLabel}>Distance</Text>
                  <View
                    ref={ref => { sliderTrackRef.current = ref; }}
                    style={styles.sliderTrack}
                    onLayout={event => {
                      sliderTrackWidth.current = event.nativeEvent.layout.width;
                      sliderTrackRef.current?.measureInWindow((x: number) => {
                        sliderTrackLeft.current = x;
                      });
                      sliderX.setValue(sliderXFromValue(maxDistanceMi));
                    }}
                  >
                    <Animated.View style={[styles.sliderFill, { width: sliderFillWidth }]} />
                    <Animated.View
                      style={[styles.sliderThumb, { transform: [{ translateX: sliderX }] }]}
                      {...sliderPanResponder.panHandlers}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.filterValue}>{Math.round(maxDistanceMi)} mi</Text>
                    <TouchableOpacity
                      onPress={() => setShowRadius(!showRadius)}
                      style={[styles.radiusToggle, showRadius && styles.radiusToggleActive]}
                    >
                      <Text style={[styles.radiusToggleText, showRadius && styles.radiusToggleTextActive]}>
                        {showRadius ? 'Hide Radius' : 'Show Radius'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            }
            renderItem={({ item }: any) => {
              const addressText = formatAddress(item.venue.address);
              const dealText = formatFirstDeal(item.venue.deals);
              return (
                <TouchableOpacity
                  style={styles.venueCard}
                onPress={() => {
                  setSelectedVenue(item.venue);
                  setQuery('');
                  setShowSuggestions(false);
                  const r = {
                    latitude: item.coords.latitude,
                    longitude: item.coords.longitude,
                    latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    };
                    setRegion(r);
                    try { mapRef.current?.animateToRegion(r, 500); } catch {}
                    if (Platform.OS === 'android') {
                      requestAnimationFrame(() => {
                        try { markerRefs.current[item.venue.venue_id]?.showCallout(); } catch {}
                      });
                    }
                  }}
                >
                  <View style={styles.venueImageWrap}>
                    {item.venue.image_url ? (
                      <Image 
                        source={{ uri: item.venue.image_url }}
                        style={styles.venueImage}
                        contentFit="cover"
                        onError={(error) => {
                          console.log('Image failed to load:', item.venue.image_url);
                          console.log('Error details:', error);
                        }}
                        onLoad={() => {
                          console.log('Image successfully loaded:', item.venue.image_url);
                        }}
                        // Add cachePolicy if using expo-image
                        cachePolicy="memory-disk"                      />
                    ) : (
                      <View style={styles.venueImagePlaceholder}>
                        <MaterialCommunityIcons name="image-off-outline" size={20} color="#9AA0AA" />
                      </View>
                    )}
                  </View>
                  <View style={styles.venueInfo}>
                    <View style={styles.venueRow}>
                      <Text style={styles.venueName} numberOfLines={1}>
                        {item.venue.venue_name ?? 'Venue'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item.venue.venue_id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ marginRight: 8 }}
                      >
                        <Ionicons
                          name={isFavorited(item.venue.venue_id) ? 'heart' : 'heart-outline'}
                          size={18}
                          color={isFavorited(item.venue.venue_id) ? '#E8886B' : '#B7BDC8'}
                        />
                      </TouchableOpacity>
                      <Text style={styles.venueDistance}>{item.distanceMi.toFixed(1)} mi</Text>
                    </View>
                    <Text style={styles.venueAddress} numberOfLines={1}>
                      {addressText || 'No address available'}
                    </Text>
                    {dealText ? (
                      <Text style={styles.venueDeal} numberOfLines={2}>
                        {dealText}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
    <Modal
      visible={imageModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setImageModalVisible(false)}
    >
      <TouchableOpacity 
        style={styles.imageModalOverlay} 
        activeOpacity={1}
        onPress={() => setImageModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.imageModalClose}
          onPress={() => setImageModalVisible(false)}
        >
          <Ionicons name="close-circle" size={40} color="#FFFFFF" />
        </TouchableOpacity>
        {selectedVenue?.image_url && (
          <View style={styles.imageModalContent}>
            <Image 
              source={{ uri: selectedVenue.image_url }} 
              style={styles.imageModalImage} 
              contentFit="contain" 
            />
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e71212ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: { flex: 1 },
  searchContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    elevation: 10,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  clearButton: {
    marginLeft: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: '#E8886B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  suggestionBox: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 998,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  suggestionTitle: {
    fontSize: 13,
    color: '#1E1F24',
    fontWeight: '700',
  },
  suggestionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6C7280',
  },
  locationButton: {
    position: 'absolute',
    right: 14,
    bottom: 280,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 18,
  },
  sheetHandleWrap: {
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 64,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#B7BDC8',
    marginBottom: 10,
  },
  sheetHeader: {
    width: '100%',
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sheetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    backgroundColor: '#1E1F24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sortButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1F24',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#6C7280',
  },
  sheetList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
  },
  filterRow: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  filterChip: {
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    width: '100%',
  },
  filterLabel: {
    fontSize: 12,
    color: '#5C6270',
    fontWeight: '600',
    marginBottom: 6,
  },
  filterValue: {
    fontSize: 12,
    color: '#1E1F24',
    marginTop: 6,
    fontWeight: '600',
  },
  radiusToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#DCE0E6',
    marginTop: 6,
  },
  radiusToggleActive: {
    backgroundColor: '#3399ff',
  },
  radiusToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C6270',
  },
  radiusToggleTextActive: {
    color: '#FFFFFF',
  },
  sliderTrack: {
    height: 30,
    backgroundColor: '#DCE0E6',
    borderRadius: 999,
    overflow: 'visible',
  },
  sliderFill: {
    height: 30,
    backgroundColor: '#E8886B',
    borderBottomLeftRadius: 999,
    borderTopLeftRadius: 999,
  },
  sliderThumb: {
    position: 'absolute',
    top: -1,
    width: 32,
    height: 32,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E1F24',
  },
  detailCard: {
    marginHorizontal: 14,
    marginBottom: 5,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
  },
  detailImageWrap: {
    width: '100%',
    height: 350,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#EEF1F5',
  },
  detailImageTouchable: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F5',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    height: '70%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1F24',
    flex: 1,
    marginRight: 8,
  },
  detailClose: {
    color: '#E8886B',
    fontWeight: '700',
    fontSize: 12,
  },
  detailAddress: {
    fontSize: 12,
    color: '#5C6270',
    marginBottom: 8,
  },
  detailDeals: {
    gap: 10,
  },
  detailDealItem: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  detailDealName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1F24',
    marginBottom: 2,
  },
  detailDealText: {
    fontSize: 12,
    color: '#5C6270',
  },
  venueCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueImageWrap: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EEF1F5',
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF1F5',
  },
  venueInfo: {
    flex: 1,
  },
  venueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1F24',
    flex: 1,
    marginRight: 8,
  },
  venueDistance: {
    fontSize: 12,
    color: '#9AA0AA',
  },
  venueAddress: {
    fontSize: 12,
    color: '#5C6270',
  },
  venueDeal: {
    fontSize: 12,
    color: '#2B2F36',
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1F24',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6C7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
