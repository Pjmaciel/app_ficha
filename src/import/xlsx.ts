import * as XLSX from 'xlsx';
import type {
  AtributoId,
  ChaveCombate,
  Elemento,
  EntradaCombate,
  Ficha,
  Fonte,
  GrupoPericia,
  Pericia,
  Poder,
  TipoPoder,
  Tsu,
} from '../model/types';

/** Regras do contrato v2 que a planilha não traz em células numéricas próprias. */
const NIVEL_REFERENCIA = 41;
const BONUS_REFERENCIA = 47;
const DIFERENCA_MAXIMA_ATRIBUTOS = 120;
const ARMA_PRINCIPAL = 'Jikar';

const ATRIBUTOS_POR_LINHA: [AtributoId, number][] = [
  ['forca', 15],
  ['agilidade', 16],
  ['reflexos', 17],
  ['fortitude', 18],
  ['distancia', 19],
  ['mental', 20],
];

const TSU_POR_LINHA: [Elemento, number][] = [
  ['fogo', 91],
  ['agua', 92],
  ['ar', 93],
  ['terra', 94],
  ['luz', 95],
  ['trevas', 96],
];

// [linha da aba LUGAN, id, nome, grupo]. Os ids e grupos seguem o contrato do modelo.
const PERICIAS: [number, string, string, GrupoPericia][] = [
  [16, 'atuacao', 'Atuação', 'artes'],
  [17, 'canto', 'Canto', 'artes'],
  [18, 'danca', 'Dança', 'artes'],
  [19, 'instrumentos_musicais', 'Instrumentos Musicais', 'artes'],
  [20, 'oficios', 'Ofícios', 'artes'],
  [22, 'geografia', 'Geografia', 'ciencias'],
  [23, 'historia', 'História', 'ciencias'],
  [24, 'quimica', 'Química', 'ciencias'],
  [25, 'ecologia', 'Ecologia', 'ciencias'],
  [26, 'medicina', 'Medicina', 'ciencias'],
  [27, 'veterinaria', 'Veterinária', 'ciencias'],
  [28, 'manipular_tsu_ciencia', 'Manipular Tsu', 'ciencias'],
  [29, 'meteorologia', 'Meteorologia', 'ciencias'],
  [30, 'ciencias_ocultas', 'Ciências Ocultas', 'ciencias'],
  [31, 'engenharia_ciencia', 'Engenharia', 'ciencias'],
  [33, 'armadilha', 'Armadilha', 'crime'],
  [34, 'arrombamento', 'Arrombamento', 'crime'],
  [35, 'disfarce', 'Disfarce', 'crime'],
  [36, 'furtividade', 'Furtividade', 'crime'],
  [37, 'falsificacao', 'Falsificação', 'crime'],
  [38, 'punga', 'Punga', 'crime'],
  [39, 'rastreio', 'Rastreio', 'crime'],
  [40, 'jogos_de_azar', 'Jogos de Azar', 'crime'],
  [41, 'fuga', 'Fuga', 'crime'],
  [43, 'corrida', 'Corrida', 'esporte'],
  [44, 'acrobacia', 'Acrobacia', 'esporte'],
  [45, 'escalar', 'Escalar', 'esporte'],
  [46, 'cavalgar', 'Cavalgar', 'esporte'],
  [47, 'natacao', 'Natação', 'esporte'],
  [49, 'criptografia', 'Criptografia', 'idioma'],
  [50, 'leitura_labial', 'Leitura Labial', 'idioma'],
  [51, 'linguagem_dos_sinais', 'Linguagem dos Sinais', 'idioma'],
  [52, 'linguas_atuais', 'Línguas Atuais', 'idioma'],
  [53, 'linguas_antigas', 'Línguas Antigas', 'idioma'],
  [55, 'disfarce_inv', 'Disfarce', 'investigacao'],
  [56, 'criptografia_inv', 'Criptografia', 'investigacao'],
  [57, 'rastrear_inv', 'Rastrear', 'investigacao'],
  [58, 'perceber', 'Perceber', 'investigacao'],
  [59, 'sentir_motivacao', 'Sentir Motivação', 'investigacao'],
  [60, 'ouvir', 'Ouvir', 'investigacao'],
  [61, 'observar', 'Observar', 'investigacao'],
  [63, 'blefar', 'Blefar', 'manipulacao'],
  [64, 'lideranca', 'Liderança', 'manipulacao'],
  [65, 'trato_social', 'Trato Social', 'manipulacao'],
  [66, 'seducao', 'Sedução', 'manipulacao'],
  [67, 'trato_com_animais', 'Trato com Animais', 'manipulacao'],
  [68, 'intimidar', 'Intimidar', 'manipulacao'],
  [70, 'escalar_sob', 'Escalar', 'sobrevivencia'],
  [71, 'armadilha_sob', 'Armadilha', 'sobrevivencia'],
  [72, 'meteorologia_sob', 'Meteorologia', 'sobrevivencia'],
  [73, 'rastrear_sob', 'Rastrear', 'sobrevivencia'],
  [74, 'perceber_sob', 'Perceber', 'sobrevivencia'],
  [75, 'corrida_sob', 'Corrida', 'sobrevivencia'],
  [76, 'fuga_sob', 'Fuga', 'sobrevivencia'],
  [78, 'conducao', 'Condução', 'tecnologia'],
  [79, 'pilotagem', 'Pilotagem', 'tecnologia'],
  [80, 'velejar', 'Velejar', 'tecnologia'],
  [81, 'engenharia', 'Engenharia', 'tecnologia'],
  [82, 'mecanica', 'Mecânica', 'tecnologia'],
  [84, 'luta', 'Luta', 'combate'],
  [85, 'manipular_tsu', 'Manipular Tsu', 'combate'],
  [86, 'espada', 'Espada', 'combate'],
  [87, 'arma_de_fogo', 'Arma de Fogo', 'combate'],
  [88, 'escudo', 'Escudo', 'combate'],
];

