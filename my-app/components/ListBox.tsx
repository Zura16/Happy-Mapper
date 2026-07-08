import { memo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FrontendVenueWithDeals } from '../src/get_venues';

type Props = { venue: FrontendVenueWithDeals };
function formatAddr(addr: FrontendVenueWithDeals['address']): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [addr['street'], addr['city'], addr['state'], addr['zip']]
    .filter(Boolean)
    .map(String);
  return parts.join(', ');
}

const ListBox = memo(({ venue, isFavorited = false, onToggleFavorite }: Props) => {
  const [modalVisible, setModalVisible] = useState(false);

  const addr = formatAddr(venue.address);
  const dealCount = Array.isArray(venue.deals) ? venue.deals.length : 0;
  const firstDealName = dealCount > 0 ? (venue.deals![0].name ?? 'Deal') : null;

  const imageSource = venue.image_url
    ? { uri: venue.image_url }
    : { uri: 'https://via.placeholder.com/100x100/E8886B/FFFFFF?text=No+Image' };

  return (
    <>
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setModalVisible(true)}>
          <Image source={imageSource} style={styles.thumb} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {String(venue.venue_name ?? 'Unnamed venue')}
            </Text>
            {onToggleFavorite && (
              <TouchableOpacity
                onPress={() => onToggleFavorite(venue.venue_id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.heartButton}
              >
                <Ionicons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorited ? '#E8886B' : '#B7BDC8'}
                />
              </TouchableOpacity>
            )}
          </View>

          {!!addr && (
            <Text style={styles.addr} numberOfLines={1}>
              {addr}
            </Text>
          )}

          {dealCount > 0 && (
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>
                {dealCount === 1 ? firstDealName : `${dealCount} deals`}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Image source={imageSource} style={styles.fullImage} resizeMode="contain" />
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

export default ListBox;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  content: { flex: 1, justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#1E1F24', flex: 1, marginRight: 8 },
  addr: { fontSize: 12, color: '#6C7280', marginTop: 1 },
  dealBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(232, 136, 107, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dealBadgeText: { fontSize: 11, fontWeight: '600', color: '#E8886B' },
  heartButton: { padding: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '92%',
    height: '82%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#E8886B',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
