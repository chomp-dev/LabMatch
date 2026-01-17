import React from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export interface Professor {
    id: string;
    professor_name: string;
    title?: string;
    department?: string;
    school?: string;
    primary_url?: string;
    summary?: string;
    research_themes?: string[];
    keywords?: string[];
    links?: { label: string; url: string }[];
    undergrad_friendly_score?: number;
    match_score?: number;
}

interface ProfessorCardProps {
    professor: Professor;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    isFirst: boolean;
}

export function ProfessorCard({ professor, onSwipeLeft, onSwipeRight, isFirst }: ProfessorCardProps) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotation = useSharedValue(0);

    const resetCard = () => {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
    };

    const swipeLeft = () => {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(onSwipeLeft)();
    };

    const swipeRight = () => {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(onSwipeRight)();
    };

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (!isFirst) return;
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.5;
            rotation.value = event.translationX / 20;
        })
        .onEnd((event) => {
            if (!isFirst) return;
            if (event.translationX > SWIPE_THRESHOLD) {
                runOnJS(swipeRight)();
            } else if (event.translationX < -SWIPE_THRESHOLD) {
                runOnJS(swipeLeft)();
            } else {
                runOnJS(resetCard)();
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotation.value}deg` },
            ],
        };
    });

    const likeOpacity = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));

    const nopeOpacity = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    }));

    const matchScore = professor.match_score ?? 0;
    // Handle both 0-1 (legacy) and 0-100 (new) scales
    const matchPercentage = matchScore <= 1 ? Math.round(matchScore * 100) : Math.round(matchScore);

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.card, animatedStyle, !isFirst && styles.cardBehind]}>
                {/* Solid Dark Background */}
                <View style={styles.cardBackground} />

                {/* Content */}
                <View style={styles.content}>
                    {/* Like/Nope Labels */}
                    <Animated.View style={[styles.label, styles.likeLabel, likeOpacity]}>
                        <Text style={styles.labelText}>LIKE</Text>
                    </Animated.View>
                    <Animated.View style={[styles.label, styles.nopeLabel, nopeOpacity]}>
                        <Text style={styles.labelText}>PASS</Text>
                    </Animated.View>

                    {/* Avatar Circle */}
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {professor.professor_name?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    </View>

                    {/* Professor Info */}
                    <Text style={styles.name}>{professor.professor_name || 'Unknown Professor'}</Text>
                    <Text style={styles.title}>{professor.title || 'Professor'}</Text>

                    {professor.department && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{professor.department}</Text>
                        </View>
                    )}

                    {professor.school && (
                        <Text style={styles.school}>{professor.school}</Text>
                    )}

                    {/* Match Score */}
                    <View style={styles.matchContainer}>
                        <View style={styles.matchCircle}>
                            <Text style={styles.matchScore}>{matchPercentage}%</Text>
                            <Text style={styles.matchLabel}>Match</Text>
                        </View>
                    </View>

                    {/* Summary - Constrained Box */}
                    {professor.summary && (
                        <View style={styles.summaryContainer}>
                            <Text style={styles.summary} numberOfLines={8}>
                                {professor.summary}
                            </Text>
                        </View>
                    )}

                    {/* Research Keywords - Text List */}
                    {professor.keywords && professor.keywords.length > 0 && (
                        <Text style={styles.keywordListText}>
                            {professor.keywords.slice(0, 5).join('  •  ')}
                        </Text>
                    )}

                    {/* Links Collection (Normalized) */}
                    <View style={styles.linksContainer}>
                        {(professor.links && professor.links.length > 0 ? professor.links : (professor.primary_url ? [{ label: 'Visit Website', url: professor.primary_url }] : []))
                            .filter(l => l.url) // Ensure URL exists
                            .map((link, index) => (
                                <Pressable
                                    key={index}
                                    style={styles.linkButton}
                                    onPress={() => {
                                        if (link.url) {
                                            import('react-native').then(({ Linking }) => {
                                                Linking.openURL(link.url).catch(err => console.error("Couldn't load page", err));
                                            });
                                        }
                                    }}
                                >
                                    <IconSymbol name="link" size={14} color="#3b82f6" style={{ marginRight: 6 }} />
                                    <Text style={styles.linkButtonText}>{link.label || 'Website'}</Text>
                                </Pressable>
                            ))}
                    </View>
                </View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: SCREEN_WIDTH * 0.9,
        height: SCREEN_HEIGHT * 0.7,
        borderRadius: 24,
        overflow: 'hidden', // Ensure background doesn't leak
    },
    cardBehind: {
        transform: [{ scale: 0.95 }],
        opacity: 0.8,
    },
    cardBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: '#1e293b', // Monotone dark gray
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 24,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        position: 'absolute',
        top: 40,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 3,
    },
    likeLabel: {
        right: 20,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
    },
    nopeLabel: {
        left: 20,
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.2)',
    },
    labelText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    avatarContainer: {
        marginBottom: 20,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    avatarText: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff',
    },
    name: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 12,
    },
    badge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    school: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 16,
    },
    matchContainer: {
        marginVertical: 16,
    },
    matchCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#4ade80',
    },
    matchScore: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    matchLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    summaryContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: 16,
        borderRadius: 12,
        marginVertical: 12,
        width: '100%',
        alignItems: 'center', // Center content
    },
    summary: {
        fontSize: 14,
        color: '#cbd5e1', // Slate-300
        lineHeight: 22, // Better readability
        textAlign: 'justify', // Clean block text
        maxWidth: 500, // Constraint width
    },
    keywordListText: {
        marginTop: 16,
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    linksContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12, // Space between buttons
        marginTop: 20,
    },
    linkButton: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // Blue tint
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
    },
    linkButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
    },
});
