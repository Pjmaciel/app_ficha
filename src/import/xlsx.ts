import * as XLSX from 'xlsx';
import type {
  AtributoId,
  ChaveCombate,
  Elemento,
  Ficha,
  GrupoPericia,
  Pericia,
  Poder,
  Tsu,
} from '../model/types';

/**
 * Nível informado pela planilha desatualizada (I8) e nível efetivo do personagem.
 * Decisão registrada em docs/discovery.md: o personagem é de nível 41.
 */
const NIVEL_DESATUALIZADO_PLANILHA = 35;
const NIVEL_EFETIVO = 41;

const ATRIBUTOS_POR_LINHA: [AtributoId, number][] = [
  ['forca', 15],
  ['agilidade', 16],
  ['reflexos', 17],
  ['fortitude', 18],
  ['distancia', 19],
  ['mental', 20],
];

const CHAVES_COMBATE: [ChaveCombate, number][] = [
  ['ataqueArmaBranca', 26],
  ['ataqueMagico', 27],
  ['ataqueLuta', 28],
  ['ataqueArmaFogo', 29],
  ['esquivar', 30],
  ['bloquear', 31],
  ['aparar', 32],
];

const TSU_POR_LINHA: [Elemento, number][] = [
  ['fogo', 91],
  ['agua', 92],
  ['ar', 93],
  ['terra', 94],
  ['luz', 95],
  ['trevas', 96],
];

// Linha da aba LUGAN -> [id, nome, grupo]. Os ids e grupos seguem o contrato do modelo.
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

/** Junta linhas de descrição em uma única frase corrida. */
function normalizar(t: string): string {
  return t.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function lerPoderes(lugan: XLSX.WorkSheet): Poder[] {
  const simples: [string, string, number][] = [
    ['velocidade_divina', 'Velocidade Divina', 73],
    ['lugan_da_batalha', 'Lugan da Batalha', 76],
    ['golpe_devastador', 'Golpe Devastador de Lugan', 79],
  ];
  const poderes: Poder[] = simples.map(([id, nome, linha]) => ({
    id,
    nome,
    nivel: numero(lugan, `D${linha}`),
    descricao: normalizar(texto(lugan, `E${linha}`)),
  }));

  // Golpe Especial: o nome ocupa B82 e a descrição se espalha por E82:E86.
  const cabecalho = texto(lugan, 'E82');
  const custo = cabecalho.match(/^(\d+)\s+Fadiga/);
  // A planilha não termina o efeito 3 com ponto final; o texto do modelo o acrescenta.
  const efeitos = [83, 84, 85].map((l) =>
    normalizar(texto(lugan, `E${l}`))
      .replace(/\s+—\s+/, ': ')
      .replace(/\.?$/, '.'),
  );
  const descricao = [cabecalho.replace(/:$/, '.'), ...efeitos, normalizar(texto(lugan, 'E86'))].join(' ');
  const especial: Poder = {
    id: 'golpe_especial_campeao',
    nome: 'Golpe Especial: Competência (Campeão das Nações)',
    nivel: numero(lugan, 'D82'),
    descricao,
  };
  if (custo) especial.custoFadiga = Number(custo[1]);
  poderes.push(especial);
  return poderes;
}

/**
 * Importa a planilha do personagem (abas LUGAN e FICHA) e devolve a ficha do modelo.
 * O nível é forçado para 41 quando a planilha desatualizada traz 35.
 */
export function importarXlsx(buffer: ArrayBuffer): Ficha {
  const livro = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const lugan = exigirAba(livro, 'LUGAN');
  const fichaBase = exigirAba(livro, 'FICHA');

  const nivelPlanilha = numero(lugan, 'I8');
  const nivel = nivelPlanilha === NIVEL_DESATUALIZADO_PLANILHA ? NIVEL_EFETIVO : nivelPlanilha;

  const atributos = {} as Ficha['atributos'];
  for (const [id, linha] of ATRIBUTOS_POR_LINHA) {
    atributos[id] = {
      bonus: numero(lugan, `D${linha}`),
      pontos: numero(lugan, `E${linha}`),
      bonusExtra: numero(lugan, `F${linha}`),
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

  const bonusPassivo = {} as Ficha['combate']['bonusPassivo'];
  for (const [chave, linha] of CHAVES_COMBATE) bonusPassivo[chave] = numero(lugan, `E${linha}`);

  // A Tsu real é a que possui o valor multiplicado na coluna J (J94 = I94*8).
  const tsu: Tsu[] = TSU_POR_LINHA.map(([elemento, linha]) => ({
    elemento,
    nivel: numero(lugan, `I${linha}`),
    real: celula(lugan, `J${linha}`) !== undefined,
  }));

  const pontosIniciais = Number(texto(lugan, 'B13').match(/^([\d.]+)/)?.[1].replace(/\./g, ''));
  if (!Number.isFinite(pontosIniciais)) throw new Error('Planilha inválida: B13 não informa os pontos iniciais.');

  return {
    versao: 1,
    identidade: {
      nome: texto(lugan, 'D7'),
      jogador: texto(lugan, 'D8'),
      raca: texto(lugan, 'D9'),
      reino: texto(lugan, 'D10'),
      pilarLuganico: texto(lugan, 'I7'),
      nivel,
      nivelLuganico: numero(lugan, 'I9'),
      basePv: numero(lugan, 'I10'),
    },
    pontosIniciais,
    atributos,
    pericias,
    combate: { bonusPassivo },
    poderes: lerPoderes(lugan),
    tsu,
    xp: { total: numero(lugan, 'C1'), atual: numero(lugan, 'E4') },
  };
}
