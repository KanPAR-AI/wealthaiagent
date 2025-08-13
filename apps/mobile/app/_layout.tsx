import { Stack } from "expo-router";
import "../global.css";
// For development, you can use a test publishable key

export default function RootLayout() {
  return (
      <Stack>
        <Stack.Screen 
          name="index" 
          options={{ 
            title: "YourFinAdvisor",
            headerShown: false 
          }} 
        />
      </Stack>
  );
}
