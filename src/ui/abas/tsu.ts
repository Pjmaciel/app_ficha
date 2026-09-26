// Aba Tsu: nível e marcador de Tsu real por elemento (real vale oito vezes o nível).
import { tsuValor } from '../../engine';
import { ROTULO_ELEMENTO } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, h } from '../dom';

export function abaTsu(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  return h('div', { class: 'grade' }, ...f().tsu.map((t) => {
    const valor = h('p', { class: 'valor-grande' });
    const detalhe = h('p', { class: 'detalhe' });
    ctx.ligar(() => {
      definirTexto(valor, String(tsuValor(t)));
      definirTexto(detalhe, t.real ? `Tsu real: nível ${t.nivel} × 8` : 'Tsu comum: vale o nível');
    });
    const real = h('input', { type: 'checkbox', checked: t.real });
    real.addEventListener('change', () => { t.real = real.checked; ctx.mudou(); });
    return h('article', { class: 'cartao' },
      h('h3', {}, ROTULO_ELEMENTO[t.elemento]),
      valor,
      detalhe,
      campo(`Nível de ${ROTULO_ELEMENTO[t.elemento]}`, entradaNumero(t.nivel, (v) => { t.nivel = v ?? 0; ctx.mudou(); }, { min: 0 })),
      h('label', { class: 'marcador' }, real, h('span', {}, 'Tsu real')));
  }));
}
