// app/Favorites.tsx
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { watchAllVenuesWithDeals, type FrontendVenueWithDeals } from '../src/get_venues';
import { useFavorites } from '../src/favorites';
import { Ionicons } from '@expo/vector-icons';
import ListBox from '../components/ListBox';

export default function FavoritesScreen() {
  const [venues, setVenues] = useState<FrontendVenueWithDeals[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { savedVenueIds, toggleFavorite, isFavorited, loading: favLoading } = useFavorites();

  useEffect(() => {
    const unsub = watchAllVenuesWithDeals(
      (v) => {
        setVenues(v);
        setLoading(false);
      },
      (e) => {
        setErr(e?.code ? `${e.code}: ${e.message}` : String(e));
        setLoading(false);
      }
    );
    return unsub;
  }, []);

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

  const favoriteVenues = useMemo(
    () => venues.filter((v) => savedVenueIds.has(v.venue_id)),
    [venues, savedVenueIds]
  );

  if (loading || favLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (err) return <Text style={{ margin: 16 }}>Error: {err}</Text>;

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Favorites</Text>
        <Text style={styles.headerSubtext}>{favoriteVenues.length} favorites</Text>
      </View>

      {favoriteVenues.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={56} color="#D4A08B" />
          <Text style={styles.emptyTitle}>No saved deals yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart icon on any venue to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteVenues}
          keyExtractor={(item) => item.venue_id}
          renderItem={({ item }) => (
            <ListBox
              venue={item}
              isFavorited={isFavorited(item.venue_id)}
              onToggleFavorite={toggleFavorite}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F5EBE0' },
  header: {
    backgroundColor: '#F5EBE0',
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E8886B',
  },
  headerSubtext: {
    fontSize: 13,
    color: '#6C7280',
    marginTop: 2,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E1F24',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6C7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
