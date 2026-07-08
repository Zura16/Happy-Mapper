import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export default function CheerModal({ visible, title, message, onClose }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Let's go!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFF4ED',
    borderRadius: 24,
    padding: 28,
    borderWidth: 2,
    borderColor: '#D6453B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D6453B',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#5C4036',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#D6453B',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
