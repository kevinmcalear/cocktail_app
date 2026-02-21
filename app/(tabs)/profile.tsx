import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/ctx/AuthContext";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, signOut } = useAuth();

    const avatarUrl = user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80";

    const handleNavigation = (path: string) => {
        router.push(path as any);
    };

    const handleSignOut = async () => {
        await signOut();
    };

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Profile</ThemedText>
            </View>

            <View style={styles.content}>
                <View style={styles.profileSection}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    <ThemedText style={styles.userName}>{user?.user_metadata?.full_name || user?.email || "User"}</ThemedText>
                </View>

                <View style={styles.menuContainer}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => handleNavigation('/settings')}
                    >
                        <View style={styles.menuItemLeft}>
                            <IconSymbol name="pencil" size={24} color={Colors.dark.text} />
                            <ThemedText style={styles.menuText}>Edit Profile</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={Colors.dark.icon} />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => handleNavigation('/add-cocktail')}
                    >
                        <View style={styles.menuItemLeft}>
                            <IconSymbol name="plus.circle" size={24} color={Colors.dark.text} />
                            <ThemedText style={styles.menuText}>Create Cocktail</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={Colors.dark.icon} />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => handleNavigation('/settings')}
                    >
                        <View style={styles.menuItemLeft}>
                            <IconSymbol name="gear" size={24} color={Colors.dark.text} />
                            <ThemedText style={styles.menuText}>Settings</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={Colors.dark.icon} />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleSignOut}
                    >
                        <View style={styles.menuItemLeft}>
                            <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#FF6B6B" />
                            <ThemedText style={[styles.menuText, { color: '#FF6B6B' }]}>Log Out</ThemedText>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    title: {
        fontSize: 34,
        fontWeight: "bold",
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    menuContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    menuText: {
        fontSize: 18,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginLeft: 60, // Align with text
    },
});
