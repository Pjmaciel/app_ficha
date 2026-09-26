// Interface principal: cabeçalho, painel de sessão, abas e rolador de dados.
import {
  combate, dadosPorNivel, novaSessao, pontosRestantes, pv, rolar, totalAtributo, totalPericia, tsuReal,
} from '../engine';
import type { AtributoId, ChaveCombate, Ficha, GrupoPericia, Poder, Sessao } from '../model/types';
import { h, inteiro, limpar } from './dom';
import { gerarJson, lerJson, lerXlsx } from './importacao';
import { LIMITE_HISTORICO, carregar, salvar } from './estado';

const ROTULO_ATRIBUTO: Record<AtributoId, string> = {
  forca: 'Força', agilidade: 'Agilidade', reflexos: 'Reflexos',
  fortitude: 'Fortitude', distancia: 'Distância', mental: 'Mental',
};

const ROTULO_GRUPO: Record<GrupoPericia, string> = {
  artes: 'Artes', ciencias: 'Ciências', crime: 'Crime', esporte: 'Esporte', idioma: 'Idioma',
  investigacao: 'Investigação', manipulacao: 'Manipulação', sobrevivencia: 'Sobrevivência',
  tecnologia: 'Tecnologia', combate: 'Combate',
};

const ROTULO_COMBATE: Record<ChaveCombate, string> = {
  ataqueArmaBranca: 'Ataque com arma branca', ataqueMagico: 'Ataque mágico',
  ataqueLuta: 'Ataque de luta', ataqueArmaFogo: 'Ataque com arma de fogo',
  esquivar: 'Esquivar', bloquear: 'Bloquear', aparar: 'Aparar',
};

const ROTULO_ELEMENTO: Record<string, string> = {
  fogo: 'Fogo', agua: 'Água', ar: 'Ar', terra: 'Terra', luz: 'Luz', trevas: 'Trevas',
};

const ABAS = ['Atributos', 'Perícias', 'Combate', 'Poderes', 'Tsu'] as const;
type Aba = (typeof ABAS)[number];

// Fadiga de referência da barra: soma dos três efeitos do Golpe Especial.
const ESCALA_FADIGA = 25;

