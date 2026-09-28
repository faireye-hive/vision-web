import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, getInitialTheme } from './utils/theme';
import { applyReadingStyle, readReadingStyle } from './utils/readingStyle';

const initialTheme = getInitialTheme();
applyTheme(initialTheme);
applyReadingStyle(readReadingStyle(), initialTheme);

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
