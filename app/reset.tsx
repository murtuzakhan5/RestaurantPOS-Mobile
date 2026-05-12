import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function ResetScreen() {
  const resetAll = async () => {
    await AsyncStorage.clear();
    Alert.alert('Reset', 'All data cleared!');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity onPress={resetAll} style={{ backgroundColor: 'red', padding: 20 }}>
        <Text style={{ color: 'white' }}>RESET ALL DATA</Text>
      </TouchableOpacity>
    </View>
  );
}