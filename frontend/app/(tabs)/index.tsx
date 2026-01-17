import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import EventSource from 'react-native-sse';
import * as DocumentPicker from 'expo-document-picker';

import { ProfessorCard, Professor } from '@/components/ProfessorCard';
import { SwipeButtons } from '@/components/SwipeButtons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LiveScanVisualizer } from '@/components/LiveScanVisualizer';
import { useLikedProfessors } from '@/context/LikedProfessorsContext';

const API_BASE_URL = 'http://localhost:8000';

export default function DiscoverScreen() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [scanEvents, setScanEvents] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { likedProfessors, addLikedProfessor, clearLikedProfessors } = useLikedProfessors();
  const [isParsingResume, setIsParsingResume] = useState(false);

  const currentProfessor = professors[currentIndex];
  const nextProfessor = professors[currentIndex + 1];

  const handleUploadResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setIsParsingResume(true);

      // Create FormData
      const formData = new FormData();

      if (asset.file) {
        // Web: Use the native File object directly
        formData.append('file', asset.file);
      } else {
        // Mobile: React Native expects an object with uri, name, type
        formData.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf'
        } as any);
      }

      const response = await fetch(`${API_BASE_URL}/parse-resume`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Do NOT set Content-Type header manually for FormData, let browser/RN set it with boundary
        },
      });

      if (!response.ok) {
        throw new Error('Resume parsing failed');
      }

      const data = await response.json();

      // Auto-fill prompt
      if (data.summary) {
        const newPrompt = data.summary;
        setCustomPrompt(newPrompt);
        Alert.alert("Resume Analyzed", "We've updated your search prompt based on your resume!");
      }

    } catch (error) {
      console.error("Upload failed", error);
      Alert.alert("Error", "Failed to parse resume. Please try again.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleSwipeLeft = useCallback(() => {
    console.log('Passed on:', currentProfessor?.professor_name);
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfessor]);

  const handleSwipeRight = useCallback(() => {
    if (currentProfessor) {
      console.log('Liked:', currentProfessor.professor_name);
      addLikedProfessor(currentProfessor);
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfessor, addLikedProfessor]);

  const handleStartSession = async () => {
    if (!sessionUrl.trim()) {
      Alert.alert("URL Required", "Please enter a university URL to start scanning.");
      return;
    }
    // Logic: Prompt is optional but encouraged.

    setIsLoading(true);
    setProfessors([]);
    setScanEvents([]);
    setCurrentIndex(0);
    setSessionId(null);

    try {
      // 1. Create Session
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: "d6ed9bed-5e3e-41c0-85fd-d6bf925f150c",
          root_urls: [sessionUrl],
          objective_prompt: customPrompt.trim() || "Find professors",
          custom_prompt: customPrompt.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const newSessionId = data.session.id;
      setSessionId(newSessionId);

      // 2. Connect directly to SSE for logs
      startSSE(newSessionId);

    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start crawling session');
      setIsLoading(false);
    }
  };

  const startSSE = (id: string) => {
    const es = new EventSource(`${API_BASE_URL}/sessions/${id}/stream`);

    es.addEventListener('open', () => {
      console.log("Open SSE connection");
    });

    es.addEventListener('message', (event: any) => {
      try {
        if (event.data) {
          const payload = JSON.parse(event.data);

          if (event.data === "STREAM_DONE" || payload.type === 'end' || payload.type === 'complete') {
            es.close();
            fetchResults(id);
            return;
          }

          setScanEvents(prev => [...prev, payload]);
        }
      } catch (e) {
        console.log("Error parsing SSE", e);
      }
    });

    es.addEventListener('error', (event: any) => {
      console.log('SSE Error:', event);
      // If error occurs (like 404 or connection drop), assume finished or failed
      es.close();

      // Delay slightly to allow backend to finish writing if it was a race
      setTimeout(() => {
        fetchResults(id);
      }, 1000);
    });
  };

  const fetchResults = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${id}`);
      const data = await res.json();
      if (data.cards && data.cards.length > 0) {
        setProfessors(data.cards);
      } else {
        // Just show state, user will see in visualizer logs that nothing was found
      }
    } catch (e) {
      console.error("Failed to fetch results", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    clearLikedProfessors();
    setSessionUrl('');
    setCustomPrompt('');
    setProfessors([]);
    setScanEvents([]);
  };

  const isOutOfCards = professors.length > 0 && currentIndex >= professors.length;
  const showCards = professors.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>LabMatch</Text>
        <View style={styles.headerRight}>
          <Text style={styles.likeCount}>
            ❤️ {likedProfessors.length}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LiveScanVisualizer events={scanEvents} />
            <Text style={styles.loadingText}>
              AI Agent is analyzing faculty pages...
            </Text>
          </View>
        ) : showCards && !isOutOfCards ? (
          <View style={styles.cardWrapper}>
            {nextProfessor && (
              <ProfessorCard
                key={nextProfessor.id}
                professor={nextProfessor}
                onSwipeLeft={() => { }}
                onSwipeRight={() => { }}
                isFirst={false}
              />
            )}
            {currentProfessor && (
              <ProfessorCard
                key={currentProfessor.id}
                professor={currentProfessor}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                isFirst={true}
              />
            )}

            <View style={styles.swipeButtonsContainer}>
              <SwipeButtons
                onPass={handleSwipeLeft}
                onLike={handleSwipeRight}
              />
            </View>
          </View>
        ) : isOutOfCards ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="checkmark.circle.fill" size={80} color="#4ade80" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              You've reviewed all {professors.length} professors.{'\n'}
              You liked {likedProfessors.length} professor{likedProfessors.length !== 1 ? 's' : ''}.
            </Text>
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Start Over</Text>
            </Pressable>
          </View>
        ) : (
          // Initial State - Welcome with Centered Search
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIcon}>
              <IconSymbol name="sparkles" size={32} color="#f8fafc" />
            </View>
            <Text style={styles.welcomeTitle}>LabMatch</Text>
            <Text style={styles.welcomeSubtitle}>
              Find professors and research labs effortlessly.
            </Text>

            {/* Search Inputs Centered Here */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardAvoidingView}
            >
              <View style={styles.inputArea}>
                {/* Resume Upload Button */}
                <Pressable
                  style={styles.resumeButton}
                  onPress={handleUploadResume}
                  disabled={isParsingResume}
                >
                  {isParsingResume ? (
                    <ActivityIndicator size="small" color="#94a3b8" />
                  ) : (
                    <IconSymbol name="doc.text" size={16} color="#94a3b8" />
                  )}
                  <Text style={styles.resumeButtonText}>
                    {isParsingResume ? "Analyzing Resume..." : "Upload Resume (PDF) for Context"}
                  </Text>
                </Pressable>

                {/* URL Input */}
                <View style={styles.urlInputContainer}>
                  <IconSymbol name="link" size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.urlInput}
                    placeholder="Department URL (e.g. cs.university.edu/people)"
                    placeholderTextColor="#64748b"
                    value={sessionUrl}
                    onChangeText={setSessionUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Prompt Input */}
                <View style={styles.promptContainer}>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="What are you looking for? (e.g. AI agents, systems)..."
                    placeholderTextColor="#64748b"
                    value={customPrompt}
                    onChangeText={setCustomPrompt}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.sendButton, (!sessionUrl) && styles.sendButtonDisabled]}
                    onPress={handleStartSession}
                    disabled={!sessionUrl}
                  >
                    <IconSymbol name="arrow.up" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Dark theme background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc', // White logo
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  swipeButtonsContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    fontWeight: '500',
  },
  welcomeContainer: {
    alignItems: 'center',
    padding: 40,
    maxWidth: 600,
    width: '100%',
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#1e293b',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  // Centered Search Area
  inputArea: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b', // Dark input
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    height: 50,
  },
  urlInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#f8fafc', // White text
  },
  promptContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 80,
  },
  promptInput: {
    flex: 1,
    marginRight: 12,
    fontSize: 15,
    color: '#f8fafc',
    minHeight: 60,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6', // Blue accent
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  resetButton: {
    marginTop: 24,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  lowResultWarning: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    marginHorizontal: 40,
    fontStyle: 'italic',
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resumeButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
});
