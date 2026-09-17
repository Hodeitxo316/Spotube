declare module 'react-native-vector-icons/FontAwesome' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';

  interface FontAwesomeProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  const FontAwesome: ComponentType<FontAwesomeProps>;

  export default FontAwesome;
}