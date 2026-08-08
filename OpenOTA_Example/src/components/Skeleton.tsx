import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

import { colors } from "../theme/colors";
import { radius } from "../theme/spacing";

export function Skeleton({ width = "100%", height = 16, style }: { width?: number | `${number}%`; height?: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, opacity }, style]} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={120} height={12} style={{ marginBottom: 10 }} />
      <Skeleton width="60%" height={22} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
});
