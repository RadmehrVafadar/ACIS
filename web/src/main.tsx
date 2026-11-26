import { LazyMotion, MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/bricolage-grotesque';
import './theme.css';
import './styles.css';
import './library.css';

const loadMotionFeatures = () => import('./motion-features').then((module) => module.default);
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures}>
        <App />
      </LazyMotion>
    </MotionConfig>,
  );
}
