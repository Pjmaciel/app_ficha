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

// Quando um novo service worker assume o controle, recarrega uma única vez para exibir a versão nova.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const havia = navigator.serviceWorker.controller !== null;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!havia || recarregou) return;
    recarregou = true;
    window.location.reload();
  });
}
