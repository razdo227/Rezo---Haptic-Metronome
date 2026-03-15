import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { theme } from '../theme';
import { PATTERNS } from '../constants/ble';
import { PatternInfo } from '../types';

interface PatternPickerProps {
  activePattern: string;
  onPatternSelect: (patternId: string) => void;
}

function PatternCard({
  item,
  isActive,
  onPress,
}: {
  item: PatternInfo;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.cardName, isActive && styles.cardNameActive]}>
        {item.displayName}
      </Text>
      <Text style={[styles.cardDesc, isActive && styles.cardDescActive]}>
        {item.description}
      </Text>
    </TouchableOpacity>
  );
}

export default function PatternPicker({ activePattern, onPatternSelect }: PatternPickerProps) {
  const renderItem = ({ item }: ListRenderItemInfo<PatternInfo>) => (
    <PatternCard
      item={item}
      isActive={item.id === activePattern}
      onPress={() => onPatternSelect(item.id)}
    />
  );

  const keyExtractor = (item: PatternInfo) => item.id;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>PATTERN</Text>
      <FlatList
        data={PATTERNS}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToAlignment="start"
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  card: {
    paddingHorizontal: theme.spacing.md + 4,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 110,
    alignItems: 'center',
  },
  cardActive: {
    backgroundColor: theme.colors.accent + '26',
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  cardName: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 4,
  },
  cardNameActive: {
    color: theme.colors.accent,
  },
  cardDesc: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    opacity: 0.7,
    textAlign: 'center',
  },
  cardDescActive: {
    color: theme.colors.accent,
    opacity: 0.85,
  },
});
