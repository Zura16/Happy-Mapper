import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

const PLACES_KEY = Constants.expoConfig?.extra?.googlePlacesKey;

export default function SearchList() {
  const [apiKey] = useState(String(PLACES_KEY || ""));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Search Venues Hosting Deal</Text>
      </View>

      {/* Search block */}
      <View style={styles.body}>
        <View style={styles.searchBlock}>
          <Ionicons name="search" size={20} color="#E8886B" style={styles.searchIcon} />

          <GooglePlacesAutocomplete
            placeholder="Search venues..."
            fetchDetails
            onPress={(data, details = null) => {
              console.log("Selected:", data);
              console.log("Details:", details);
            }}
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
              // KEY: prevent reflow
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
                paddingLeft: 44, // room for icon
                paddingRight: 14,
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.12,
                shadowRadius: 2,
              },

              // KEY: overlay dropdown (wireframe behavior)
              listView: {
                position: "absolute",
                top: 60, // below the input
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
                zIndex: 999,
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5EBE0",
  },

  // Wireframe-like top bar
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
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  // position context for absolute list
  searchBlock: {
    position: "relative",
    zIndex: 10,
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
});

