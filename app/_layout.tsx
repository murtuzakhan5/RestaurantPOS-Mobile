import { Stack } from 'expo-router';
import { ModuleProvider } from './context/ModuleContext';

export default function RootLayout() {
  return (
    <ModuleProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ModuleProvider>
  );
}