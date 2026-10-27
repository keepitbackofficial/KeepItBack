import React from 'react';
import { Text as NativeText, TextProps, TextStyle } from 'react-native';
import { colors, fontFamily } from '../theme';

/** Keep default body text consistent while allowing editorial type styles to override it. */
export function KIBText({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        { color: colors.text, fontFamily: fontFamily.body, includeFontPadding: false } as TextStyle,
        style,
      ]}
    />
  );
}
