import { PRESSAO_GOLPE_POR_PONTO, acoesPadrao, lembretesPadrao, reacoesPadrao } from '../model/batalha-padrao';
import type {
  AcaoBatalha,
  Atributo,
  AtributoId,
  ChaveCombate,
  Ficha,
  Fonte,
  GolpeEspecial,
  Poder,
  Reacao,
  Regras,
  Sessao,
  Tsu,
} from '../model/types';

const ATRIBUTOS: AtributoId[] = ['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental'];

const ROTULO_ATRIBUTO: Record<AtributoId, string> = {
  forca: 'Força',
  agilidade: 'Agilidade',
  reflexos: 'Reflexos',
  fortitude: 'Fortitude',
  distancia: 'Distância',
  mental: 'Mental',
};

const somaFontes = (fontes: Fonte[]): number => fontes.reduce((s, f) => s + f.valor, 0);

/** Base do atributo: bônus de nível + pontos distribuídos (sem extras). */
export function baseAtributo(a: Atributo): number {
  return a.bonusNivel + a.pontos;
}

/** Total do atributo: base + soma dos extras nomeados. */
export function totalAtributo(a: Atributo): number {
  return baseAtributo(a) + somaFontes(a.extras);
}

/** Saldo de pontos ainda não distribuídos (negativo indica excesso). */
export function pontosRestantes(f: Ficha): number {
  const gastos = Object.values(f.atributos).reduce((soma, a) => soma + a.pontos, 0);
  return f.regras.pontosIniciais - gastos;
}

/** Bônus de nível que todo atributo deveria ter no nível atual. */
export function bonusNivelEsperado(f: Ficha): number {
  const { bonusReferencia, bonusPorNivel, nivelReferencia } = f.regras;
  return bonusReferencia + bonusPorNivel * (f.identidade.nivel - nivelReferencia);
}

/** Mensagem de alerta quando algum bônus de nível difere do esperado; nulo se tudo confere. */
export function alertaBonusNivel(f: Ficha): string | null {
  const esperado = bonusNivelEsperado(f);
  const divergentes = ATRIBUTOS.filter((id) => f.atributos[id].bonusNivel !== esperado);
  if (divergentes.length === 0) return null;
  const lista = divergentes.map((id) => `${ROTULO_ATRIBUTO[id]} (${f.atributos[id].bonusNivel})`).join(', ');
  return `Bônus de nível divergente do esperado (${esperado} no nível ${f.identidade.nivel}): ${lista}.`;
}

/**
 * Maior diferença entre as bases dos atributos (bônus de nível + pontos, sem extras de poderes).
 * Em empate, vale o primeiro atributo na ordem Força, Agilidade, Reflexos, Fortitude, Distância, Mental.
 */
export function diferencaAtributos(f: Ficha): {
  maior: AtributoId;
  menor: AtributoId;
  diferencia: number;
  limite: number;
  excedeu: boolean;
} {
  const base = (id: AtributoId) => baseAtributo(f.atributos[id]);
  let maior = ATRIBUTOS[0];
  let menor = ATRIBUTOS[0];
  for (const id of ATRIBUTOS) {
    if (base(id) > base(maior)) maior = id;
    if (base(id) < base(menor)) menor = id;
  }
  const diferencia = base(maior) - base(menor);
  const limite = f.regras.diferencaMaximaAtributos;
  return { maior, menor, diferencia, limite, excedeu: diferencia > limite };
}

/** Total da perícia: inicial + total do atributo governante + graduação. */
export function totalPericia(f: Ficha, id: string): number {
  const p = f.pericias.find((x) => x.id === id);
  if (!p) throw new Error(`Perícia inexistente: ${id}`);
  return p.inicial + totalAtributo(f.atributos[p.atributo]) + p.graduacao;
}

/** Pontos de vida sem extras: basePv × total de Fortitude. */
export function pvBase(f: Ficha): number {
  return f.identidade.basePv * totalAtributo(f.atributos.fortitude);
}

/** Pontos de vida máximos: base + PV extras nomeados. */
export function pvTotal(f: Ficha): number {
  return pvBase(f) + somaFontes(f.pvExtras);
}

/** Dados de multiplicador por nível: um por bloco de 10 níveis a partir do 31. */
export function dadosPorNivel(nivel: number): number {
  return 1 + Math.floor((nivel - 31) / 10);
}

