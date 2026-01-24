import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SocketProvider } from './contexts/SocketContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>

    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />

    <BrowserRouter>
      <SocketProvider>
        <App />
      </SocketProvider>

    </BrowserRouter>
  </React.StrictMode>
);
