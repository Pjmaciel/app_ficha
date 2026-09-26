// Placeholder: a interface real será escrita pelo worker D.
const raiz = document.getElementById('app');
if (raiz) raiz.textContent = 'app_ficha';

// O service worker só é registrado em produção.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((erro) => console.error('Falha ao registrar o service worker', erro));
  });
}
