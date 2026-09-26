export type AtributoId = 'forca' | 'agilidade' | 'reflexos' | 'fortitude' | 'distancia' | 'mental';

/** Origem nomeada de um bônus (ex.: "Lugan da Batalha", 150). */
export interface Fonte { nome: string; valor: number }

/** base = bonusNivel + pontos; total = base + soma(extras). */
export interface Atributo { bonusNivel: number; pontos: number; extras: Fonte[] }

export type GrupoPericia = 'artes' | 'ciencias' | 'crime' | 'esporte' | 'idioma' | 'investigacao' | 'manipulacao' | 'sobrevivencia' | 'tecnologia' | 'combate';
export interface Pericia { id: string; nome: string; grupo: GrupoPericia; atributo: AtributoId; inicial: number; graduacao: number }
// total = inicial + atributos[atributo].total + graduacao

export type TipoPoder = 'passivo' | 'ativo' | 'defensivo' | 'item' | 'removido';
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
}

export type Elemento = 'fogo' | 'agua' | 'ar' | 'terra' | 'luz' | 'trevas';
/** valor = real ? nivel * 8 : nivel; vários elementos podem ser reais. */
export interface Tsu { elemento: Elemento; nivel: number; real: boolean }

export type ChaveCombate = 'ataqueArmaBranca' | 'ataqueMagico' | 'ataqueLuta' | 'ataqueArmaFogo' | 'esquivar' | 'bloquear' | 'aparar';
export interface EntradaCombate {
  /** Bônus passivos nomeados; a soma é a coluna E da planilha. */
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
  /** Bônus fixo nomeado no fim do dano (ex.: Lugan da Batalha 60, Campeão 40, Lugan Completo 20). */
  fixos: Fonte[];
  /** +1 por N fiéis (400). */
  fieisPor: number | null;
}

/**
 * Ex.: Golpe Devastador de Lugan: +3 dados de ataque e +2 de dano. O poder de mesmo `id` traz os pontos
 * (nível) e os usos por dia; `pressaoPorPonto` (km² por ponto) alimenta a pressão exibida na aba Batalha.
 */
export interface GolpeEspecial {
  id: string;
  nome: string;
  dadosAtaqueExtras: number;
  dadosDanoExtras: number;
  ativo: boolean;
  pressaoPorPonto?: number;
}

/** Ação livre exibida na aba Batalha (ex.: Terra Real: "1d×48 direto no PV"). */
export interface AcaoBatalha { id: string; nome: string; rolagem: string; notas: string }

/** Guia "Quando for atacado": situação e a resposta recomendada. */
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
  identidade: {
    nome: string;
    jogador: string;
    raca: string;
    reino: string;
    pilarLuganico: string;
    nivel: number;
    nivelLuganico: number;
    basePv: number;
    armaPrincipal: string;
  };
  regras: Regras;
  atributos: Record<AtributoId, Atributo>;
  pericias: Pericia[];
  /** PV extras nomeados (ex.: Proteção Divina +500). */
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
