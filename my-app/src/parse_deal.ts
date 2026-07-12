// api.ts
import Constants from "expo-constants";

export type UploadMenuSuccess = {
  success: true;
  document_id: string;
  data: any;
  message: string;
};
export type ApiError = { success: false; error: string };

// API_BASE is retrieving from 'app.json' under the 'extras' key
const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl as string;

function ensureBase() {
  if (!API_BASE) throw new Error("Missing API base URL");
}

// debugging function to test backend server connectivity
export async function testUpload(uri: string) {
  console.log("API_BASE ->", API_BASE);
  console.log("POST ->", `${API_BASE}/upload-menu`);
  try {
    console.log("Testing upload with:", uri);
    const result = await uploadMenuImage(uri, {
      method: "hybrid",
      collection: "final_schema",
    });

    if (result?.success) {
      console.log("✅ Upload successful");
      console.log("Document ID:", result.document_id);
      return true;
    } else {
      console.warn("⚠️ Upload failed:", result);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Upload test error:", error.message || error);
    return false;
  }
}


export async function uploadMenuImage(
  uri: string,
  opts?: { method?: "hybrid" | "vision" | "gemini_validation"; collection?: string }
): Promise<UploadMenuSuccess> {
  ensureBase();

  const form = new FormData();
  form.append("image", { uri, name: "menu.jpg", type: "image/jpeg" } as any);
  if (opts?.method) form.append("method", opts.method);
  if (opts?.collection) form.append("collection", opts.collection);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${API_BASE}/upload-menu`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      // do not set Content-Type; fetch sets multipart boundary automatically
    });

    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* keep raw text */ }

    if (!res.ok) {
      const msg = json?.error || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (!json?.success) {
      throw new Error(json?.error || "Upload failed");
    }
    return json as UploadMenuSuccess;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMenu(docId: string, collection = "final_schema") {
  ensureBase();
  const res = await fetch(`${API_BASE}/get-menu/${encodeURIComponent(docId)}?collection=${encodeURIComponent(collection)}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export async function updateMenu(docId: string, updates: any, collection = "final_schema") {
  ensureBase();
  const res = await fetch(`${API_BASE}/update-menu/${encodeURIComponent(docId)}?collection=${encodeURIComponent(collection)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export async function getAllMenus(collection = "final_schema", limit?: number) {
  ensureBase();
  const url = new URL(`${API_BASE}/get-all-menus`);
  url.searchParams.set("collection", collection);
  if (typeof limit === "number") url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as any[];
}

