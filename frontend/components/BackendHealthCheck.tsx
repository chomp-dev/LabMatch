import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiService } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BackendHealthCheck() {
    const [isBackendUp, setIsBackendUp] = useState(true);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkStatus = async () => {
            const isUp = await apiService.checkHealth();
            setIsBackendUp(isUp);
        };

        // Initial check
        checkStatus();

        // Poll everyday 2 seconds
        intervalId = setInterval(checkStatus, 2000);

        return () => clearInterval(intervalId);
    }, []);

    if (isBackendUp) {
        return null;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.text}>
                Backend is starting up, please wait (~60s)...
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ff9800', // Orange warning color
        zIndex: 9999,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
    },
});