function celula(aba: XLSX.WorkSheet, endereco: string): XLSX.CellObject | undefined {
  return aba[endereco] as XLSX.CellObject | undefined;
}

function texto(aba: XLSX.WorkSheet, endereco: string): string {
  const c = celula(aba, endereco);
  return c?.v === undefined || c.v === null ? '' : String(c.v).trim();
}

function numero(aba: XLSX.WorkSheet, endereco: string): number {
  const c = celula(aba, endereco);
  if (c === undefined || c.v === undefined || c.v === '') return 0;
  const n = Number(c.v);
  if (Number.isNaN(n)) throw new Error(`Planilha inválida: a célula ${endereco} não é numérica.`);
  return n;
}

function exigirAba(livro: XLSX.WorkBook, nome: string): XLSX.WorkSheet {
  const aba = livro.Sheets[nome];
  if (!aba) throw new Error(`Planilha inválida: a aba ${nome} não foi encontrada.`);
  return aba;
}

/**
 * Descobre o atributo governante de uma perícia seguindo a fórmula da coluna K
 * (por exemplo `=C20` ou `=$K$29`, que aponta para outra célula K).
 */
function atributoGovernante(lugan: XLSX.WorkSheet, linha: number, visitadas = new Set<string>()): AtributoId {
  const endereco = `K${linha}`;
  if (visitadas.has(endereco)) throw new Error(`Planilha inválida: referência circular em ${endereco}.`);
  visitadas.add(endereco);

  const formula = celula(lugan, endereco)?.f;
  const alvo = formula?.replace(/\$/g, '').match(/^([CK])(\d+)$/);
  if (!alvo) throw new Error(`Planilha inválida: a fórmula de ${endereco} não é uma referência simples.`);
  const linhaAlvo = Number(alvo[2]);

  if (alvo[1] === 'K') return atributoGovernante(lugan, linhaAlvo, visitadas);
  const atributo = ATRIBUTOS_POR_LINHA.find(([, l]) => l === linhaAlvo);
  if (!atributo) throw new Error(`Planilha inválida: ${endereco} referencia C${linhaAlvo}, que não é um atributo.`);
  return atributo[0];
}

