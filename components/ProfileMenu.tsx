import { CustomIcon } from '@/components/ui/CustomIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/ctx/AuthContext';
import { useSettingsStore } from '@/store/useSettingsStore';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

type ProfileMenuProps = {
    visible: boolean;
    onClose: () => void;
};

export function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
    const router = useRouter();
    const { signOut } = useAuth();
    const { isEditModeEnabled, isTestingEnabled, toggleEditMode, toggleTesting } = useSettingsStore();

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
                                <View style={styles.menuItem}>
                                    <View style={styles.menuItemContent}>
                                        <IconSymbol name="pencil" size={20} color={Colors.dark.text} />
                                        <Text style={styles.menuText}>Enable Edit Mode</Text>
                                    </View>
                                    <Switch
                                        value={isEditModeEnabled}
                                        onValueChange={toggleEditMode}
                                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                                        thumbColor={isEditModeEnabled ? '#ffffff' : '#f4f3f4'}
                                    />
                                </View>

                                <View style={styles.separator} />

                                <View style={styles.menuItem}>
                                    <View style={styles.menuItemContent}>
                                        <CustomIcon name="TabTest" size={20} color={Colors.dark.text} />
                                        <Text style={styles.menuText}>Enable Testing</Text>
                                    </View>
                                    <Switch
                                        value={isTestingEnabled}
                                        onValueChange={toggleTesting}
                                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                                        thumbColor={isTestingEnabled ? '#ffffff' : '#f4f3f4'}
                                    />
                                </View>

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
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
