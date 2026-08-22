import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Text style={s.title}>Astral AI</Text>
        <Text style={s.tag}>Your birth chart, explained.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0e1116' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { color: '#f4efe6', fontSize: 32, fontWeight: '600', letterSpacing: 0.3 },
  tag: { color: '#9aa4b2', fontSize: 15 },
});
