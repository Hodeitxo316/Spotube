// src/navigation/RootNavigator.tsx
import React, { useState } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SearchScreen } from '../screens/SearchScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { MiniPlayer } from '../components/MiniPlayer';
import { COLORS } from './theme';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const [isPlayerModalVisible, setPlayerModalVisible] = useState(false);

  return (
    <NavigationContainer>
      <View style={styles.wrapper}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Search" component={SearchScreen} />
        </Stack.Navigator>

        {/* Floating MiniPlayer */}
        <MiniPlayer onPressExpand={() => setPlayerModalVisible(true)} />

        {/* Full Player Modal */}
        <Modal
          visible={isPlayerModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setPlayerModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <PlayerScreen />
          </View>
        </Modal>
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
});