export function iniciar(raiz: HTMLElement): void {
  let { ficha, sessao } = carregar();
  let abaAtiva: Aba = 'Atributos';
  let busca = '';
  let mensagem = '';

  const cabecalho = h('header', { class: 'cabecalho' });
  const painel = h('section', { class: 'painel-sessao', 'aria-label': 'Painel de sessão' });
  const navegacao = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Seções da ficha' });
  const conteudo = h('main', { class: 'conteudo', id: 'conteudo' });
  const rolador = h('section', { class: 'cartao rolador', 'aria-label': 'Rolador de dados' });
  const rodape = h('footer', { class: 'rodape' });
  const aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });

  raiz.append(cabecalho, painel, navegacao, conteudo, rolador, rodape, aviso);

  const persistir = (): void => salvar(ficha, sessao);

  function avisar(texto: string): void {
    mensagem = texto;
    aviso.textContent = mensagem;
  }

  function limitarPv(valor: number): number {
    return Math.max(0, Math.min(valor, pv(ficha)));
  }

  // ---------- Cabeçalho ----------
  function renderCabecalho(): void {
    limpar(cabecalho);
    const id = ficha.identidade;
    const base = import.meta.env.BASE_URL;
    cabecalho.append(
      h('img', { class: 'retrato', src: `${base}assets/retrato.png`, alt: `Retrato de ${id.nome}`, width: 88, height: 88 }),
      h('div', { class: 'identidade' },
        h('h1', {}, id.nome),
        h('p', { class: 'sub' }, `${id.raca} · Reino ${id.reino}`),
        h('p', { class: 'sub' }, `Pilar: ${id.pilarLuganico}`),
        h('p', { class: 'niveis' },
          h('span', { class: 'selo' }, `Nível ${id.nivel}`),
          h('span', { class: 'selo' }, `Lugânico ${id.nivelLuganico}`),
        ),
      ),
    );
  }

  // ---------- Painel de sessão ----------
  function renderPainel(): void {
    limpar(painel);
    const pvMax = pv(ficha);
    const pctPv = pvMax > 0 ? Math.max(0, Math.min(100, (sessao.pvAtual / pvMax) * 100)) : 0;
    const escala = Math.max(ESCALA_FADIGA, sessao.fadiga);
    const pctFadiga = Math.min(100, (sessao.fadiga / escala) * 100);

    const campoValor = h('input', {
      type: 'number', min: 0, value: 10, id: 'valor-pv', inputmode: 'numeric',
      'aria-label': 'Valor de dano ou cura',
    });
    const aplicar = (sinal: 1 | -1): void => {
      const v = Math.max(0, inteiro(campoValor.value, 0));
      sessao.pvAtual = limitarPv(sessao.pvAtual + sinal * v);
      persistir();
      renderPainel();
    };
    const campoPv = h('input', {
      type: 'number', value: sessao.pvAtual, id: 'pv-atual', inputmode: 'numeric',
      'aria-label': 'PV atual',
      onchange: (e: Event) => {
        sessao.pvAtual = limitarPv(inteiro((e.target as HTMLInputElement).value, sessao.pvAtual));
        persistir();
        renderPainel();
      },
    });

    const passoFadiga = h('input', {
      type: 'number', min: 1, value: 5, id: 'passo-fadiga', inputmode: 'numeric',
      'aria-label': 'Quantidade de fadiga',
    });
    const mudarFadiga = (sinal: 1 | -1): void => {
      const v = Math.max(0, inteiro(passoFadiga.value, 0));
      sessao.fadiga = Math.max(0, sessao.fadiga + sinal * v);
      persistir();
      renderPainel();
    };

    const poderesUsaveis = ficha.poderes.filter((p) => p.custoFadiga !== undefined || p.usosPorDia !== undefined);

    painel.append(
      h('div', { class: 'bloco' },
        h('div', { class: 'linha-titulo' },
          h('label', { for: 'pv-atual' }, 'PV'),
          h('span', { class: 'numeros' }, campoPv, ` / ${pvMax}`),
        ),
        h('div', { class: 'barra pv', role: 'progressbar', 'aria-label': 'Pontos de vida',
          'aria-valuemin': 0, 'aria-valuemax': pvMax, 'aria-valuenow': sessao.pvAtual },
          h('div', { class: 'preenchimento', style: `width:${pctPv}%` })),
        h('div', { class: 'controles' },
          h('button', { type: 'button', class: 'perigo', onclick: () => aplicar(-1) }, 'Dano'),
          h('label', { class: 'oculto', for: 'valor-pv' }, 'Valor'),
          campoValor,
          h('button', { type: 'button', class: 'cura', onclick: () => aplicar(1) }, 'Cura'),
        ),
      ),
      h('div', { class: 'bloco' },
        h('div', { class: 'linha-titulo' },
          h('span', { class: 'rotulo' }, 'Fadiga'),
          h('span', { class: 'numeros' }, String(sessao.fadiga)),
        ),
        h('div', { class: 'barra fadiga', role: 'progressbar', 'aria-label': 'Fadiga',
          'aria-valuemin': 0, 'aria-valuemax': escala, 'aria-valuenow': sessao.fadiga },
          h('div', { class: 'preenchimento', style: `width:${pctFadiga}%` })),
        h('div', { class: 'controles' },
          h('button', { type: 'button', onclick: () => mudarFadiga(1) }, 'Gastar'),
          h('label', { class: 'oculto', for: 'passo-fadiga' }, 'Quantidade'),
          passoFadiga,
          h('button', { type: 'button', onclick: () => mudarFadiga(-1) }, 'Recuperar'),
        ),
      ),
      ...(poderesUsaveis.length > 0 ? [h('div', { class: 'bloco largo' },
          h('span', { class: 'rotulo' }, 'Usos por dia'),
          h('ul', { class: 'usos' }, ...poderesUsaveis.map(renderUso)),
        )] : []),
      h('div', { class: 'bloco acoes' },
        h('button', {
          type: 'button', class: 'destaque',
          onclick: () => {
            sessao.fadiga = 0;
            sessao.usosPoder = {};
            persistir();
            renderPainel();
            renderConteudo();
            avisar('Descanso concluído: fadiga e usos zerados.');
          },
        }, 'Descansar'),
      ),
    );
  }

  function renderUso(p: Poder): HTMLElement {
    const usos = sessao.usosPoder[p.id] ?? 0;
    const esgotado = p.usosPorDia !== undefined && usos >= p.usosPorDia;
    const custo = p.custoFadiga ?? 0;
    return h('li', {},
      h('span', { class: 'nome-uso' }, p.nome),
      h('span', { class: 'detalhe' },
        `${usos}${p.usosPorDia !== undefined ? ` / ${p.usosPorDia}` : ''} usos`,
        custo > 0 ? ` · custo ${custo} de fadiga` : ''),
      h('button', {
        type: 'button', disabled: esgotado,
        'aria-label': `Usar ${p.nome}`,
        onclick: () => usarPoder(p),
      }, 'Usar'),
    );
  }

  function usarPoder(p: Poder): void {
    sessao.usosPoder[p.id] = (sessao.usosPoder[p.id] ?? 0) + 1;
    sessao.fadiga += p.custoFadiga ?? 0;
    persistir();
    renderPainel();
    renderConteudo();
    avisar(`${p.nome} usado.`);
  }

  // ---------- Abas ----------
  function renderAbas(): void {
    limpar(navegacao);
    ABAS.forEach((nome, i) => {
      const ativa = nome === abaAtiva;
      navegacao.append(h('button', {
        type: 'button', role: 'tab', id: `aba-${i}`, 'aria-selected': ativa,
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
    limpar(conteudo);
    conteudo.setAttribute('role', 'tabpanel');
    conteudo.setAttribute('aria-labelledby', `aba-${ABAS.indexOf(abaAtiva)}`);
    if (abaAtiva === 'Atributos') conteudo.append(secaoAtributos());
    else if (abaAtiva === 'Perícias') conteudo.append(secaoPericias());
    else if (abaAtiva === 'Combate') conteudo.append(secaoCombate());
    else if (abaAtiva === 'Poderes') conteudo.append(secaoPoderes());
    else conteudo.append(secaoTsu());
  }

  function secaoAtributos(): HTMLElement {
    const restantes = pontosRestantes(ficha);
    return h('div', {},
      h('p', { class: `resumo${restantes !== 0 ? ' alerta' : ''}` },
        `Pontos restantes: ${restantes} (de ${ficha.pontosIniciais})`),
      h('div', { class: 'grade' },
        ...(Object.keys(ROTULO_ATRIBUTO) as AtributoId[]).map((id) => {
          const a = ficha.atributos[id];
          return h('article', { class: 'cartao atributo' },
            h('h3', {}, ROTULO_ATRIBUTO[id]),
            h('p', { class: 'valor' }, String(totalAtributo(a))),
            h('p', { class: 'detalhe' }, `bônus ${a.bonus} + pontos ${a.pontos} + extra ${a.bonusExtra}`),
          );
        })),
    );
  }

  function secaoPericias(): HTMLElement {
    const lista = h('div', { class: 'grupos' });
    const desenhar = (): void => {
      limpar(lista);
      const termo = busca.trim().toLocaleLowerCase('pt-BR');
      let achou = false;
      for (const grupo of Object.keys(ROTULO_GRUPO) as GrupoPericia[]) {
        const itens = ficha.pericias.filter((p) =>
          p.grupo === grupo && p.nome.toLocaleLowerCase('pt-BR').includes(termo));
        if (itens.length === 0) continue;
        achou = true;
        lista.append(h('section', { class: 'cartao grupo' },
          h('h3', {}, ROTULO_GRUPO[grupo]),
          h('ul', { class: 'pericias' }, ...itens.map((p) =>
            h('li', {},
              h('span', {}, p.nome),
              h('span', { class: 'detalhe' }, ROTULO_ATRIBUTO[p.atributo]),
              h('strong', {}, String(totalPericia(ficha, p.id))),
            ))),
        ));
      }
      if (!achou) lista.append(h('p', { class: 'vazio' }, 'Nenhuma perícia encontrada.'));
    };
    const campo = h('input', {
      type: 'search', id: 'busca-pericia', value: busca, placeholder: 'Buscar perícia por nome',
      autocomplete: 'off',
      oninput: (e: Event) => { busca = (e.target as HTMLInputElement).value; desenhar(); },
    });
    desenhar();
    return h('div', {},
      h('label', { class: 'oculto', for: 'busca-pericia' }, 'Buscar perícia por nome'),
      campo, lista);
  }

  function secaoCombate(): HTMLElement {
    const valores = combate(ficha);
    return h('div', { class: 'grade' },
      ...(Object.keys(ROTULO_COMBATE) as ChaveCombate[]).map((k) =>
        h('article', { class: 'cartao atributo' },
          h('h3', {}, ROTULO_COMBATE[k]),
          h('p', { class: 'valor' }, String(valores[k])),
          h('p', { class: 'detalhe' }, `bônus passivo ${ficha.combate.bonusPassivo[k]}`),
        )));
  }

  function secaoPoderes(): HTMLElement {
    return h('div', { class: 'lista-poderes' },
      ...ficha.poderes.map((p) =>
        h('article', { class: 'cartao' },
          h('h3', {}, p.nome),
          h('p', { class: 'detalhe' },
            `Nível ${p.nivel}`,
            p.custoFadiga ? ` · custo ${p.custoFadiga} de fadiga` : '',
            p.usosPorDia ? ` · ${p.usosPorDia} usos por dia` : ''),
          h('p', {}, p.descricao),
        )));
  }

  function secaoTsu(): HTMLElement {
    return h('div', { class: 'grade' },
      ...ficha.tsu.map((t) =>
        h('article', { class: 'cartao atributo' },
          h('h3', {}, ROTULO_ELEMENTO[t.elemento] ?? t.elemento),
          h('p', { class: 'valor' }, String(tsuReal(t))),
          h('p', { class: 'detalhe' }, t.real ? `real (nível ${t.nivel} × 8)` : `nível ${t.nivel}`),
        )));
  }

  // ---------- Rolador ----------
  function renderRolador(): void {
    limpar(rolador);
    const qtd = h('input', { type: 'number', min: 1, id: 'r-qtd', value: dadosPorNivel(ficha.identidade.nivel), inputmode: 'numeric' });
    const mult = h('input', { type: 'number', min: 1, id: 'r-mult', value: 100, inputmode: 'numeric' });
    const bonus = h('input', { type: 'number', id: 'r-bonus', value: 0, inputmode: 'numeric' });
    const rotulo = h('input', { type: 'text', id: 'r-rotulo', placeholder: 'Rótulo (opcional)' });
    const ultima = h('p', { class: 'ultima', 'aria-live': 'polite' });
    const historico = h('ol', { class: 'historico', 'aria-label': 'Histórico de rolagens' });

    const descrever = (r: Sessao['rolagens'][number]): string =>
      `${r.rotulo ? `${r.rotulo}: ` : ''}[${r.dados.join(', ')}] × ${r.multiplicador}`
      + `${r.bonus ? ` ${r.bonus > 0 ? '+' : '−'} ${Math.abs(r.bonus)}` : ''} = ${r.total}`;

    const desenharHistorico = (): void => {
      limpar(historico);
      for (const r of sessao.rolagens) {
        historico.append(h('li', {}, h('span', { class: 'detalhe' }, r.quando), ` ${descrever(r)}`));
      }
    };

    const executar = (): void => {
      const n = Math.max(1, inteiro(qtd.value, 1));
      const r = rolar(n, Math.max(1, inteiro(mult.value, 100)), inteiro(bonus.value, 0), rotulo.value.trim());
      r.quando = new Date().toLocaleTimeString('pt-BR');
      sessao.rolagens = [r, ...sessao.rolagens].slice(0, LIMITE_HISTORICO);
      persistir();
      ultima.textContent = `Total ${r.total} — dados: ${r.dados.join(', ')}`;
      desenharHistorico();
    };

    desenharHistorico();
    rolador.append(
      h('h2', {}, 'Rolador de dados'),
      h('div', { class: 'campos' },
        h('label', { for: 'r-qtd' }, 'Dados', qtd),
        h('label', { for: 'r-mult' }, 'Multiplicador', mult),
        h('label', { for: 'r-bonus' }, 'Bônus', bonus),
        h('label', { for: 'r-rotulo' }, 'Rótulo', rotulo),
      ),
      h('button', { type: 'button', class: 'destaque', onclick: executar }, 'Rolar'),
      ultima,
      h('h3', {}, `Últimas ${LIMITE_HISTORICO} rolagens`),
      historico,
    );
  }

  // ---------- Rodapé: exportar e importar ----------
  function aplicarFicha(nova: Ficha): void {
    ficha = nova;
    sessao = novaSessao(ficha);
    persistir();
    renderTudo();
  }

  function renderRodape(): void {
    limpar(rodape);
    const arquivoJson = h('input', { type: 'file', accept: 'application/json,.json', class: 'oculto', id: 'f-json' });
    const arquivoXlsx = h('input', { type: 'file', accept: '.xlsx', class: 'oculto', id: 'f-xlsx' });

    arquivoJson.addEventListener('change', async () => {
      const arq = arquivoJson.files?.[0];
      if (!arq) return;
      try {
        aplicarFicha(lerJson(await arq.text()));
        avisar('JSON importado.');
      } catch (erro) {
        avisar(`Falha ao importar o JSON: ${(erro as Error).message}`);
      }
      arquivoJson.value = '';
    });
    arquivoXlsx.addEventListener('change', async () => {
      const arq = arquivoXlsx.files?.[0];
      if (!arq) return;
      try {
        aplicarFicha(lerXlsx(await arq.arrayBuffer()));
        avisar('Planilha importada.');
      } catch (erro) {
        avisar(`Falha ao importar a planilha: ${(erro as Error).message}`);
      }
      arquivoXlsx.value = '';
    });

    rodape.append(
      h('button', {
        type: 'button',
        onclick: async () => {
          try {
            const texto = gerarJson(ficha);
            const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
            const a = h('a', { href: url, download: 'ficha-kitai.json' });
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            avisar('JSON exportado.');
          } catch (erro) {
            avisar(`Falha ao exportar: ${(erro as Error).message}`);
          }
        },
      }, 'Exportar JSON'),
      h('button', { type: 'button', onclick: () => arquivoJson.click() }, 'Importar JSON'),
      h('button', { type: 'button', onclick: () => arquivoXlsx.click() }, 'Importar xlsx'),
      arquivoJson, arquivoXlsx,
    );
  }

  function renderTudo(): void {
    renderCabecalho();
    renderPainel();
    renderAbas();
    renderConteudo();
    renderRolador();
    renderRodape();
    aviso.textContent = mensagem;
  }

  renderTudo();
}
