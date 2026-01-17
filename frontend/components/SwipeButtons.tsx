import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface SwipeButtonsProps {
    onPass: () => void;
    onLike: () => void;
    onSuperLike?: () => void;
}

export function SwipeButtons({ onPass, onLike, onSuperLike }: SwipeButtonsProps) {
    return (
        <View style={styles.container}>
            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    styles.passButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={onPass}
            >
                <IconSymbol name="xmark" size={32} color="#f87171" />
            </Pressable>

            {onSuperLike && (
                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        styles.superLikeButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={onSuperLike}
                >
                    <IconSymbol name="star.fill" size={28} color="#60a5fa" />
                </Pressable>
            )}

            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    styles.likeButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={onLike}
            >
                <IconSymbol name="heart.fill" size={32} color="#4ade80" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        paddingVertical: 20,
    },
    button: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    passButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#f87171',
    },
    likeButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4ade80',
    },
    superLikeButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#60a5fa',
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    buttonPressed: {
        transform: [{ scale: 0.9 }],
        opacity: 0.8,
    },
});
