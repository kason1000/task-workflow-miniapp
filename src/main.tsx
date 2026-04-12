import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/LocaleContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UserProvider } from './contexts/UserContext';
import { GroupProvider } from './contexts/GroupContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';
import './themes/noir.css';
import './themes/aurora.css';

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
