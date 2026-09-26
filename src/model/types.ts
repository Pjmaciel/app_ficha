export type AtributoId = 'forca' | 'agilidade' | 'reflexos' | 'fortitude' | 'distancia' | 'mental';

/**
 * Origem nomeada de um bônus (ex.: "Outros", 120). Com `poderId`, a parcela é derivada de um poder
 * (escala × nível): o motor a recalcula e ela não é editada diretamente; a ficha guarda só as manuais.
 */
export interface Fonte { nome: string; valor: number; poderId?: string }

/** Parcela derivada de um poder: valor = coeficiente × nível do poder; o motor a gera, nunca fica salva na ficha. */
export interface FonteDerivada extends Fonte {
  poderId: string;
  nivel: number;
  /** Bônus por nível de poder (a escala). */
  coeficiente: number;
}

/** base = bonusNivel + pontos; total = base + soma(extras). */
export interface Atributo { bonusNivel: number; pontos: number; extras: Fonte[] }

export type GrupoPericia = 'artes' | 'ciencias' | 'crime' | 'esporte' | 'idioma' | 'investigacao' | 'manipulacao' | 'sobrevivencia' | 'tecnologia' | 'combate';
export interface Pericia { id: string; nome: string; grupo: GrupoPericia; atributo: AtributoId; inicial: number; graduacao: number }
// total = inicial + atributos[atributo].total + graduacao

export type TipoPoder = 'passivo' | 'ativo' | 'defensivo' | 'item' | 'removido';
export type ChaveCombate = 'ataqueArmaBranca' | 'ataqueMagico' | 'ataqueLuta' | 'ataqueArmaFogo' | 'esquivar' | 'bloquear' | 'aparar';

/**
 * Efeito numérico de um poder por ponto (nível). O motor multiplica cada coeficiente pelo `nivel` do poder
 * e soma o resultado às fontes manuais; poder do tipo `removido` não contribui.
 */
export interface EscalaPoder {
  /** Bônus por nível em cada chave de combate (ataques e defesas). */
  ataquePorNivel?: Partial<Record<ChaveCombate, number>>;
  /** Parcela fixa no fim do dano, por nível. */
  danoPorNivel?: number;
  /** Bônus permanente em um atributo, por nível (entra como extra do atributo). */
  atributoPorNivel?: { atributo: AtributoId; valor: number };
  /** PV extras por nível. */
  pvPorNivel?: number;
  /** Usos por dia: `usosPorNivel × nível`; quando definido, vale no lugar de `Poder.usosPorDia`. */
  usosPorNivel?: number;
  /** Fiéis por nível (informativo: sugere o campo `Ficha.fieis`). */
  fieisPorNivel?: number;
  /** Golpe de mesmo `id`: dados extras de ataque por nível, somados a `dadosAtaqueExtras`. */
  dadosAtaquePorNivel?: number;
  /** Golpe de mesmo `id`: dados extras de dano por nível, somados a `dadosDanoExtras`. */
  dadosDanoPorNivel?: number;
  /**
   * Efeitos escaláveis genéricos (alcance, absorção, criaturas protegidas etc.). Os campos acima são os efeitos de
   * ids reservados (`ataque_*`, `defesa_*`, `dano`, `atributo_*`, `pv_extra`, `usos`, `fieis`, `dados_ataque`,
   * `dados_dano`): são a única fonte desses valores, e o motor os expõe junto com `efeitos` pela mesma função.
   */
  efeitos?: EfeitoEscalavel[];
  /** Marcos por nível do poder (ex.: nível 3 passa a reduzir Tsu real); a interface mostra os atingidos e o próximo. */
  patamares?: PatamarPoder[];
}

/** Efeito numérico de um poder: valor = fixo + porPonto × ⌊nível ÷ (aCada ?? 1)⌋. Sem nível ou removido, vale zero. */
export interface EfeitoEscalavel {
  /** Identificador usado nos marcadores de texto (`{poder.<id>.<efeito>}`); sem pontos nem chaves. */
  id: string;
  rotulo: string;
  porPonto: number;
  /** Parte fixa somada ao valor (ex.: absorção de 200 que não cresce; ou o ajuste do mestre). */
  fixo?: number;
  /** Unidade exibida depois do valor (ex.: "km²", "criaturas"). */
  unidade?: string;
  /** O efeito cresce a cada N níveis (ex.: vigor +1 a cada 2 níveis). */
  aCada?: number;
}

/** Marco do poder: a partir do `nivel`, vale o `texto` (aceita marcadores de texto vivo). */
export interface PatamarPoder { nivel: number; texto: string }

