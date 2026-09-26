// Esqueleto da interface: topo com visão rápida, alertas, painel de sessão, abas e rodapé.
// Regra de ouro: digitar em um campo só recalcula os textos derivados (funções registradas com
// `ligar`); os campos nunca são recriados durante a digitação, então o foco não se perde.
import {
  alertaBonusNivel, bonusNivelEsperado, combate, dadosPorNivel, dano, diferencaAtributos, novaSessao, poderUsavel, pvTotal,
  usoDoPoder, usosPorDiaDoPoder,
} from '../engine';
import type { Ficha } from '../model/types';
import { abaAtributos } from './abas/atributos';
import { abaBatalha } from './abas/batalha';
import { abaCombate } from './abas/combate';
import { abaIdentidade } from './abas/identidade';
import { abaPericias } from './abas/pericias';
import { abaPoderes } from './abas/poderes';
import { abaResumo } from './abas/resumo';
import { abaTsu } from './abas/tsu';
import { ATRIBUTOS, ROTULO_ATRIBUTO, rolagem } from './componentes';
import type { Contexto } from './contexto';
import { campo, definirTexto, definirValor, entradaNumero, h, inteiro, limpar } from './dom';
import { carregar, fichaPadrao, salvar } from './estado';
import { gerarJson, lerJson, lerXlsx } from './importacao';
import { aplicarPv, descansar, limitarPv, mudarFadiga, usarPoder } from './sessao';

const ABAS = ['Batalha', 'Resumo de Combate', 'Identidade', 'Atributos', 'Perícias', 'Combate', 'Poderes', 'Tsu'] as const;
type Aba = (typeof ABAS)[number];

