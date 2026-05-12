import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to login after splash
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1A5F2B', '#0D3D1C', '#1A5F2B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Animated Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logoBox}>
            <Image
              source={require('../assets/images/billpak-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Animated Brand Name */}
        <Animated.View
          style={[
            styles.brandContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.brand}>BillPak</Text>
          <View style={styles.goldDivider} />
          <Text style={styles.tagline}>Smart Restaurant Billing System</Text>
        </Animated.View>

        {/* Loader */}
        <Animated.View
          style={[
            styles.loaderContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.loadingText}>Loading...</Text>
        </Animated.View>

        {/* Footer */}
        <Animated.Text
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Powered by AMS Crafters
        </Animated.Text>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: width * 0.28,
    height: width * 0.28,
    maxWidth: 140,
    maxHeight: 140,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: '70%',
    height: '70%',
    tintColor: '#F5A623',
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
  },
  goldDivider: {
    width: 60,
    height: 3,
    backgroundColor: '#F5A623',
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 8,
  },
  tagline: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: height * 0.15,
    alignItems: 'center',
  },
  loadingText: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});