import "./firebaseConfig";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from './context/ThemeContext';
import { registerExamServiceWorker } from './utils/serviceWorker';

// Register offline exam resilience service worker
registerExamServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
