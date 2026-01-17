import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface LogViewerProps {
    logs: string[];
}

export function LogViewer({ logs }: LogViewerProps) {
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        // Auto-scroll to bottom when new logs arrive
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [logs]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Live Crawl Status</Text>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
            >
                {logs.length === 0 ? (
                    <Text style={styles.waitingText}>Waiting for crawl to start...</Text>
                ) : (
                    logs.map((log, index) => (
                        <Text key={index} style={styles.logText}>
                            <Text style={styles.logPrefix}>{'> '}</Text>
                            {log}
                        </Text>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 300,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    title: {
        color: '#94a3b8',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 8,
    },
    logText: {
        color: '#cbd5e1', // Slate-300
        fontFamily: 'monospace', // Use monospace if available/linked, otherwise falls back
        fontSize: 13,
        marginBottom: 4,
        lineHeight: 18,
    },
    logPrefix: {
        color: '#667eea',
        fontWeight: 'bold',
    },
    waitingText: {
        color: '#64748b',
        fontStyle: 'italic',
        fontSize: 13,
    }
});
