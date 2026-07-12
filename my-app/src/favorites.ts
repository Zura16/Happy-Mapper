import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type UndoToast = {
  venueId: string;
  visible: boolean;
};

type FavoritesContextType = {
  savedVenueIds: Set<string>;
  toggleFavorite: (venueId: string) => Promise<void>;
  isFavorited: (venueId: string) => boolean;
  loading: boolean;
};

const FavoritesContext = createContext<FavoritesContextType>({
  savedVenueIds: new Set(),
  toggleFavorite: async () => {},
  isFavorited: () => false,
  loading: true,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [savedVenueIds, setSavedVenueIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [undoToast, setUndoToast] = useState<UndoToast>({ venueId: '', visible: false });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoVenueRef = useRef<string>('');

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const unsub = firestore()
      .collection('user_data')
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          const data = doc.data();
          const ids = Array.isArray(data?.savedDeals) ? data.savedDeals : [];
          setSavedVenueIds(new Set(ids));
          setLoading(false);
        },
        (err) => {
          console.warn('Favorites listener error:', err);
          setLoading(false);
        }
      );

    return unsub;
  }, []);

  const showUndoToast = useCallback((venueId: string) => {
    // Clear previous timer
    if (toastTimer.current) clearTimeout(toastTimer.current);

    undoVenueRef.current = venueId;
    setUndoToast({ venueId, visible: true });

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    toastTimer.current = setTimeout(() => {
      hideUndoToast();
    }, 4000);
  }, [toastOpacity]);

  const hideUndoToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setUndoToast({ venueId: '', visible: false });
    });
  }, [toastOpacity]);

  const handleUndo = useCallback(async () => {
    const venueId = undoVenueRef.current;
    if (!venueId) return;

    hideUndoToast();

    const user = auth().currentUser;
    if (!user) return;

    // Re-add to favorites
    setSavedVenueIds((prev) => {
      const next = new Set(prev);
      next.add(venueId);
      return next;
    });

    try {
      const userRef = firestore().collection('user_data').doc(user.uid);
      await userRef.set(
        { savedDeals: firestore.FieldValue.arrayUnion(venueId) },
        { merge: true }
      );
    } catch (err) {
      console.error('Undo favorite failed:', err);
      setSavedVenueIds((prev) => {
        const next = new Set(prev);
        next.delete(venueId);
        return next;
      });
    }
  }, [hideUndoToast]);

  const toggleFavorite = useCallback(
    async (venueId: string) => {
      const user = auth().currentUser;
      if (!user) return;

      const userRef = firestore().collection('user_data').doc(user.uid);
      const alreadySaved = savedVenueIds.has(venueId);

      // Optimistic UI update
      setSavedVenueIds((prev) => {
        const next = new Set(prev);
        alreadySaved ? next.delete(venueId) : next.add(venueId);
        return next;
      });

      // Show undo toast when removing
      if (alreadySaved) {
        showUndoToast(venueId);
      }

      try {
        await userRef.set(
          {
            savedDeals: alreadySaved
              ? firestore.FieldValue.arrayRemove(venueId)
              : firestore.FieldValue.arrayUnion(venueId),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('toggleFavorite failed:', err);
        // Rollback
        setSavedVenueIds((prev) => {
          const next = new Set(prev);
          alreadySaved ? next.add(venueId) : next.delete(venueId);
          return next;
        });
      }
    },
    [savedVenueIds, showUndoToast]
  );

  const isFavorited = useCallback(
    (venueId: string) => savedVenueIds.has(venueId),
    [savedVenueIds]
  );

  return React.createElement(
    FavoritesContext.Provider,
    { value: { savedVenueIds, toggleFavorite, isFavorited, loading } },
    children,
    undoToast.visible
      ? React.createElement(UndoToastView, {
          opacity: toastOpacity,
          onUndo: handleUndo,
          onDismiss: hideUndoToast,
        })
      : null
  );
}

function UndoToastView({
  opacity,
  onUndo,
  onDismiss,
}: {
  opacity: Animated.Value;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return React.createElement(
    Animated.View,
    { style: [toastStyles.container, { opacity }], pointerEvents: 'box-none' },
    React.createElement(
      View,
      { style: toastStyles.toast },
      React.createElement(
        Text,
        { style: toastStyles.text },
        'Removed from favorites'
      ),
      React.createElement(
        TouchableOpacity,
        { onPress: onUndo, style: toastStyles.undoButton },
        React.createElement(Text, { style: toastStyles.undoText }, 'Undo')
      )
    )
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 140 : 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1F24',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  undoButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  undoText: {
    color: '#E8886B',
    fontSize: 14,
    fontWeight: '700',
  },
});

export const useFavorites = () => useContext(FavoritesContext);
