// Aba Combate: fontes nomeadas, dados extras e regra de fiéis de cada valor, dano e golpes especiais.
import { combate, dano } from '../../engine';
import type { AtributoId, EntradaCombate } from '../../model/types';
import {
  ATRIBUTOS, CHAVES_COMBATE, ROTULO_ATRIBUTO, ROTULO_COMBATE, editorFontes, rolagem,
} from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, entradaTexto, h, novoIdItem, selecao } from '../dom';

const AJUDA_FIEIS = 'Fiéis por bônus: +1 a cada N fiéis (vazio = não se aplica).';

function campoFieisPor(ctx: Contexto, dono: { fieisPor: number | null }): HTMLElement {
  const entrada = entradaNumero(dono.fieisPor, (v) => { dono.fieisPor = v !== null && v > 0 ? v : null; ctx.mudou(); }, { min: 1, aceitaVazio: true });
  return campo(AJUDA_FIEIS, entrada);
}

function cartaoEntrada(ctx: Contexto, chave: keyof typeof ROTULO_COMBATE): HTMLElement {
  const f = ctx.ficha;
  const entrada: EntradaCombate = f().combate[chave];
  const resultado = h('p', { class: 'valor-grande' });
  ctx.ligar(() => {
    const c = combate(f(), chave);
    definirTexto(resultado, rolagem(c.dados, c.total));
  });
  return h('section', { class: 'cartao' },
    h('h3', {}, ROTULO_COMBATE[chave]),
    resultado,
    editorFontes(ctx, entrada.fontes, { titulo: `Fontes de ${ROTULO_COMBATE[chave]}`, adicionar: 'Adicionar fonte', cabecalho: true, vazio: 'Sem fontes.' }),
    editorFontes(ctx, entrada.dadosExtras, { titulo: `Dados extras de ${ROTULO_COMBATE[chave]}`, adicionar: 'Adicionar dado extra', cabecalho: true, vazio: 'Sem dados extras.' }),
    campoFieisPor(ctx, entrada));
}

function cartaoDano(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const d = f().dano;
  const resultado = h('p', { class: 'valor-grande' });
  ctx.ligar(() => definirTexto(resultado, dano(f()).texto));
  const atributo = selecao<AtributoId>(
    ATRIBUTOS.map((id) => [id, ROTULO_ATRIBUTO[id]]), d.atributo,
    (v) => { d.atributo = v; ctx.mudou(); });
  return h('section', { class: 'cartao' },
    h('h3', {}, 'Dano'),
    resultado,
    campo('Atributo do multiplicador', atributo),
    editorFontes(ctx, d.dadosExtras, { titulo: 'Dados extras de dano', adicionar: 'Adicionar dado extra', cabecalho: true, vazio: 'Sem dados extras.' }),
    editorFontes(ctx, d.fixos, { titulo: 'Bônus fixos de dano', adicionar: 'Adicionar bônus fixo', cabecalho: true, vazio: 'Sem bônus fixos.' }),
    campoFieisPor(ctx, d));
}

function secaoGolpes(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const lista = h('div', { class: 'lista-golpes' });

  const desenhar = (focar?: number): void => {
    lista.replaceChildren();
    if (f().golpes.length === 0) lista.append(h('p', { class: 'vazio' }, 'Nenhum golpe especial.'));
    f().golpes.forEach((g, i) => {
      const nome = entradaTexto(g.nome, (v) => { g.nome = v; ctx.mudou(); }, 'Nome do golpe');
      lista.append(h('article', { class: 'cartao golpe-editor' },
        h('div', { class: 'campos' },
          campo('Nome do golpe', nome),
          campo('Dados extras de ataque', entradaNumero(g.dadosAtaqueExtras, (v) => { g.dadosAtaqueExtras = v ?? 0; ctx.mudou(); })),
          campo('Dados extras de dano', entradaNumero(g.dadosDanoExtras, (v) => { g.dadosDanoExtras = v ?? 0; ctx.mudou(); }))),
        h('button', {
          type: 'button', class: 'remover',
          onclick: () => {
            if (!window.confirm(`Remover o golpe "${g.nome || 'sem nome'}"?`)) return;
            f().golpes.splice(i, 1);
            desenhar();
            ctx.mudou();
          },
        }, 'Remover golpe')));
    });
    if (focar !== undefined) lista.querySelectorAll<HTMLInputElement>('input[type="text"]')[focar]?.focus();
  };
  desenhar();

  return h('section', {},
    h('h2', {}, 'Golpes especiais'),
    h('p', { class: 'detalhe' }, 'Os dados extras somam aos dados do ataque com arma branca e do dano básico. Cada golpe aparece no Resumo de Combate.'),
    lista,
    h('button', {
      type: 'button',
      onclick: () => {
        const novo = { id: novoIdItem('golpe'), nome: 'Novo golpe', dadosAtaqueExtras: 0, dadosDanoExtras: 0, ativo: false };
        f().golpes.push(novo);
        desenhar(f().golpes.length - 1);
        ctx.mudou();
      },
    }, 'Adicionar golpe'));
}

export function abaCombate(ctx: Contexto): HTMLElement {
  return h('div', {},
    h('p', { class: 'detalhe' },
      'Cada valor é o alvo da fórmula (perícia ou atributo) mais as fontes nomeadas e o bônus de fiéis. Os dados são os do nível mais os extras.'),
    h('div', { class: 'grade grade-larga' }, ...CHAVES_COMBATE.map((c) => cartaoEntrada(ctx, c)), cartaoDano(ctx)),
    secaoGolpes(ctx));
}

