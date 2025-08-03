import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}>
        <LottieView
        source={require('../assets/lottie/Completing-Tasks.json')}
        autoPlay
        loop={false}
        style={{ width: 300, height: 300, marginBottom: 40 }}
        />
        <Text style={styles.text}>Developed By - Nishant Wale</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
    color: '#222',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: '#e0e0e0',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif-medium',
  },
});