/** Valor inicial da perícia: segue `J<linha> = FICHA!N<n>` e lê o valor calculado na aba FICHA. */
function valorInicial(lugan: XLSX.WorkSheet, ficha: XLSX.WorkSheet, linha: number): number {
  const formula = celula(lugan, `J${linha}`)?.f;
  const alvo = formula?.match(/^FICHA!\$?N\$?(\d+)$/);
  if (!alvo) throw new Error(`Planilha inválida: a fórmula de J${linha} não referencia FICHA!N.`);
  const linhaFicha = Number(alvo[1]);
  if (linhaFicha < 16 || linhaFicha > 95) {
    throw new Error(`Planilha inválida: J${linha} referencia FICHA!N${linhaFicha}, fora de N16:N95.`);
  }
  return numero(ficha, `N${linhaFicha}`);
}



/**
 * Junta as linhas de uma célula em texto corrido. Cada quebra vira "; ", exceto quando a linha
 * anterior já termina em ";" ou "." (então basta um espaço, sem pontuação duplicada).
 */
function juntarLinhas(t: string): string {
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .reduce((acc, l) => (acc === '' ? l : `${acc}${/[;.]$/.test(acc) ? ' ' : '; '}${l}`), '');
}

/** Nível de um poder: vazio na planilha (item, como a Jikar) vira nulo. */
function nivelOuNulo(aba: XLSX.WorkSheet, endereco: string): number | null {
  const c = celula(aba, endereco);
  return c === undefined || c.v === undefined || c.v === '' ? null : numero(aba, endereco);
}

/**
 * Poderes da aba LUGAN: id, nome, tipo, uso por dia e a linha inicial (colunas D nível, E descrição).
 * Os nomes seguem o contrato (a planilha tem erros de digitação, como "montadas"); só o nível e a
 * descrição vêm das células.
 */
const PODERES: { id: string; nome: string; tipo: TipoPoder; linha: number; usosPorDia?: number }[] = [
  { id: 'velocidade_divina', nome: 'Velocidade Divina', tipo: 'passivo', linha: 73 },
  { id: 'lugan_da_batalha', nome: 'Lugan da Batalha', tipo: 'passivo', linha: 76 },
  { id: 'golpe_devastador', nome: 'Golpe Devastador de Lugan', tipo: 'ativo', linha: 79 },
  { id: 'portador_da_jikar', nome: 'Portador da Jikar', tipo: 'item', linha: 82 },
  { id: 'campeao_do_combate_divino', nome: 'Campeão do Combate Divino', tipo: 'passivo', linha: 87 },
  { id: 'forca_das_montanhas_divinas', nome: 'Força das Montanhas Divinas', tipo: 'passivo', linha: 93 },
  { id: 'protecao_divina', nome: 'Proteção Divina', tipo: 'defensivo', linha: 98, usosPorDia: 1 },
  { id: 'o_filho_de_hagashi', nome: 'O Filho de Hagashi', tipo: 'passivo', linha: 106, usosPorDia: 1 },
  { id: 'lugan_completo', nome: 'Lugan Completo', tipo: 'passivo', linha: 115 },
  { id: 'manipulador_de_tsu_real', nome: 'Manipulador de Tsu Real', tipo: 'passivo', linha: 124 },
  { id: 'fogo_real', nome: 'Fogo Real', tipo: 'ativo', linha: 130 },
];

/** Descrição do poder: célula E da linha, ou, no Lugan da Batalha, E76:F78 (valor calculado + texto). */
function descricaoDoPoder(lugan: XLSX.WorkSheet, id: string, linha: number): string {
  if (id !== 'lugan_da_batalha') return juntarLinhas(texto(lugan, `E${linha}`));
  const partes = [76, 77, 78].map((l) => `+${numero(lugan, `E${l}`)} ${texto(lugan, `F${l}`)}`);
  return juntarLinhas(partes.join('\n'));
}

