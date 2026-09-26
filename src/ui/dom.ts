// Utilitários mínimos para criar elementos DOM e campos de formulário sem framework.
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

let contador = 0;

/** Identificador único para associar rótulos e campos. */
export function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${contador}`;
}

/** Identificador estável o bastante para itens criados pelo usuário (poderes, golpes). */
export function novoIdItem(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${novoId('').slice(1)}`;
}

/** Associa um rótulo ao campo; com `oculto`, o texto fica visível apenas para leitores de tela. */
export function campo(rotulo: string, entrada: HTMLElement, oculto = false): HTMLLabelElement {
  const id = novoId('campo');
  entrada.id = id;
  return h('label', { class: oculto ? 'campo campo-oculto' : 'campo', for: id },
    h('span', { class: oculto ? 'oculto' : 'rotulo-campo' }, rotulo),
    entrada);
}

interface OpcoesNumero {
  min?: number;
  /** Aceita campo vazio e o devolve como nulo (valores opcionais). */
  aceitaVazio?: boolean;
}

/**
 * Campo numérico inteiro. O modelo é atualizado a cada digitação; o texto do campo só é
 * reescrito ao sair dele (normalização), para nunca tirar o foco de quem está digitando.
 */
export function entradaNumero(
  valor: number | null,
  aoMudar: (v: number | null) => void,
  opcoes: OpcoesNumero = {},
): HTMLInputElement {
  const el = h('input', { type: 'number', inputmode: 'numeric', step: 1, min: opcoes.min, value: valor ?? '' });
  const ler = (): number | null => {
    const texto = el.value.trim();
    if (texto === '') return opcoes.aceitaVazio ? null : 0;
    const n = Number.parseInt(texto, 10);
    if (!Number.isFinite(n)) return opcoes.aceitaVazio ? null : 0;
    return n;
  };
  el.addEventListener('input', () => aoMudar(ler()));
  el.addEventListener('change', () => {
    let v = ler();
    if (v !== null && opcoes.min !== undefined && v < opcoes.min) v = opcoes.min;
    el.value = v === null ? '' : String(v);
    aoMudar(v);
  });
  return el;
}

export function entradaTexto(valor: string, aoMudar: (v: string) => void, placeholder?: string): HTMLInputElement {
  const el = h('input', { type: 'text', value: valor, placeholder, autocomplete: 'off' });
  el.addEventListener('input', () => aoMudar(el.value));
  return el;
}

export function selecao<T extends string>(
  opcoes: [T, string][],
  atual: T,
  aoMudar: (v: T) => void,
): HTMLSelectElement {
  const el = h('select', {}, ...opcoes.map(([valor, rotulo]) => h('option', { value: valor }, rotulo)));
  el.value = atual;
  el.addEventListener('change', () => aoMudar(el.value as T));
  return el;
}

/** Atualiza o texto de um elemento apenas se mudou (evita reflow e ruído para leitores de tela). */
export function definirTexto(el: Element, texto: string): void {
  if (el.textContent !== texto) el.textContent = texto;
}

/** Reescreve o valor de um campo, exceto se o usuário está digitando nele. */
export function definirValor(el: HTMLInputElement, valor: string): void {
  if (document.activeElement !== el && el.value !== valor) el.value = valor;
}