/** Fiéis contam +1 a cada `fieisPor`; sem regra (nulo) ou sem fiéis, o bônus é zero. */
function bonusFieis(fieis: number, fieisPor: number | null): number {
  if (fieisPor === null || fieisPor <= 0 || fieis <= 0) return 0;
  return Math.floor(fieis / fieisPor);
}

/** Parte da fórmula que vem das perícias e atributos, antes das fontes e dos fiéis. */
function baseCombate(f: Ficha, chave: ChaveCombate): Fonte[] {
  const attr = (id: AtributoId) => totalAtributo(f.atributos[id]);
  const pericia = (id: string, nome: string): Fonte => ({ nome: `Perícia ${nome}`, valor: totalPericia(f, id) });
  const constante: Fonte = { nome: 'Constante da defesa', valor: 3 };
  switch (chave) {
    case 'ataqueArmaBranca':
      return [pericia('espada', 'Espada')];
    case 'ataqueMagico':
      return [pericia('manipular_tsu', 'Manipular Tsu')];
    case 'ataqueLuta':
      return [pericia('luta', 'Luta')];
    case 'ataqueArmaFogo':
      return [pericia('arma_de_fogo', 'Arma de Fogo')];
    case 'esquivar':
      return [{ nome: 'Reflexos', valor: attr('reflexos') }, constante];
    case 'bloquear':
      return [pericia('escudo', 'Escudo'), constante];
    case 'aparar':
      return [
        pericia('espada', 'Espada'),
        { nome: 'Distância (subtrai)', valor: -attr('distancia') },
        { nome: 'Mental', valor: attr('mental') },
        constante,
      ];
  }
}

/**
 * Valor de combate da aba LUGAN (linhas 26-32): alvo da fórmula + fontes nomeadas + bônus de fiéis.
 * A composição lista cada parcela; a soma dela é o total. Os dados são os do nível mais os extras.
 */
export function combate(
  f: Ficha,
  chave: ChaveCombate,
): { total: number; composicao: Fonte[]; dados: number; fieisBonus: number } {
  const entrada = f.combate[chave];
  const fieisBonus = bonusFieis(f.fieis, entrada.fieisPor);
  const composicao = [...baseCombate(f, chave), ...entrada.fontes];
  if (fieisBonus > 0) composicao.push({ nome: 'Fiéis', valor: fieisBonus });
  return {
    total: somaFontes(composicao),
    composicao,
    dados: dadosPorNivel(f.identidade.nivel) + somaFontes(entrada.dadosExtras),
    fieisBonus,
  };
}

export interface ResultadoDano {
  dados: number;
  multiplicador: number;
  fixo: number;
  fieisBonus: number;
  texto: string;
}

/**
 * Dano: Nd × total do atributo + bônus fixo. Os dados são os do nível, os extras do dano e, se
 * houver golpe, os dados de dano dele. Os fiéis somam +1 por `fieisPor` ao bônus fixo mostrado no texto.
 */
export function dano(f: Ficha, golpeEspecial?: GolpeEspecial): ResultadoDano {
  const d = f.dano;
  const dados =
    dadosPorNivel(f.identidade.nivel) + somaFontes(d.dadosExtras) + (golpeEspecial?.dadosDanoExtras ?? 0);
  const multiplicador = totalAtributo(f.atributos[d.atributo]);
  const fixo = somaFontes(d.fixos);
  const fieisBonus = bonusFieis(f.fieis, d.fieisPor);
  return { dados, multiplicador, fixo, fieisBonus, texto: `${dados}d×${multiplicador} +${fixo + fieisBonus}` };
}

/** Ataque e dano de um golpe especial: os dados extras somam aos do ataque com a arma branca. */
export function golpe(
  f: Ficha,
  g: GolpeEspecial,
): { ataqueDados: number; ataqueTotal: number; dano: ResultadoDano } {
  const ataque = combate(f, 'ataqueArmaBranca');
  return {
    ataqueDados: ataque.dados + g.dadosAtaqueExtras,
    ataqueTotal: ataque.total,
    dano: dano(f, g),
  };
}

