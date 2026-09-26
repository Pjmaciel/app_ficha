import type {
  Atributo,
  AtributoId,
  ChaveCombate,
  Ficha,
  Fonte,
  GolpeEspecial,
  Poder,
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
    fieis: 0,
    xp: v1.xp,
  };
}

/**
 * Devolve uma ficha na versão 2. A versão 1 é convertida (regras padrão do contrato: bônus 47 no
 * nível 41, então um bônus de nível antigo dispara o alerta de correção); a versão 2 é copiada.
 * Não valida a estrutura: para conteúdo externo, use `importarJson`.
 */
export function migrarFicha(json: unknown): Ficha {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Ficha inválida: o conteúdo deve ser um objeto.');
  }
  const versao = (json as { versao?: unknown }).versao;
  if (versao === 2) return structuredClone(json as Ficha);
  if (versao === 1) return migrarV1(structuredClone(json as FichaV1));
  throw new Error(`Ficha inválida: versão não suportada (${String(versao)}); esperadas 1 ou 2.`);
}
