import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Platform, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface LiveScanEvent {
    type: 'status' | 'scanning' | 'found_card' | 'info' | 'error' | 'complete' | 'phase' | 'discovery' | 'investigating';
    message?: string;
    url?: string;
    name?: string;
    department?: string;
    title?: string;
    summary?: string;
    depth?: number;
    pages_crawled?: number;
    total_cards?: number;
    details?: string;
    phase?: string;
    count?: number;
    step?: string;
    progress?: string;
    links_count?: number;
}

interface LiveScanVisualizerProps {
    events: LiveScanEvent[];
}

export function LiveScanVisualizer({ events }: LiveScanVisualizerProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    }, [events]);

    // Derive stats from latest events
    const professorsFound = events.filter(e => e.type === 'found_card').length;
    const pagesScanned = events.filter(e => e.type === 'scanning').length;
    const currentAction = events[events.length - 1];

    const renderEvent = (event: LiveScanEvent, index: number) => {
        switch (event.type) {
            case 'found_card':
                return (
                    <View key={index} style={styles.cardEvent}>
                        <IconSymbol name="person.crop.circle.badge.plus" size={24} color="#4ade80" />
                        <View style={styles.eventTextContainer}>
                            <Text style={styles.cardName}>{event.name}</Text>
                            {event.title ? <Text style={styles.cardTitle}>{event.title}</Text> : null}
                            <Text style={styles.cardDept}>
                                {event.department}
                            </Text>
                        </View>
                    </View>
                );
            case 'scanning':
                // Hide individual scanning logs for cleaner UI
                return null;
            case 'status':
            case 'complete':
                return (
                    <View key={index} style={styles.statusEvent}>
                        <IconSymbol name="info.circle" size={16} color="#60a5fa" />
                        <Text style={styles.statusText}>{event.message}</Text>
                    </View>
                );
            case 'error':
                // Handle blocked urls nicely
                if (event.message?.includes('404') || event.message?.includes('403')) {
                    return (
                        <View key={index} style={styles.blockedEvent}>
                            <IconSymbol name="lock.fill" size={16} color="#fbbf24" />
                            <Text style={styles.blockedText}>Access Restricted (Skipped)</Text>
                        </View>
                    );
                }
                return (
                    <View key={index} style={styles.errorEvent}>
                        <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#ef4444" />
                        <Text style={styles.errorText}>Issue: {event.message}</Text>
                    </View>
                );
            case 'info':
                // Show verbose info logs (Successfully extracted, Links count, etc.)
                return (
                    <View key={index} style={styles.infoEvent}>
                        <IconSymbol name="info.circle" size={16} color="#94a3b8" />
                        <Text style={styles.infoText}>{event.message}</Text>
                    </View>
                );
            case 'phase':
                // Phase changes (Discovery → Investigation)
                return (
                    <View key={index} style={styles.phaseEvent}>
                        <IconSymbol name="arrow.right.circle.fill" size={18} color="#a78bfa" />
                        <Text style={styles.phaseText}>{event.message}</Text>
                    </View>
                );
            case 'discovery':
                // Discovery count updates
                return (
                    <View key={index} style={styles.discoveryEvent}>
                        <IconSymbol name="magnifyingglass" size={16} color="#22d3ee" />
                        <Text style={styles.discoveryText}>{event.message}</Text>
                    </View>
                );
            case 'investigating':
                // Individual professor investigation
                return (
                    <View key={index} style={styles.investigatingEvent}>
                        <IconSymbol name="doc.text.magnifyingglass" size={16} color="#fbbf24" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.investigatingName}>{event.name}</Text>
                            <Text style={styles.investigatingStep}>{event.message}</Text>
                        </View>
                        {event.progress && (
                            <Text style={styles.progressBadge}>{event.progress}</Text>
                        )}
                    </View>
                );
            default:
                return null;
        }
    };

    // Helper to get status text
    const getStatusText = () => {
        if (!currentAction) return "Initializing AI Agent...";

        if (currentAction.type === 'scanning') {
            const url = currentAction.url || '';
            // Clean url for display
            const cleanUrl = url.replace('https://', '').replace('http://', '').replace('www.', '');
            return `Scanning: ${cleanUrl.substring(0, 30)}${cleanUrl.length > 30 ? '...' : ''}`;
        }

        if (currentAction.type === 'complete') return "Scan Complete!";

        if (currentAction.type === 'error') {
            return currentAction.message || "Error encountered";
        }

        return currentAction.message || "Processing...";
    };

    return (
        <View style={styles.container}>
            {/* HUD Stats */}
            <View style={styles.hud}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{professorsFound}</Text>
                    <Text style={styles.statLabel}>Professors</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{pagesScanned}</Text>
                    <Text style={styles.statLabel}>Pages Scanned</Text>
                </View>
            </View>

            <Text style={styles.feedTitle}>Live Activity</Text>

            <View style={styles.feedContainer}>
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {events.map((e, i) => renderEvent(e, i))}
                </ScrollView>
            </View>

            {/* Current Action Banner */}
            {currentAction?.type === 'scanning' && currentAction?.url && (
                <View style={styles.urlBanner}>
                    <IconSymbol name="globe" size={14} color="#60a5fa" />
                    <Text style={styles.urlText} numberOfLines={1}>
                        {currentAction.url.replace('https://', '').replace('http://', '')}
                    </Text>
                </View>
            )}
            <View style={styles.statusBar}>
                <ActivityIndicator size="small" color="#94a3b8" style={{ marginRight: 8 }} />
                <Text style={styles.currentStatusText} numberOfLines={1}>
                    {getStatusText()}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        padding: 16,
        backgroundColor: '#0f172a', // Dark mode for "hacker" feel but consistent with app
        borderRadius: 16,
        borderWidth: 1,
        ...Platform.select({
            web: {
                boxShadow: '0px 1px 2px rgba(30, 41, 59, 0.5)', // web shadow
            },
            default: {
                // border handles most of it, but could add elevation if needed
            }
        }),
    },
    hud: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#1e293b',
    },
    feedTitle: {
        color: '#64748b',
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600'
    },
    feedContainer: {
        flex: 1,
        minHeight: 200, // Ensure it takes space
    },
    scrollContent: {
        gap: 8,
        paddingBottom: 20
    },
    cardEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)', // Green tint
        padding: 10,
        borderRadius: 8,
        gap: 10,
        ...Platform.select({
            web: {
                boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
            }
        }),
    },
    eventTextContainer: {
        flex: 1,
    },
    cardName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cardDept: {
        color: '#4ade80',
        fontSize: 12,
        marginTop: 2,
    },
    cardTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontStyle: 'italic',
    },
    scanEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.7,
    },
    scanText: {
        color: '#94a3b8',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    statusEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 4,
    },
    statusText: {
        color: '#60a5fa',
        fontSize: 13,
    },
    errorEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 8,
        borderRadius: 6,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 12,
    },
    statusBar: {
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        paddingTop: 12,
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentStatusText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontStyle: 'italic',
        flex: 1,
    },
    blockedEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        padding: 8,
        borderRadius: 6,
    },
    blockedText: {
        color: '#fbbf24',
        fontSize: 12,
    },
    infoEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        padding: 8,
        borderRadius: 6,
        marginBottom: 4,
    },
    infoText: {
        color: '#94a3b8',
        fontSize: 12,
        flex: 1,
    },
    urlBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.3)',
    },
    urlText: {
        color: '#60a5fa',
        fontSize: 11,
        fontFamily: 'monospace',
        flex: 1,
    },
    phaseEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.4)',
    },
    phaseText: {
        color: '#a78bfa',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    discoveryEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        padding: 10,
        borderRadius: 6,
        marginBottom: 4,
    },
    discoveryText: {
        color: '#22d3ee',
        fontSize: 12,
        fontWeight: '500',
    },
    investigatingEvent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    investigatingName: {
        color: '#fbbf24',
        fontSize: 13,
        fontWeight: '600',
    },
    investigatingStep: {
        color: '#94a3b8',
        fontSize: 11,
    },
    progressBadge: {
        color: '#64748b',
        fontSize: 10,
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
});
