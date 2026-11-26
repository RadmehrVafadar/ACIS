import { createRoot } from 'react-dom/client';
import App from './App';
import './theme.css';
import './styles.css';
import './library.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
