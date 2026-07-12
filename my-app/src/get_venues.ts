// src/venues.ts (modular v22 style)
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  onSnapshot,
  query,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export type FrontendDeal = {
  name: string;
  price: string | number;
  description?: string | null;
  start_time: string;
  end_time: string;
  days: string[];
  special_conditions?: string | null;
};

export type FrontendVenueWithDeals = {
  venue_id: string;
  venue_name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | Record<string, unknown> | null;
  image_url?: string | null;
  deals: FrontendDeal[];
};

const app = getApp();
const db = getFirestore(app);

// ---- helpers ----
function toVenue(doc: FirebaseFirestoreTypes.DocumentSnapshot): FrontendVenueWithDeals {
  const v = (doc.data() as any) ?? {};
  const deals: FrontendDeal[] = Array.isArray(v.deals)
    ? v.deals.map((d: any) => ({
        name: d?.name ?? '',
        price: d?.price ?? '',
        description: d?.description ?? null,
        start_time: d?.start_time ?? '',
        end_time: d?.end_time ?? '',
        days: Array.isArray(d?.days) ? d.days : [],
        special_conditions: Array.isArray(d?.special_conditions)
          ? d.special_conditions.join('; ')
          : (d?.special_conditions ?? null),
      }))
    : [];

  return {
    venue_id: v.venue_id ?? doc.id,
    venue_name: v.venue_name ?? '',
    latitude: v.latitude ?? null,
    longitude: v.longitude ?? null,
    address: v.address ?? null,
    image_url: v.image_url ?? null,
    deals,
  };
}

// ---- one-shot fetch ----
export async function getAllVenuesWithDeals(): Promise<FrontendVenueWithDeals[]> {
  const colRef = collection(db, 'final_schema');
  const snap = await getDocs(colRef);
  return snap.docs.map(toVenue);
}

// ---- realtime subscription ----
export function watchAllVenuesWithDeals(
  onChange: (v: FrontendVenueWithDeals[]) => void,
  onError?: (e: any) => void
) {
  const q = query(collection(db, 'final_schema'));
  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      console.log('final_schema size:', snap.size);
      onChange(snap.docs.map(toVenue));
    },
    (err) => {
      console.log('final_schema error:', err);
      onError?.(err);
    }
  );
  return unsubscribe;
}
