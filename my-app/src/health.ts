// src/health.ts
import { getApp } from '@react-native-firebase/app';
import { getFirestore, collection, getDocs, limit, query } from '@react-native-firebase/firestore';

export async function probeFinalSchema() {
  try {
    const db = getFirestore(getApp());
    const snap = await getDocs(query(collection(db, 'final_schema'), limit(1)));
    return { ok: true, count: snap.size };
  } catch (e: any) {
    return { ok: false, code: e?.code, reason: e?.message };
  }
}

