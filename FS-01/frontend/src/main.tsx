import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { DialogProvider } from './components/ui';

createRoot(document.getElementById('root')!).render(
  <DialogProvider>
    <App />
  </DialogProvider>,
);
