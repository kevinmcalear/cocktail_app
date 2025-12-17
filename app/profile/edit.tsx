import { Colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function EditProfile() {
    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'Edit Profile',
                headerStyle: { backgroundColor: Colors.dark.background },
                headerTintColor: Colors.dark.text,
            }} />
            <Text style={styles.text}>Edit Profile (Placeholder)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: Colors.dark.text,
        fontSize: 18,
    },
});
