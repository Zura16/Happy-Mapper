import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * A placeholder main screen for after the user logs in.
 * In a real app, this could be a tab navigator or a drawer navigator.
 * 
 * The `onLogout` prop would be passed down from your navigation setup
 * to allow the user to sign out.
 */
const MainScreen = ({ onLogout }: { onLogout: () => void }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to the Main Screen!</Text>
        <Text style={styles.subtitle}>You are successfully logged in.</Text>
        <Button title="Sign Out" onPress={onLogout} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 20 },
});

export default MainScreen;