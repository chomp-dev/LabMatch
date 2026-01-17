import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Professor } from '@/components/ProfessorCard';
import { useLikedProfessors } from '@/context/LikedProfessorsContext';

interface ProfessorListItemProps {
  professor: Professor;
  onPress: () => void;
  onEmail: () => void;
  onRemove: () => void;
}

function ProfessorListItem({ professor, onPress, onEmail, onRemove }: ProfessorListItemProps) {
  const matchPercentage = Math.round((professor.match_score ?? 0) * 100);

  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {professor.professor_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.professorName}>{professor.professor_name}</Text>
        <Text style={styles.professorTitle}>{professor.title}</Text>
        <Text style={styles.professorSchool}>{professor.school}</Text>

        <View style={styles.keywordsRow}>
          {professor.keywords?.slice(0, 2).map((keyword, index) => (
            <View key={index} style={styles.keywordBadge}>
              <Text style={styles.keywordBadgeText}>{keyword}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.itemActions}>
        <View style={styles.topActions}>
          <View style={styles.matchBadge}>
            <Text style={styles.matchText}>{matchPercentage}%</Text>
          </View>
        </View>

        <View style={styles.bottomActions}>
          <Pressable style={styles.removeButton} onPress={onRemove}>
            <IconSymbol name="xmark" size={20} color="#f87171" />
          </Pressable>
          <Pressable style={styles.emailButton} onPress={onEmail}>
            <IconSymbol name="envelope.fill" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function LikedScreen() {
  const { likedProfessors, removeLikedProfessor } = useLikedProfessors();

  const handleProfessorPress = (professor: Professor) => {
    if (professor.primary_url) {
      Linking.openURL(professor.primary_url);
    }
  };

  const handleEmailPress = (professor: Professor) => {
    console.log('Draft email for:', professor.professor_name);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>Liked Professors</Text>
        <Text style={styles.subtitle}>
          {likedProfessors.length} professor{likedProfessors.length !== 1 ? 's' : ''} saved
        </Text>
      </View>

      {likedProfessors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="heart" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No liked professors yet</Text>
          <Text style={styles.emptySubtitle}>
            Swipe right on professors you're interested in{'\n'}to save them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={likedProfessors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ProfessorListItem
              professor={item}
              onPress={() => handleProfessorPress(item)}
              onEmail={() => handleEmailPress(item)}
              onRemove={() => removeLikedProfessor(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  itemContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  professorName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  professorTitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  professorSchool: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  keywordsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  keywordBadge: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  keywordBadgeText: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '500',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 8,
    flex: 0,
    minWidth: 80,
  },
  topActions: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
  },
  matchBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  emailButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
});