/** Sobe `quantos` níveis: soma bonusPorNivel × quantos ao bônus de nível de todos os atributos. Pura. */
export function subirNivel(f: Ficha, quantos: number): Ficha {
  if (!Number.isInteger(quantos) || quantos < 1) {
    throw new Error(`Quantidade de níveis inválida: ${quantos}`);
  }
  const nova = structuredClone(f);
  nova.identidade.nivel += quantos;
  for (const a of Object.values(nova.atributos)) a.bonusNivel += f.regras.bonusPorNivel * quantos;
  return nova;
}

/** Valor efetivo da Tsu: oito vezes o nível quando é a Tsu real. */
export function tsuValor(t: Tsu): number {
  return t.real ? t.nivel * 8 : t.nivel;
}

/** Sessão inicial: PV total cheio, fadiga zerada e nenhum uso de poder registrado. */
export function novaSessao(f: Ficha): Sessao {
  return {
    pvAtual: pvTotal(f),
    fadiga: 0,
    usosPoder: Object.fromEntries(f.poderes.map((p) => [p.id, 0])),
    anotacoes: '',
  };
}

/** Número com sinal explícito: +1078 ou −5. */
export function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Rolagem no formato do jogo: "5d×100 +1078". */
export function formatarRolagem(dados: number, bonus: number): string {
  return `${dados}d×100 ${comSinal(bonus)}`;
}

/** Poder que entra no painel de sessão e na aba Batalha como consumível: tem usos por dia ou custo de fadiga e não foi removido. */
export function poderUsavel(p: Poder): boolean {
  return p.tipo !== 'removido' && (p.usosPorDia !== undefined || p.custoFadiga !== undefined);
}

/** Poder exibido nas absorções e proteções: marcado à mão ou, sem marca, do tipo defensivo ou item; removido nunca. */
export function mostraNaBatalha(p: Poder): boolean {
  if (p.tipo === 'removido') return false;
  return p.mostrarNaBatalha ?? (p.tipo === 'defensivo' || p.tipo === 'item');
}

export interface UsoPoder {
  id: string;
  nome: string;
  /** Usos já gastos na sessão. */
  usados: number;
  /** Limite por dia; nulo quando o poder só custa fadiga. */
  limite: number | null;
  /** Usos que sobram (limite − usados, nunca negativo); nulo sem limite. */
  restantes: number | null;
  custoFadiga: number;
  esgotado: boolean;
}

/** Usos de um poder na sessão atual. */
export function usoDoPoder(p: Poder, sessao: Sessao): UsoPoder {
  const usados = sessao.usosPoder[p.id] ?? 0;
  const limite = p.usosPorDia ?? null;
  return {
    id: p.id,
    nome: p.nome,
    usados,
    limite,
    restantes: limite === null ? null : Math.max(0, limite - usados),
    custoFadiga: p.custoFadiga ?? 0,
    esgotado: limite !== null && usados >= limite,
  };
}

export interface RolagemPronta { dados: number; bonus: number; texto: string }

const rolagemPronta = (c: { dados: number; total: number }): RolagemPronta => ({
  dados: c.dados,
  bonus: c.total,
  texto: formatarRolagem(c.dados, c.total),
});

export interface GolpeBatalha {
  id: string;
  nome: string;
  ataque: RolagemPronta;
  dano: ResultadoDano;
  /** Pontos do golpe: o nível do poder de mesmo id (nulo se não houver). */
  pontos: number | null;
  /** Pressão em km²: pontos × pressaoPorPonto (nulo se faltar um dos dois). */
  pressaoKm2: number | null;
  /** Usos por dia do poder correspondente; nulo se ele não existe ou não é consumível. */
  uso: UsoPoder | null;
}

export interface DefesaBatalha { chave: 'aparar' | 'bloquear' | 'esquivar'; nome: string; rolagem: RolagemPronta }

export interface ProtecaoBatalha { id: string; nome: string; nivel: number | null; descricao: string; uso: UsoPoder | null }

export interface ResumoBatalha {
  pv: { atual: number; total: number };
  fadiga: number;
  /** Dados por nível no formato "2d×100". */
  rolagemBase: string;
  armaPrincipal: string;
  /** Nível do poder Velocidade Divina (nulo se ausente ou removido). */
  velocidadeDivina: number | null;
  ataqueBasico: RolagemPronta;
  danoBasico: ResultadoDano;
  golpes: GolpeBatalha[];
  defesas: DefesaBatalha[];
  acoes: AcaoBatalha[];
  protecoes: ProtecaoBatalha[];
  reacoes: Reacao[];
  lembretes: string[];
  /** Todos os poderes consumíveis, com os usos restantes. */
  usos: UsoPoder[];
}