function lerPoderes(lugan: XLSX.WorkSheet): Poder[] {
  return PODERES.map(({ id, nome, tipo, linha, usosPorDia }) => {
    const poder: Poder = {
      id,
      nome,
      nivel: nivelOuNulo(lugan, `D${linha}`),
      tipo,
      descricao: descricaoDoPoder(lugan, id, linha),
    };
    if (usosPorDia !== undefined) poder.usosPorDia = usosPorDia;
    return poder;
  });
}

const fonte = (nome: string, valor: number): Fonte => ({ nome, valor });

const LUGAN_DA_BATALHA = 'Lugan da Batalha';
const CAMPEAO = 'Campeão do Combate Divino';
const LUGAN_COMPLETO = 'Lugan Completo';
const JIKAR_ATAQUE: Fonte[] = [fonte('Jikar', 3)];

/**
 * Composição do bônus passivo (coluna E) de cada valor de combate. O Lugan da Batalha é lido da
 * planilha (E76); as demais parcelas vêm do texto dos poderes. O que sobrar da soma da coluna E vira
 * "Outros", de modo que a soma das fontes seja sempre a coluna E.
 */
const COMBATE: Record<ChaveCombate, { linha: number; nomeadas: (luganDaBatalha: number) => Fonte[]; dadosExtras: Fonte[]; fieisPor: number | null }> = {
  ataqueArmaBranca: {
    linha: 26,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(CAMPEAO, 140), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: JIKAR_ATAQUE,
    fieisPor: 200,
  },
  ataqueMagico: {
    linha: 27,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(LUGAN_COMPLETO, 60), fonte('Manipulador de Tsu Real', 70)],
    dadosExtras: [],
    fieisPor: null,
  },
  ataqueLuta: {
    linha: 28,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: [],
    fieisPor: null,
  },
  ataqueArmaFogo: {
    linha: 29,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: [],
    fieisPor: null,
  },
  esquivar: {
    linha: 30,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: JIKAR_ATAQUE,
    fieisPor: 100,
  },
  bloquear: {
    linha: 31,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: JIKAR_ATAQUE,
    fieisPor: 100,
  },
  aparar: {
    linha: 32,
    nomeadas: (lb) => [fonte(LUGAN_DA_BATALHA, lb), fonte(CAMPEAO, 140), fonte(LUGAN_COMPLETO, 60)],
    dadosExtras: JIKAR_ATAQUE,
    fieisPor: 200,
  },
};

function lerCombate(lugan: XLSX.WorkSheet): Ficha['combate'] {
  const luganDaBatalha = numero(lugan, 'E76');
  const combate = {} as Ficha['combate'];
  for (const chave of Object.keys(COMBATE) as ChaveCombate[]) {
    const { linha, nomeadas, dadosExtras, fieisPor } = COMBATE[chave];
    const fontes = nomeadas(luganDaBatalha);
    const outros = numero(lugan, `E${linha}`) - fontes.reduce((s, x) => s + x.valor, 0);
    if (outros !== 0) fontes.push(fonte('Outros', outros));
    const entrada: EntradaCombate = { fontes, dadosExtras: structuredClone(dadosExtras), fieisPor };
    combate[chave] = entrada;
  }
  return combate;
}

/** Extra de atributo: só a Força tem origem conhecida (Força das Montanhas Divinas, F15). */
function lerExtras(lugan: XLSX.WorkSheet, id: AtributoId, linha: number): Fonte[] {
  const valor = numero(lugan, `F${linha}`);
  if (valor === 0) return [];
  return [fonte(id === 'forca' ? 'Força das Montanhas Divinas' : 'Bônus extra', valor)];
}

