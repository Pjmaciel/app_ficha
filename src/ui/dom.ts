// Utilitário mínimo para criar elementos DOM sem framework.
type Filho = Node | string | null | undefined | false;
type Atributos = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos: Atributos = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false) continue;
    if (chave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(chave.slice(2).toLowerCase(), valor as EventListener);
    } else if (chave === 'class') {
      el.className = String(valor);
    } else if (valor === true) {
      el.setAttribute(chave, '');
    } else {
      el.setAttribute(chave, String(valor));
    }
  }
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(typeof filho === 'string' ? document.createTextNode(filho) : filho);
  }
  return el;
}

export function limpar(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function inteiro(valor: string, padrao = 0): number {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : padrao;
}
