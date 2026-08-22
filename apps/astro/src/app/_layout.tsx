import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/** Root layout for the standalone astrology app (docs/49 ASTRAL-68).
 *  Product screens arrive with PH-2/PH-3; this shell exists so the native
 *  project can be generated, signed and shipped to TestFlight first. */
export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </>
  );
}
