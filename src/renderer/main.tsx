import './pixi-init';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import TauriChatApp from './chat/TauriChatApp';
import PetApp from './pet/PetApp';
import './styles/global.css';

const mode = new URLSearchParams(window.location.search).get('mode');
const isTauri = !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;

function resolveEntry() {
  if (mode === 'pet') {
    return <PetApp />;
  }

  if (isTauri) {
    return <TauriChatApp />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {resolveEntry()}
  </React.StrictMode>
);
