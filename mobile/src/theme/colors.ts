/**
 * WhatsApp-inspired green color palette for WealthWise AI
 */

export const colors = {
  // WhatsApp brand greens
  whatsappGreen: '#25D366',
  whatsappTeal: '#128C7E',
  whatsappDarkTeal: '#075E54',
  whatsappLightGreen: '#DCF8C6',

  // Primary palette
  primary: '#128C7E',
  primaryLight: '#25D366',
  primaryDark: '#075E54',

  // Semantic
  success: '#2ED573',
  error: '#FF6B6B',
  warning: '#F59E0B',
  info: '#128C7E',

  light: {
    background: '#F0F2F5',
    surface: '#FFFFFF',
    surfaceVariant: '#F0F2F5',
    text: '#111B21',
    textSecondary: '#667781',
    textMuted: '#8696A0',
    border: '#E9EDEF',
    borderLight: '#F0F2F5',
    headerBg: '#075E54',
    headerText: '#FFFFFF',
    chatBg: '#ECE5DD',
    outgoingBubble: '#DCF8C6',
    outgoingText: '#111B21',
    incomingBubble: '#FFFFFF',
    incomingText: '#111B21',
    inputBg: '#FFFFFF',
    inputBorder: '#E9EDEF',
    tabBarBg: '#FFFFFF',
    icon: '#54656F',
    iconActive: '#075E54',
  },

  dark: {
    background: '#0B141A',
    surface: '#1F2C34',
    surfaceVariant: '#233138',
    text: '#E9EDEF',
    textSecondary: '#8696A0',
    textMuted: '#667781',
    border: '#233138',
    borderLight: '#2A3942',
    headerBg: '#1F2C34',
    headerText: '#E9EDEF',
    chatBg: '#0B141A',
    outgoingBubble: '#005C4B',
    outgoingText: '#E9EDEF',
    incomingBubble: '#1F2C34',
    incomingText: '#E9EDEF',
    inputBg: '#1F2C34',
    inputBorder: '#2A3942',
    tabBarBg: '#1F2C34',
    icon: '#8696A0',
    iconActive: '#25D366',
  },
} as const;

export type ThemeColors = typeof colors.light;
