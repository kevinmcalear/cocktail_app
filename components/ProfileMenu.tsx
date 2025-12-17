import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/ctx/AuthContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

type ProfileMenuProps = {
    visible: boolean;
    onClose: () => void;
};

export function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
    const router = useRouter();
    const { signOut } = useAuth();

    const handleNavigation = (path: string) => {
        onClose();
        router.push(path as any);
    };

    const handleSignOut = async () => {
        onClose();
        await signOut();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.menuContainer}>
                            <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleNavigation('/profile/edit')}
                                >
                                    <IconSymbol name="pencil" size={20} color={Colors.dark.text} />
                                    <Text style={styles.menuText}>Edit Profile</Text>
                                </TouchableOpacity>

                                <View style={styles.separator} />

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleNavigation('/settings')}
                                >
                                    <IconSymbol name="gear" size={20} color={Colors.dark.text} />
                                    <Text style={styles.menuText}>Settings</Text>
                                </TouchableOpacity>

                                <View style={styles.separator} />

                                <TouchableOpacity
                                    style={[styles.menuItem]}
                                    onPress={handleSignOut}
                                >
                                    <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#FF6B6B" />
                                    <Text style={[styles.menuText, { color: '#FF6B6B' }]}>Log Out</Text>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        position: 'absolute',
        top: 60, // approximate header height + status bar
        right: 20,
        width: 200,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.dark.glass.border,
    },
    blurContainer: {
        padding: 10,
        backgroundColor: Colors.dark.glass.background,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        gap: 12,
    },
    menuText: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 10,
    },
});