const DEFESAS_BATALHA: { chave: DefesaBatalha['chave']; nome: string }[] = [
  { chave: 'aparar', nome: 'Aparar' },
  { chave: 'bloquear', nome: 'Bloquear' },
  { chave: 'esquivar', nome: 'Esquivar' },
];

/** Tudo o que a aba Batalha exibe, já calculado; não altera a ficha nem a sessão. */
export function resumoBatalha(f: Ficha, sessao: Sessao): ResumoBatalha {
  const poderDe = (id: string) => f.poderes.find((p) => p.id === id);
  const velocidade = poderDe('velocidade_divina');
  const usoOuNulo = (p: Poder | undefined): UsoPoder | null =>
    p && poderUsavel(p) && p.usosPorDia !== undefined ? usoDoPoder(p, sessao) : null;

  const golpes = f.golpes.map((g): GolpeBatalha => {
    const r = golpe(f, g);
    const poder = poderDe(g.id);
    const pontos = poder && poder.tipo !== 'removido' ? poder.nivel : null;
    return {
      id: g.id,
      nome: g.nome,
      ataque: { dados: r.ataqueDados, bonus: r.ataqueTotal, texto: formatarRolagem(r.ataqueDados, r.ataqueTotal) },
      dano: r.dano,
      pontos,
      pressaoKm2: pontos !== null && g.pressaoPorPonto !== undefined ? pontos * g.pressaoPorPonto : null,
      uso: usoOuNulo(poder),
    };
  });

  return {
    pv: { atual: sessao.pvAtual, total: pvTotal(f) },
    fadiga: sessao.fadiga,
    rolagemBase: `${dadosPorNivel(f.identidade.nivel)}d×100`,
    armaPrincipal: f.identidade.armaPrincipal.trim(),
    velocidadeDivina: velocidade && velocidade.tipo !== 'removido' ? velocidade.nivel : null,
    ataqueBasico: rolagemPronta(combate(f, 'ataqueArmaBranca')),
    danoBasico: dano(f),
    golpes,
    defesas: DEFESAS_BATALHA.map(({ chave, nome }) => ({ chave, nome, rolagem: rolagemPronta(combate(f, chave)) })),
    acoes: f.acoes.map((a) => ({ ...a })),
    protecoes: f.poderes.filter(mostraNaBatalha).map((p) => ({
      id: p.id, nome: p.nome, nivel: p.nivel, descricao: p.descricao, uso: usoOuNulo(p),
    })),
    reacoes: f.reacoes.map((r) => ({ ...r })),
    lembretes: [...f.lembretes],
    usos: f.poderes.filter(poderUsavel).map((p) => usoDoPoder(p, sessao)),
  };
}

const REGRAS_PADRAO: Omit<Regras, 'pontosIniciais'> = {
  bonusPorNivel: 4,
  nivelReferencia: 41,
  bonusReferencia: 47,
  diferencaMaximaAtributos: 120,
};

const FIEIS_POR_PADRAO: Record<ChaveCombate, number | null> = {
  ataqueArmaBranca: 200,
  ataqueMagico: null,
  ataqueLuta: null,
  ataqueArmaFogo: null,
  esquivar: 100,
  bloquear: 100,
  aparar: 200,
};

/** Forma mínima da ficha versão 1 lida pela migração (o restante é ignorado). */
interface FichaV1 {
  identidade: Ficha['identidade'];
  pontosIniciais: number;
  atributos: Record<AtributoId, { bonus: number; pontos: number; bonusExtra: number }>;
  pericias: Ficha['pericias'];
  combate: { bonusPassivo: Record<ChaveCombate, number> };
  poderes: { id: string; nome: string; nivel: number; descricao: string; custoFadiga?: number; usosPorDia?: number }[];
  tsu: Tsu[];
  xp: { total: number; atual: number };
}