/** Lê o primeiro número de uma célula de rótulo (por exemplo "1.018 PONTOS INICIAIS" ou "4 EM TODOS POR NÍVEL"). */
function primeiroNumero(lugan: XLSX.WorkSheet, endereco: string): number {
  const n = Number(texto(lugan, endereco).match(/^([\d.]+)/)?.[1].replace(/\./g, ''));
  if (!Number.isFinite(n)) throw new Error(`Planilha inválida: ${endereco} não começa com um número.`);
  return n;
}

/**
 * Importa a planilha do personagem (abas LUGAN e FICHA) e devolve a ficha versão 2.
 * A estrutura de fontes de combate, os dados extras, o dano e o golpe vêm do contrato v2; da planilha
 * vêm identidade, bônus de nível, pontos, extras, perícias, PV extra, valores passivos, poderes e Tsu.
 * As anotações de dano e fiéis das células F25:F32 são ignoradas.
 */
export function importarXlsx(buffer: ArrayBuffer): Ficha {
  const livro = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const lugan = exigirAba(livro, 'LUGAN');
  const fichaBase = exigirAba(livro, 'FICHA');

  const atributos = {} as Ficha['atributos'];
  for (const [id, linha] of ATRIBUTOS_POR_LINHA) {
    atributos[id] = {
      bonusNivel: numero(lugan, `D${linha}`),
      pontos: numero(lugan, `E${linha}`),
      extras: lerExtras(lugan, id, linha),
    };
  }

  const pericias: Pericia[] = PERICIAS.map(([linha, id, nome, grupo]) => ({
    id,
    nome,
    grupo,
    atributo: atributoGovernante(lugan, linha),
    inicial: valorInicial(lugan, fichaBase, linha),
    graduacao: numero(lugan, `L${linha}`),
  }));

  // A Tsu real é a que tem fórmula na coluna J (por exemplo J91 = I91*8); vários podem ser reais.
  const tsu: Tsu[] = TSU_POR_LINHA.map(([elemento, linha]) => ({
    elemento,
    nivel: numero(lugan, `I${linha}`),
    real: celula(lugan, `J${linha}`)?.f !== undefined,
  }));

  const pvExtra = numero(lugan, 'F22');

  return {
    versao: 2,
    identidade: {
      nome: texto(lugan, 'D7'),
      jogador: texto(lugan, 'D8'),
      raca: texto(lugan, 'D9'),
      reino: texto(lugan, 'D10'),
      pilarLuganico: texto(lugan, 'I7'),
      nivel: numero(lugan, 'I8'),
      nivelLuganico: numero(lugan, 'I9'),
      basePv: numero(lugan, 'I10'),
      armaPrincipal: ARMA_PRINCIPAL,
    },
    regras: {
      pontosIniciais: primeiroNumero(lugan, 'B13'),
      bonusPorNivel: primeiroNumero(lugan, 'H13'),
      nivelReferencia: NIVEL_REFERENCIA,
      bonusReferencia: BONUS_REFERENCIA,
      diferencaMaximaAtributos: DIFERENCA_MAXIMA_ATRIBUTOS,
    },
    atributos,
    pericias,
    pvExtras: pvExtra !== 0 ? [fonte('Proteção Divina', pvExtra)] : [],
    combate: lerCombate(lugan),
    dano: {
      atributo: 'forca',
      dadosExtras: [fonte('Jikar', 1)],
      fixos: [fonte(LUGAN_DA_BATALHA, numero(lugan, 'E78')), fonte(CAMPEAO, 40), fonte(LUGAN_COMPLETO, 20)],
      fieisPor: 400,
    },
    golpes: [
      { id: 'golpe_devastador', nome: 'Golpe Devastador de Lugan', dadosAtaqueExtras: 3, dadosDanoExtras: 2, ativo: false },
    ],
    poderes: lerPoderes(lugan),
    tsu,
    fieis: 0,
    xp: { total: numero(lugan, 'C1'), atual: numero(lugan, 'E4') },
  };
}