export interface Poder {
  id: string;
  nome: string;
  nivel: number | null;
  tipo: TipoPoder;
  descricao: string;
  custoFadiga?: number;
  usosPorDia?: number;
  /** Mostra o poder na aba Batalha; ausente, vale true para os tipos defensivo e item. Poder removido nunca aparece. */
  mostrarNaBatalha?: boolean;
  /** Escala numérica por nível; ausente, o poder não gera parcelas derivadas. */
  escala?: EscalaPoder;
  /** Aspecto do mundo (pilar) mínimo para o poder funcionar (ex.: honra 3); acima do pilar atual, a ficha alerta. */
  requerPilar?: number;
}

export type Elemento = 'fogo' | 'agua' | 'ar' | 'terra' | 'luz' | 'trevas';
/** valor = real ? nivel * 8 : nivel; vários elementos podem ser reais. */
export interface Tsu { elemento: Elemento; nivel: number; real: boolean }

export interface EntradaCombate {
  /** Bônus manuais nomeados (os de poderes com escala são derivados pelo motor e não ficam aqui). */
  fontes: Fonte[];
  /** Dados extras de ataque/defesa além dos dados por nível (ex.: Jikar +3). */
  dadosExtras: Fonte[];
  /** +1 por N fiéis (200 ataque/aparar, 100 esquiva/bloqueio; null = não se aplica). */
  fieisPor: number | null;
}

export interface Dano {
  /** Atributo do multiplicador do dado (hoje 'forca'). */
  atributo: AtributoId;
  /** Dados extras de dano (ex.: Jikar +1). */
  dadosExtras: Fonte[];
  /** Bônus fixo manual no fim do dano (os de poderes com escala são derivados pelo motor). */
  fixos: Fonte[];
  /** +1 por N fiéis (400). */
  fieisPor: number | null;
}

/**
 * Ex.: Golpe Devastador de Lugan: +3 dados de ataque e +2 de dano no nível 3. O poder de mesmo `id` traz os
 * pontos (nível), os usos por dia e a escala de dados (`dadosAtaquePorNivel`/`dadosDanoPorNivel`); os campos
 * `dadosAtaqueExtras` e `dadosDanoExtras` são o ajuste fixo somado a essa escala (Golpe Devastador: 0 e −1).
 * `pressaoPorPonto` (km² por ponto) alimenta a pressão exibida na aba Batalha.
 */
export interface GolpeEspecial {
  id: string;
  nome: string;
  dadosAtaqueExtras: number;
  dadosDanoExtras: number;
  ativo: boolean;
  pressaoPorPonto?: number;
}

/** Ação livre exibida na aba Batalha (ex.: Terra Real: "1d×48 direto no PV"); os textos aceitam marcadores vivos. */
export interface AcaoBatalha { id: string; nome: string; rolagem: string; notas: string }

/** Guia "Quando for atacado": situação e a resposta recomendada (aceita marcadores vivos, como `{poder.<id>.<efeito>}`). */
export interface Reacao { situacao: string; resposta: string }

export interface Regras {
  pontosIniciais: number;
  bonusPorNivel: number;
  nivelReferencia: number;
  bonusReferencia: number;
  diferencaMaximaAtributos: number;
}

export interface Ficha {
  versao: 2;
  /** Revisão dos dados da planilha embutida (0 quando ausente); permite avisar o jogador de uma versão mais nova. */
  revisaoDados: number;
  identidade: {
    nome: string;
    jogador: string;
    raca: string;
    reino: string;
    pilarLuganico: string;
    /** Nível do aspecto do mundo do pilar lugânico (1 a 5); exibido como "Justiça 3". */
    pilarNivel: number;
    nivel: number;
    nivelLuganico: number;
    basePv: number;
    armaPrincipal: string;
  };
  regras: Regras;
  atributos: Record<AtributoId, Atributo>;
  pericias: Pericia[];
  /** PV extras manuais (os de poderes com escala, como Proteção Divina, são derivados pelo motor). */
  pvExtras: Fonte[];
  combate: Record<ChaveCombate, EntradaCombate>;
  dano: Dano;
  golpes: GolpeEspecial[];
  poderes: Poder[];
  tsu: Tsu[];
  /** Ações livres da aba Batalha (ações de Tsu real e outras). */
  acoes: AcaoBatalha[];
  /** Lembretes de regras exibidos na aba Batalha. */
  lembretes: string[];
  /** Guia de reação "Quando for atacado". */
  reacoes: Reacao[];
  /** Fiéis vinculados; começa em 0 porque os bônus passivos da planilha já os incluem. */
  fieis: number;
  xp: { total: number; atual: number };
}

export interface Sessao { pvAtual: number; fadiga: number; usosPoder: Record<string, number>; anotacoes: string }
