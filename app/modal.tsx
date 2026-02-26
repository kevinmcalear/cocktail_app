import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, YStack } from "tamagui";

export default function ModalScreen() {
  return (
    <YStack style={styles.container} backgroundColor="$background">
      <Text style={{ fontSize: 34, fontWeight: 'bold' }}>This is a modal</Text>
      <Link href="/" dismissTo style={styles.link}>
        <Text style={{ color: '#0a7ea4' }}>Go to home screen</Text>
      </Link>
    </YStack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
