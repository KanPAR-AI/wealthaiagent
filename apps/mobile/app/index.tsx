import React from 'react';
import { StatusBar } from 'expo-status-bar';
import ChatWindow from '../components/chat/chat-window';
import '../global.css';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <ChatWindow />
    </>
  );
}