function migrarV1(v1: FichaV1): Ficha {
  const atributos = {} as Ficha['atributos'];
  for (const id of ATRIBUTOS) {
    const a = v1.atributos[id];
    atributos[id] = {
      bonusNivel: a.bonus,
      pontos: a.pontos,
      extras: a.bonusExtra !== 0 ? [{ nome: 'Bônus extra', valor: a.bonusExtra }] : [],
    };
  }

  const combate = {} as Ficha['combate'];
  for (const chave of Object.keys(FIEIS_POR_PADRAO) as ChaveCombate[]) {
    const passivo = v1.combate.bonusPassivo[chave];
    combate[chave] = {
      fontes: passivo !== 0 ? [{ nome: 'Bônus passivo', valor: passivo }] : [],
      dadosExtras: [],
      fieisPor: FIEIS_POR_PADRAO[chave],
    };
  }

  const poderes: Poder[] = v1.poderes.map((p) => {
    const poder: Poder = {
      id: p.id,
      nome: p.nome,
      nivel: p.nivel,
      tipo: p.custoFadiga !== undefined ? 'ativo' : 'passivo',
      descricao: p.descricao,
    };
    if (p.custoFadiga !== undefined) poder.custoFadiga = p.custoFadiga;
    if (p.usosPorDia !== undefined) poder.usosPorDia = p.usosPorDia;
    return poder;
  });

  return {
    versao: 2,
    identidade: { ...v1.identidade, armaPrincipal: '' },
    regras: { pontosIniciais: v1.pontosIniciais, ...REGRAS_PADRAO },
    atributos,
    pericias: v1.pericias,
    pvExtras: [],
    combate,
    dano: { atributo: 'forca', dadosExtras: [], fixos: [], fieisPor: 400 },
    golpes: [],
    poderes,
    tsu: v1.tsu,
    acoes: acoesPadrao(),
    lembretes: lembretesPadrao(),
    reacoes: reacoesPadrao(),
    fieis: 0,
    xp: v1.xp,
  };
}

/** Ficha versão 2 salva antes da aba Batalha: os campos dela podem faltar. */
type FichaV2Anterior = Omit<Ficha, 'acoes' | 'lembretes' | 'reacoes'> & Partial<Pick<Ficha, 'acoes' | 'lembretes' | 'reacoes'>>;

/**
 * Completa a versão 2 com os valores padrão da aba Batalha. Cada lista ausente recebe os textos iniciais.
 * Só quando as três faltam (ficha anterior à aba) o Golpe Devastador também ganha usos por dia iguais aos
 * seus pontos e a pressão padrão; depois disso, apagar esses campos é uma escolha do jogador e é respeitada.
 */
function completarBatalha(f: FichaV2Anterior): Ficha {
  const anterior = f.acoes === undefined && f.lembretes === undefined && f.reacoes === undefined;
  if (anterior) {
    for (const g of f.golpes) {
      const poder = f.poderes.find((p) => p.id === g.id);
      if (poder && poder.tipo !== 'removido' && poder.nivel !== null && poder.usosPorDia === undefined) poder.usosPorDia = poder.nivel;
      if (g.pressaoPorPonto === undefined && g.id === 'golpe_devastador') g.pressaoPorPonto = PRESSAO_GOLPE_POR_PONTO;
    }
  }
  return {
    ...f,
    acoes: f.acoes ?? acoesPadrao(),
    lembretes: f.lembretes ?? lembretesPadrao(),
    reacoes: f.reacoes ?? reacoesPadrao(),
  };
}

/**
 * Devolve uma ficha na versão 2. A versão 1 é convertida (regras padrão do contrato: bônus 47 no
 * nível 41, então um bônus de nível antigo dispara o alerta de correção); a versão 2 é copiada e
 * recebe os valores padrão da aba Batalha quando ausentes.
 * Não valida a estrutura: para conteúdo externo, use `importarJson`.
 */
export function migrarFicha(json: unknown): Ficha {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Ficha inválida: o conteúdo deve ser um objeto.');
  }
  const versao = (json as { versao?: unknown }).versao;
  if (versao === 2) return completarBatalha(structuredClone(json as FichaV2Anterior));
  if (versao === 1) return migrarV1(structuredClone(json as FichaV1));
  throw new Error(`Ficha inválida: versão não suportada (${String(versao)}); esperadas 1 ou 2.`);
}
