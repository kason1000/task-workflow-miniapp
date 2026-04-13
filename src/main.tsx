import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/LocaleContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserProvider } from './contexts/UserContext';
import { GroupProvider } from './contexts/GroupContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';
import './themes/dark.css';
import './themes/ocean.css';
import './themes/sunset.css';
import './themes/forest.css';
import './designs/mosaic/mosaic.css';
import './designs/command/command.css';
import './designs/elder/elder.css';
import './designs/zen/zen.css';
import './designs/retro/retro.css';
import './designs/glass/glass.css';
import './designs/brutalist/brutalist.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <UserProvider>
            <GroupProvider>
              <App />
            </GroupProvider>
          </UserProvider>
        </ErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>
  </React.StrictMode>
);
