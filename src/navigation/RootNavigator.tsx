// src/navigation/RootNavigator.tsx

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  View,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import FontAwesome from '@react-native-vector-icons/fontawesome';

import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { AlbumScreen } from '../screens/AlbumScreen';
import { ArtistScreen } from '../screens/ArtistScreen';
import { MiniPlayer } from '../components/MiniPlayer';

import { COLORS } from '../constants/theme';

import {
  initializeListeningHistoryTracking,
} from '../services/listeningHistory';

type RootStackParamList = {
  Main: undefined;

  Album: {
    albumName: string;
    artistName: string;
    albumArtwork: string;
    tracks: any[];
  };

  Artist: {
    artistId: string;
    artistName: string;
    artistThumbnail: string;
  };
};

const Tab = createBottomTabNavigator();
const Stack =
  createNativeStackNavigator<RootStackParamList>();

/* -------------------------------------------------------------------------- */
/* TAB ICON                                                                    */
/* -------------------------------------------------------------------------- */

type TabIconProps = {
  name:
    | 'home'
    | 'search'
    | 'book';

  color: string;

  focused: boolean;
};

const TabIcon = ({
  name,
  color,
  focused,
}: TabIconProps) => {
  const scale = useRef(
    new Animated.Value(
      focused ? 1 : 0.92
    )
  ).current;

  const translateY = useRef(
    new Animated.Value(
      focused ? -2 : 0
    )
  ).current;

  const backgroundOpacity = useRef(
    new Animated.Value(
      focused ? 1 : 0
    )
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.92,
        useNativeDriver: true,
        tension: 140,
        friction: 8,
      }),

      Animated.spring(translateY, {
        toValue: focused ? -2 : 0,
        useNativeDriver: true,
        tension: 140,
        friction: 8,
      }),

      Animated.timing(
        backgroundOpacity,
        {
          toValue: focused ? 1 : 0,
          duration: 180,
          useNativeDriver: true,
        }
      ),
    ]).start();
  }, [
    focused,
    scale,
    translateY,
    backgroundOpacity,
  ]);

  const animatedBackground =
    backgroundOpacity.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

  return (
    <Animated.View
      style={[
        styles.tabIconWrapper,
        {
          transform: [
            { scale },
            { translateY },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.tabIconContainer,
          {
            opacity:
              animatedBackground,
          },
          focused &&
            styles.tabIconContainerActive,
        ]}
      />

      <View
        style={
          styles.tabIconContent
        }
      >
        <FontAwesome
          name={name}
          size={
            focused ? 20 : 18
          }
          color={color}
        />
      </View>

      <Animated.View
        style={[
          styles.activeIndicator,
          {
            opacity:
              backgroundOpacity,

            transform: [
              {
                scaleX:
                  backgroundOpacity.interpolate(
                    {
                      inputRange: [
                        0,
                        1,
                      ],
                      outputRange: [
                        0.2,
                        1,
                      ],
                    }
                  ),
              },
            ],
          },
        ]}
      />
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* TABS                                                                        */
/* -------------------------------------------------------------------------- */

const TabNavigator = () => {
  const insets =
    useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarShowLabel: true,

        tabBarActiveTintColor:
          COLORS.primary,

        tabBarInactiveTintColor:
          '#777777',

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 4,
          marginBottom: 0,
        },

        tabBarItemStyle: {
          height: 68,
          paddingTop: 0,
          paddingBottom: 2,
        },

        tabBarStyle: {
          position: 'absolute',

          left: 14,
          right: 14,

          bottom:
            Math.max(
              insets.bottom,
              8
            ) + 8,

          height: 72,

          backgroundColor:
            '#171717',

          borderWidth: 1,
          borderColor:
            '#292929',

          borderRadius: 22,

          paddingTop: 4,
          paddingBottom: 3,

          zIndex: 200,
          elevation: 20,

          shadowColor:
            '#000000',

          shadowOpacity: 0.5,

          shadowRadius: 20,

          shadowOffset: {
            width: 0,
            height: 10,
          },
        },

        tabBarIcon: ({
          color,
          focused,
        }) => {
          let iconName:
            | 'home'
            | 'search'
            | 'book' =
            'search';

          if (
            route.name ===
            'Home'
          ) {
            iconName = 'home';
          } else if (
            route.name ===
            'Library'
          ) {
            iconName = 'book';
          }

          return (
            <TabIcon
              name={iconName}
              color={color}
              focused={focused}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
        }}
      />

      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Buscar',
        }}
      />

      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          tabBarLabel: 'Biblioteca',
        }}
      />
    </Tab.Navigator>
  );
};

/* -------------------------------------------------------------------------- */
/* ROOT NAVIGATOR                                                              */
/* -------------------------------------------------------------------------- */

export const RootNavigator = () => {
  const [
    isPlayerModalVisible,
    setPlayerModalVisible,
  ] = useState(false);

  /*
   * El historial se inicializa una sola vez
   * mientras vive el RootNavigator.
   *
   * No depende de HomeScreen, así que las
   * reproducciones desde Search, Library,
   * Album o Artist también pueden registrarse.
   */
  useEffect(() => {
    const cleanup =
      initializeListeningHistoryTracking();

    return cleanup;
  }, []);

  return (
    <NavigationContainer>
      <View
        style={styles.wrapper}
      >
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

          <Stack.Screen
            name="Artist"
            component={ArtistScreen}
          />
        </Stack.Navigator>

        {/* MiniPlayer flotante persistente */}
        <MiniPlayer
          onPressExpand={() =>
            setPlayerModalVisible(true)
          }
        />

        {/* Reproductor modal de pantalla completa */}
        <Modal
          visible={
            isPlayerModalVisible
          }
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() =>
            setPlayerModalVisible(
              false
            )
          }
        >
          <View
            style={
              styles.modalContainer
            }
          >
            <PlayerScreen
              onClose={() =>
                setPlayerModalVisible(
                  false
                )
              }
            />
          </View>
        </Modal>
      </View>
    </NavigationContainer>
  );
};

/* -------------------------------------------------------------------------- */
/* STYLES                                                                      */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  modalContainer: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  /* ---------------------------------------------------------------------- */
  /* TAB ICON                                                                */
  /* ---------------------------------------------------------------------- */

  tabIconWrapper: {
    width: 48,
    height: 34,
    alignItems: 'center',
    justifyContent:
      'flex-start',
    position: 'relative',
    paddingTop: 1,
  },

  tabIconContainer: {
    position: 'absolute',

    width: 42,
    height: 32,

    borderRadius: 11,

    backgroundColor:
      '#FF5C00',
  },

  tabIconContainerActive: {
    backgroundColor:
      'rgba(255, 92, 0, 0.16)',
  },

  tabIconContent: {
    width: 42,
    height: 32,

    alignItems: 'center',
    justifyContent:
      'center',

    zIndex: 2,
  },

  activeIndicator: {
    position: 'absolute',

    bottom: -3,

    width: 16,
    height: 3,

    borderRadius: 2,

    backgroundColor:
      COLORS.primary,
  },
});

export default RootNavigator;