export function iniciar(raiz: HTMLElement): void {
  let { ficha, sessao } = carregar();
  let abaAtiva: Aba = 'Batalha';
  let ligacoesAba: (() => void)[] = [];
  const ligacoesGlobais: (() => void)[] = [];
  const busca = { termo: '' };
  const composicoesAbertas = new Set<string>();

  const cabecalho = h('header', { class: 'cabecalho' });
  const alertas = h('section', { class: 'alertas', 'aria-label': 'Alertas da ficha' });
  const painel = h('section', { class: 'painel-sessao', 'aria-label': 'Painel de sessão' });
  const navegacao = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Seções da ficha' });
  const conteudo = h('main', { class: 'conteudo', id: 'conteudo' });
  const rodape = h('footer', { class: 'rodape' });
  const aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
  raiz.append(cabecalho, alertas, painel, navegacao, conteudo, rodape, aviso);

  const persistir = (): void => salvar(ficha, sessao);
  const avisar = (texto: string): void => definirTexto(aviso, texto);

  function atualizarTudo(): void {
    for (const fn of ligacoesGlobais) fn();
    for (const fn of ligacoesAba) fn();
  }

  const ctx: Contexto = {
    ficha: () => ficha,
    sessao: () => sessao,
    mudou: () => { persistir(); atualizarTudo(); },
    ligar: (fn) => { fn(); ligacoesAba.push(fn); },
    reconstruir: () => renderConteudo(),
    trocarFicha: (nova, reiniciarSessao = false) => {
      ficha = nova;
      if (reiniciarSessao) sessao = novaSessao(ficha);
      persistir();
      renderConteudo();
      atualizarTudo();
    },
    avisar,
    composicoesAbertas,
  };

  // ---------- Topo: visão rápida ----------
  function montarCabecalho(): void {
    const base = import.meta.env.BASE_URL;
    const tile = (rotulo: string, texto: () => string, classe = ''): HTMLElement => {
      const valor = h('strong', {});
      ligacoesGlobais.push(() => definirTexto(valor, texto()));
      return h('div', { class: `tile ${classe}`.trim() }, h('span', { class: 'rotulo' }, rotulo), valor);
    };
    const titulo = h('h1', {});
    const sub = h('p', { class: 'sub' });
    ligacoesGlobais.push(() => {
      definirTexto(titulo, ficha.identidade.nome || 'Sem nome');
      definirTexto(sub, [ficha.identidade.raca, ficha.identidade.reino && `Reino ${ficha.identidade.reino}`, ficha.identidade.jogador && `Jogador: ${ficha.identidade.jogador}`]
        .filter(Boolean).join(' · '));
    });
    const ataque = (): string => { const c = combate(ficha, 'ataqueArmaBranca'); return rolagem(c.dados, c.total); };
    cabecalho.append(
      h('div', { class: 'cabecalho-topo' },
        h('img', { class: 'retrato', src: `${base}assets/retrato.png`, alt: 'Retrato do personagem', width: 88, height: 88 }),
        h('div', { class: 'identidade' }, titulo, sub)),
      h('div', { class: 'visao', role: 'group', 'aria-label': 'Visão rápida' },
        tile('Nível', () => String(ficha.identidade.nivel)),
        tile('Lugânico', () => String(ficha.identidade.nivelLuganico)),
        tile('Pilar', () => ficha.identidade.pilarLuganico || '—'),
        tile('PV', () => `${sessao.pvAtual} / ${pvTotal(ficha)}`),
        tile('Rolagem', () => `${dadosPorNivel(ficha.identidade.nivel)}d×100`),
        tile('Arma principal', () => ficha.identidade.armaPrincipal || '—'),
        tile('Ataque principal', ataque, 'largo'),
        tile('Dano principal', () => dano(ficha).texto, 'largo')),
    );
  }

  // ---------- Alertas ----------
  function desenharAlertas(): void {
    limpar(alertas);
    const bonus = alertaBonusNivel(ficha);
    if (bonus) {
      const esperado = bonusNivelEsperado(ficha);
      alertas.append(h('div', { class: 'alerta-caixa', role: 'alert' },
        h('p', {}, bonus),
        h('button', {
          type: 'button', class: 'destaque',
          onclick: () => {
            for (const id of ATRIBUTOS) ficha.atributos[id].bonusNivel = esperado;
            ctx.trocarFicha(ficha);
            avisar(`Bônus de nível corrigido para ${esperado} em todos os atributos.`);
          },
        }, `Corrigir para ${esperado}`)));
    }
    const d = diferencaAtributos(ficha);
    if (d.excedeu) {
      alertas.append(h('div', { class: 'alerta-caixa', role: 'alert' },
        h('p', {}, `A diferença entre o maior (${ROTULO_ATRIBUTO[d.maior]}) e o menor (${ROTULO_ATRIBUTO[d.menor]}) atributo é ${d.diferencia}, acima do limite de ${d.limite}.`)));
    }
  }
  ligacoesGlobais.push(desenharAlertas);

  // ---------- Painel de sessão ----------
  const listaUsos = h('ul', { class: 'usos' });
  const blocoUsos = h('div', { class: 'bloco largo' }, h('span', { class: 'rotulo' }, 'Usos por dia'), listaUsos);

  function desenharUsos(): void {
    const focado = document.activeElement?.getAttribute('data-uso');
    limpar(listaUsos);
    const usaveis = ficha.poderes.filter(poderUsavel);
    blocoUsos.hidden = usaveis.length === 0;
    for (const p of usaveis) {
      const { usados: usos, esgotado } = usoDoPoder(p, sessao);
      const custo = p.custoFadiga ?? 0;
      listaUsos.append(h('li', {},
        h('span', { class: 'nome-uso' }, p.nome || 'Sem nome'),
        h('span', { class: 'detalhe' },
          `${usos}${usosPorDiaDoPoder(p) !== undefined ? ` / ${usosPorDiaDoPoder(p)}` : ''} usos`,
          custo > 0 ? ` · custo ${custo} de fadiga` : ''),
        h('button', {
          type: 'button', disabled: esgotado, 'data-uso': p.id, 'aria-label': `Usar ${p.nome || 'poder'}`,
          onclick: () => usarPoder(ctx, p),
        }, 'Usar')));
    }
    if (focado) listaUsos.querySelector<HTMLElement>(`[data-uso="${CSS.escape(focado)}"]:not(:disabled)`)?.focus();
  }

  function montarPainel(): void {
    const valorPv = entradaNumero(10, () => {}, { min: 0 });
    const campoPv = entradaNumero(sessao.pvAtual, (v) => {
      sessao.pvAtual = limitarPv(ctx, v ?? 0);
      persistir();
      atualizarTudo();
    }, { min: 0 });
    campoPv.addEventListener('change', () => definirValor(campoPv, String(sessao.pvAtual)));
    const aplicar = (sinal: 1 | -1): void => aplicarPv(ctx, sinal * Math.max(0, inteiro(valorPv.value, 0)));
    const total = h('span', {});
    const preenchimento = h('div', { class: 'preenchimento' });
    const barra = h('div', { class: 'barra pv', role: 'progressbar', 'aria-label': 'Pontos de vida', 'aria-valuemin': 0 }, preenchimento);
    ligacoesGlobais.push(() => {
      const max = pvTotal(ficha);
      definirValor(campoPv, String(sessao.pvAtual));
      definirTexto(total, ` / ${max}`);
      preenchimento.style.width = `${max > 0 ? Math.max(0, Math.min(100, (sessao.pvAtual / max) * 100)) : 0}%`;
      barra.setAttribute('aria-valuemax', String(max));
      barra.setAttribute('aria-valuenow', String(sessao.pvAtual));
    });

    const campoFadiga = entradaNumero(sessao.fadiga, (v) => { sessao.fadiga = Math.max(0, v ?? 0); persistir(); atualizarTudo(); }, { min: 0 });
    campoFadiga.addEventListener('change', () => definirValor(campoFadiga, String(sessao.fadiga)));
    ligacoesGlobais.push(() => definirValor(campoFadiga, String(sessao.fadiga)));
    const passoFadiga = entradaNumero(5, () => {}, { min: 1 });
    const gastarFadiga = (sinal: 1 | -1): void => mudarFadiga(ctx, sinal * Math.max(0, inteiro(passoFadiga.value, 0)));
    ligacoesGlobais.push(desenharUsos);

    painel.append(
      h('div', { class: 'bloco' },
        h('div', { class: 'linha-titulo' }, h('span', { class: 'rotulo' }, 'PV atual'), h('span', { class: 'numeros' }, campo('PV atual', campoPv, true), total)),
        barra,
        h('div', { class: 'controles' },
          h('button', { type: 'button', class: 'perigo', onclick: () => aplicar(-1) }, 'Dano'),
          campo('Valor de dano ou cura', valorPv, true),
          h('button', { type: 'button', class: 'cura', onclick: () => aplicar(1) }, 'Cura'))),
      h('div', { class: 'bloco' },
        h('div', { class: 'linha-titulo' }, h('span', { class: 'rotulo' }, 'Fadiga'), h('span', { class: 'numeros' }, campo('Fadiga', campoFadiga, true))),
        h('div', { class: 'controles' },
          h('button', { type: 'button', onclick: () => gastarFadiga(1) }, 'Gastar'),
          campo('Quantidade de fadiga', passoFadiga, true),
          h('button', { type: 'button', onclick: () => gastarFadiga(-1) }, 'Recuperar'))),
      blocoUsos,
      h('div', { class: 'bloco acoes' },
        h('button', {
          type: 'button', class: 'destaque',
          onclick: () => descansar(ctx),
        }, 'Descansar')),
    );
  }

  // ---------- Abas ----------
  function renderAbas(): void {
    limpar(navegacao);
    ABAS.forEach((nome, i) => {
      const ativa = nome === abaAtiva;
      navegacao.append(h('button', {
        type: 'button', role: 'tab', id: `aba-${i}`, 'aria-selected': String(ativa),
        'aria-controls': 'conteudo', tabindex: ativa ? 0 : -1, class: ativa ? 'aba ativa' : 'aba',
        onclick: () => selecionar(nome),
        onkeydown: (e: Event) => {
          const k = (e as KeyboardEvent).key;
          if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
          const prox = (i + (k === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length;
          selecionar(ABAS[prox]);
          document.getElementById(`aba-${prox}`)?.focus();
        },
      }, nome));
    });
  }

  function selecionar(aba: Aba): void {
    abaAtiva = aba;
    renderAbas();
    renderConteudo();
  }

  function renderConteudo(): void {
    // Na aba Batalha o card "Minha rodada" já traz PV, fadiga, usos e descanso; o painel do topo sairia duplicado.
    painel.hidden = abaAtiva === 'Batalha';
    limpar(conteudo);
    ligacoesAba = [];
    conteudo.setAttribute('role', 'tabpanel');
    conteudo.setAttribute('aria-labelledby', `aba-${ABAS.indexOf(abaAtiva)}`);
    const construtores: Record<Aba, () => HTMLElement> = {
      Batalha: () => abaBatalha(ctx),
      'Resumo de Combate': () => abaResumo(ctx),
      Identidade: () => abaIdentidade(ctx),
      Atributos: () => abaAtributos(ctx),
      Perícias: () => abaPericias(ctx, busca),
      Combate: () => abaCombate(ctx),
      Poderes: () => abaPoderes(ctx),
      Tsu: () => abaTsu(ctx),
    };
    conteudo.append(construtores[abaAtiva]());
  }

  // ---------- Rodapé: exportar, importar e restaurar ----------
  function montarRodape(): void {
    const arquivoJson = h('input', { type: 'file', accept: 'application/json,.json', class: 'oculto', id: 'f-json', tabindex: -1, 'aria-label': 'Arquivo JSON da ficha' });
    const arquivoXlsx = h('input', { type: 'file', accept: '.xlsx', class: 'oculto', id: 'f-xlsx', tabindex: -1, 'aria-label': 'Arquivo xlsx da planilha' });

    const importar = async (entrada: HTMLInputElement, ler: (arq: File) => Promise<Ficha>, sucesso: string, falha: string): Promise<void> => {
      const arq = entrada.files?.[0];
      if (!arq) return;
      try {
        ctx.trocarFicha(await ler(arq), true);
        avisar(sucesso);
      } catch (erro) {
        avisar(`${falha}: ${(erro as Error).message}`);
      }
      entrada.value = '';
    };
    arquivoJson.addEventListener('change', () => importar(arquivoJson, async (a) => lerJson(await a.text()), 'JSON importado.', 'Falha ao importar o JSON'));
    arquivoXlsx.addEventListener('change', () => importar(arquivoXlsx, async (a) => lerXlsx(await a.arrayBuffer()), 'Planilha importada.', 'Falha ao importar a planilha'));

    const exportar = (): void => {
      try {
        const url = URL.createObjectURL(new Blob([gerarJson(ficha)], { type: 'application/json' }));
        const a = h('a', { href: url, download: 'ficha-kitai.json' });
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        avisar('JSON exportado.');
      } catch (erro) {
        avisar(`Falha ao exportar: ${(erro as Error).message}`);
      }
    };

    const restaurar = (): void => {
      if (!window.confirm('Restaurar os valores da planilha? Todas as alterações da ficha e da sessão serão perdidas.')) return;
      ctx.trocarFicha(fichaPadrao(), true);
      avisar('Valores da planilha restaurados.');
    };

    rodape.append(
      h('button', { type: 'button', onclick: exportar }, 'Exportar JSON'),
      h('button', { type: 'button', onclick: () => arquivoJson.click() }, 'Importar JSON'),
      h('button', { type: 'button', onclick: () => arquivoXlsx.click() }, 'Importar xlsx'),
      h('button', { type: 'button', class: 'perigo', onclick: restaurar }, 'Restaurar valores da planilha'),
      arquivoJson, arquivoXlsx);
  }

  montarCabecalho();
  montarPainel();
  montarRodape();
  renderAbas();
  renderConteudo();
  atualizarTudo();
}

