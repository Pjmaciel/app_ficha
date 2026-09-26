import './styles/main.css';
import { iniciar } from './ui/app';

const raiz = document.getElementById('app');
if (raiz) iniciar(raiz);

// O service worker só é registrado em produção.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((erro) => console.error('Falha ao registrar o service worker', erro));
  });
}
