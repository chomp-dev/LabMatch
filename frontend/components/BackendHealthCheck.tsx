import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiService } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BackendHealthCheck() {
    const [status, setStatus] = useState<'healthy' | 'down' | 'supabase_down'>('healthy');
    const insets = useSafeAreaInsets();

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkStatus = async () => {
            const currentStatus = await apiService.checkHealth();
            setStatus(currentStatus);
        };

        // Initial check
        checkStatus();

        // Poll everyday 2 seconds
        intervalId = setInterval(checkStatus, 2000);

        return () => clearInterval(intervalId);
    }, []);

    if (status === 'healthy') {
        return null;
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Text style={styles.text}>
                {status === 'supabase_down'
                    ? "Supabase is down due to free tier, contacted owner to restart it"
                    : "We are on free tier, please wait about a minute for backend to spin up..."}
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
