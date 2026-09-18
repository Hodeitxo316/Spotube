// src/navigation/RootNavigator.tsx
import React, { useState } from 'react';
import { View, Modal, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SearchScreen } from '../screens/SearchScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { AlbumScreen } from '../screens/AlbumScreen';
import { MiniPlayer } from '../components/MiniPlayer';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: COLORS.background,
        borderTopColor: COLORS.border,
        height: 60,
        paddingBottom: 8,
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
    }}
  >
    <Tab.Screen
      name="Search"
      component={SearchScreen}
      options={{
        tabBarLabel: 'Buscar',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔍</Text>,
      }}
    />
    <Tab.Screen
      name="Library"
      component={LibraryScreen}
      options={{
        tabBarLabel: 'Biblioteca',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📚</Text>,
      }}
    />
  </Tab.Navigator>
);

export const RootNavigator = () => {
  const [isPlayerModalVisible, setPlayerModalVisible] = useState(false);

  return (
    <NavigationContainer>
      <View style={styles.wrapper}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="Main"
            component={TabNavigator}
          />

          <Stack.Screen
            name="Album"
            component={AlbumScreen}
          />
        </Stack.Navigator>

        {/* MiniPlayer flotante persistente sobre los tabs */}
        <MiniPlayer onPressExpand={() => setPlayerModalVisible(true)} />

        {/* Reproductor modal de pantalla completa */}
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