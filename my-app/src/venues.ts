// src/api/venues.ts
// React Native Firebase Firestore subscription
import firestore from '@react-native-firebase/firestore';

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
  latitude: number;
  longitude: number;
  address: string | Record<string, unknown> | null;
  deals: FrontendDeal[];
};

export function subscribeVenuesWithDeals(
  onData: (rows: FrontendVenueWithDeals[]) => void,
  onError?: (e: any) => void
) {
  // Collection should contain one doc per venue with a deals array
  return firestore()
    .collection('venues_with_deals')
    .orderBy('venue_name') // remove if some docs lack this field
    .onSnapshot(
      snap => {
        const rows = snap.docs.map(d => ({
          venue_id: d.id,
          ...(d.data() as any),
        })) as FrontendVenueWithDeals[];
        onData(rows);
      },
      err => onError?.(err)
    );
}


// import { getApp } from '@react-native-firebase/app';
// import {
//   getFunctions,
//   httpsCallable,
// } from '@react-native-firebase/functions';
// import firestore from '@react-native-firebase/firestore';
//
//
// export type FrontendDeal = {
//   name: string;
//   price: string | number;
//   description?: string | null;
//   start_time: string;
//   end_time: string;
//   days: string[];
//   special_conditions?: string | null;
// };
//
// export type FrontendVenueWithDeals = {
//   venue_id: string;
//   venue_name: string;
//   latitude: number;
//   longitude: number;
//   address: string | Record<string, unknown> | null; // can be object or string
//   deals: FrontendDeal[];
// };
//
// // initialize modular API with region
// const app = getApp();
// const fns = getFunctions(app, 'us-central1'); // adjust if backend uses a different region
//
// export async function getAllVenuesWithDeals() {
//   const callable = httpsCallable(fns, 'getAllVenuesWithDeals');
//   const res = await callable({});
//
//   if (!res.data?.success) {
//     throw new Error(res.data?.error || 'Function returned unsuccessful');
//   }
//
//   return res.data.venues as FrontendVenueWithDeals[];
}

