import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const FOOD_EMOJIS = ['🍕', '🍔', '🍟', '🍣', '🍩', '🍉', '🍪', '🍙', '🍦', '🥐'];

export default function SplashScreen() {
  const router = useRouter();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Loop the background movement
    const backgroundLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );
    backgroundLoop.start();

    // Navigate after 4 seconds
    const timer = setTimeout(() => {
      router.replace('/Map');
    }, 4000);

    return () => {
      clearTimeout(timer);
      backgroundLoop.stop();
    };
  }, [animatedValue, router]);

  // Move background diagonally
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -50],
  });
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -50],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.emojiBackground,
          {
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <Text key={i} style={styles.emoji}>
            {FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)]}
          </Text>
        ))}
      </Animated.View>

      <Text style={styles.title}>happy{'\n'}mapper</Text>
      <Text style={styles.subtitle}>all day, every day</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EBE0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  emojiBackground: {
    position: 'absolute',
    width: width * 2,
    height: height * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.2,
  },
  emoji: {
    fontSize: 40,
    margin: 10,
  },
  title: {
    fontSize: 64,
    fontWeight: '300',
    color: '#E8886B',
    letterSpacing: 0,
    textTransform: 'lowercase',
  },
  subtitle: {
    fontSize: 16,
    color: '#E8886B',
    textAlign: 'center',
    marginTop: 10,
  },
});
