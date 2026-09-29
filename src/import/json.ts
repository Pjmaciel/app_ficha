import { migrarFicha } from '../engine';
import type { AtributoId, ChaveCombate, Ficha } from '../model/types';

const ATRIBUTOS: AtributoId[] = ['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental'];
const CHAVES_COMBATE: ChaveCombate[] = [
  'ataqueArmaBranca',
  'ataqueMagico',
  'ataqueLuta',
  'ataqueArmaFogo',
  'esquivar',
  'bloquear',
  'aparar',
];
// 'defensivo' é o nome antigo de 'defesa': a migração o converte.
const TIPOS_PODER = ['passivo', 'ativo', 'defesa', 'defensivo', 'item', 'recurso', 'removido'];
// 'pilar' é a origem antiga (pacote do pilar, extinto): a migração converte a ficha para a build da mesa.
const ORIGENS_PODER = ['pilar', 'livre', 'item', 'manual'];
const ELEMENTOS = ['fogo', 'agua', 'ar', 'terra', 'luz', 'trevas'];

type Objeto = Record<string, unknown>;

function ehObjeto(v: unknown): v is Objeto {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function exigir(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(`Ficha inválida: ${mensagem}`);
}

const ehNumero = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/** Exige uma lista de fontes nomeadas ({ nome, valor }). */
function exigirFontes(v: unknown, caminho: string): void {
  exigir(Array.isArray(v), `${caminho} deve ser uma lista.`);
  for (const f of v) {
    exigir(
      ehObjeto(f) && typeof f.nome === 'string' && ehNumero(f.valor) && (f.poderId === undefined || typeof f.poderId === 'string'),
      `${caminho} tem fonte inválida.`,
    );
  }
}

const CAMPOS_ESCALA_NUMERICOS = ['danoPorNivel', 'pvPorNivel', 'usosPorNivel', 'fieisPorNivel', 'dadosAtaquePorNivel', 'dadosDanoPorNivel'];

/** Valida os efeitos escaláveis: id, rótulo e porPonto obrigatórios; fixo, unidade e aCada opcionais (aCada positivo). */
function exigirEfeitos(efeitos: unknown, quem: string): void {
  if (efeitos === undefined) return;
  exigir(Array.isArray(efeitos), `${quem} com escala.efeitos inválido (deve ser uma lista).`);
  const vistos = new Set<string>();
  for (const e of efeitos) {
    exigir(
      ehObjeto(e) && typeof e.id === 'string' && e.id !== '' && !/[.{}\s]/.test(e.id) && typeof e.rotulo === 'string' && ehNumero(e.porPonto),
      `${quem} com efeito inválido (id sem pontos, chaves ou espaços, rótulo em texto e porPonto numérico).`,
    );
    exigir(!vistos.has(e.id), `${quem} com efeito repetido (${e.id}).`);
    vistos.add(e.id);
    exigir(e.fixo === undefined || ehNumero(e.fixo), `${quem}, efeito ${e.id}: fixo não numérico.`);
    exigir(e.unidade === undefined || typeof e.unidade === 'string', `${quem}, efeito ${e.id}: unidade deve ser texto.`);
    exigir(e.aCada === undefined || (ehNumero(e.aCada) && (e.aCada as number) > 0), `${quem}, efeito ${e.id}: aCada deve ser um número positivo.`);
  }
}

/** Valida os patamares: nível numérico e texto. */
function exigirPatamares(patamares: unknown, id: string): void {
  if (patamares === undefined) return;
  exigir(Array.isArray(patamares), `poder ${id} com escala.patamares inválido (deve ser uma lista).`);
  for (const x of patamares) {
    exigir(ehObjeto(x) && ehNumero(x.nivel) && typeof x.texto === 'string', `poder ${id} com patamar inválido (nivel numérico e texto).`);
  }
}

/** Valida a escala por nível de um poder (todos os campos são opcionais). */
function exigirEscala(escala: unknown, id: string): void {
  exigir(ehObjeto(escala), `poder ${id} com escala inválida (deve ser um objeto).`);
  for (const campo of CAMPOS_ESCALA_NUMERICOS) {
    exigir(escala[campo] === undefined || ehNumero(escala[campo]), `poder ${id} com escala.${campo} não numérico.`);
  }
  const ataque = escala.ataquePorNivel;
  if (ataque !== undefined) {
    exigir(
      ehObjeto(ataque) && Object.entries(ataque).every(([k, v]) => (CHAVES_COMBATE as string[]).includes(k) && ehNumero(v)),
      `poder ${id} com escala.ataquePorNivel inválido (chaves de combate com valores numéricos).`,
    );
  }
  exigirEfeitos(escala.efeitos, `poder ${id}`);
  exigirPatamares(escala.patamares, id);
  const atributo = escala.atributoPorNivel;
  if (atributo !== undefined) {
    exigir(
      ehObjeto(atributo) && typeof atributo.atributo === 'string' && (ATRIBUTOS as string[]).includes(atributo.atributo) && ehNumero(atributo.valor),
      `poder ${id} com escala.atributoPorNivel inválido (atributo e valor).`,
    );
  }
}

function exigirPericias(pericias: unknown): void {
  exigir(Array.isArray(pericias), 'pericias deve ser uma lista.');
  for (const p of pericias) {
    exigir(ehObjeto(p) && typeof p.id === 'string', 'toda perícia precisa de id.');
    exigir(
      typeof p.nome === 'string' && typeof p.grupo === 'string',
      `perícia ${p.id} sem nome ou grupo.`,
    );
    exigir(
      typeof p.atributo === 'string' && (ATRIBUTOS as string[]).includes(p.atributo),
      `perícia ${p.id} com atributo desconhecido.`,
    );
    exigir(ehNumero(p.inicial) && ehNumero(p.graduacao), `perícia ${p.id} com valores não numéricos.`);
  }
}

function exigirTsu(tsu: unknown): void {
  exigir(Array.isArray(tsu), 'tsu deve ser uma lista.');
  for (const t of tsu) {
    exigir(
      ehObjeto(t) &&
        typeof t.elemento === 'string' &&
        ELEMENTOS.includes(t.elemento) &&
        ehNumero(t.nivel) &&
        typeof t.real === 'boolean',
      'entrada de tsu inválida.',
    );
  }
}

function exigirIdentidade(identidade: unknown, textos: string[], opcionais: string[] = []): asserts identidade is Objeto {
  exigir(ehObjeto(identidade), 'campo identidade ausente.');
  for (const campo of textos) {
    exigir(typeof identidade[campo] === 'string', `identidade.${campo} deve ser texto.`);
  }
  for (const campo of opcionais) {
    exigir(identidade[campo] === undefined || typeof identidade[campo] === 'string', `identidade.${campo} deve ser texto.`);
  }
  for (const campo of ['nivel', 'nivelLuganico', 'basePv']) {
    exigir(ehNumero(identidade[campo]), `identidade.${campo} deve ser numérico.`);
  }
  exigir(identidade.pilarNivel === undefined || ehNumero(identidade.pilarNivel), 'identidade.pilarNivel deve ser numérico.');
}

/**
 * Valida o pilar (aspecto do mundo): nome e nível, valor base do pilar (pacote) por poder numérico, efeitos
 * escaláveis e textos. Ausente é aceito: a migração monta o pilar a partir de `identidade.pilarLuganico` e `pilarNivel`.
 */
function exigirPilar(pilar: unknown): void {
  if (pilar === undefined) return;
  exigir(ehObjeto(pilar), 'pilar deve ser um objeto.');
  exigir(pilar.nome === undefined || typeof pilar.nome === 'string', 'pilar.nome deve ser texto.');
  exigir(pilar.nome !== undefined || pilar.nivel !== undefined, 'pilar sem nome nem nível.');
  exigir(pilar.nivel === undefined || ehNumero(pilar.nivel), 'pilar.nivel deve ser numérico.');
  // `nivelAplicado` (regra antiga) é aceito se numérico e descartado pela migração.
  exigir(pilar.nivelAplicado === undefined || ehNumero(pilar.nivelAplicado), 'pilar.nivelAplicado deve ser numérico.');
  const pacote = pilar.pacotePorNivel;
  exigir(
    pacote === undefined || (ehObjeto(pacote) && Object.values(pacote).every(ehNumero)),
    'pilar.pacotePorNivel (extinto) deve ser um objeto de valores numéricos.',
  );
  exigirEfeitos(pilar.efeitos, 'pilar');
  exigir(
    pilar.textos === undefined || (Array.isArray(pilar.textos) && pilar.textos.every((t) => typeof t === 'string')),
    'pilar.textos deve ser uma lista de textos.',
  );
}

/** Valida a estrutura mínima da versão 1, lida apenas pela migração. */
function validarV1(dados: Objeto): void {
  exigirIdentidade(dados.identidade, ['nome', 'jogador', 'raca', 'reino', 'pilarLuganico']);
  exigir(ehNumero(dados.pontosIniciais), 'pontosIniciais deve ser numérico.');

  const { atributos, combate, poderes } = dados;
  exigir(ehObjeto(atributos), 'campo atributos ausente.');
  for (const id of ATRIBUTOS) {
    const a = atributos[id];
    exigir(ehObjeto(a), `atributo ${id} ausente.`);
    for (const campo of ['bonus', 'pontos', 'bonusExtra']) {
      exigir(ehNumero(a[campo]), `atributos.${id}.${campo} deve ser numérico.`);
    }
  }

  exigirPericias(dados.pericias);

  exigir(ehObjeto(combate) && ehObjeto(combate.bonusPassivo), 'combate.bonusPassivo ausente.');
  for (const chave of CHAVES_COMBATE) {
    exigir(ehNumero(combate.bonusPassivo[chave]), `combate.bonusPassivo.${chave} deve ser numérico.`);
  }

  exigir(Array.isArray(poderes), 'poderes deve ser uma lista.');
  for (const p of poderes) {
    exigir(ehObjeto(p) && typeof p.id === 'string' && typeof p.nome === 'string', 'poder sem id ou nome.');
    exigir(ehNumero(p.nivel) && typeof p.descricao === 'string', `poder ${p.id} com nível ou descrição inválidos.`);
  }

  exigirTsu(dados.tsu);
  const xp = dados.xp;
  exigir(ehObjeto(xp) && ehNumero(xp.total) && ehNumero(xp.atual), 'xp inválido.');
}

/** Valida os textos da aba Batalha; a ausência de cada lista é aceita e recebe o padrão na migração. */
function exigirTextosBatalha(dados: Objeto): void {
  const { acoes, lembretes, reacoes } = dados;
  if (acoes !== undefined) {
    exigir(Array.isArray(acoes), 'acoes deve ser uma lista.');
    for (const a of acoes) {
      exigir(
        ehObjeto(a) && ['id', 'nome', 'rolagem', 'notas'].every((c) => typeof a[c] === 'string'),
        'acoes tem ação inválida (id, nome, rolagem e notas devem ser texto).',
      );
    }
  }
  if (lembretes !== undefined) {
    exigir(Array.isArray(lembretes) && lembretes.every((l) => typeof l === 'string'), 'lembretes deve ser uma lista de textos.');
  }
  if (reacoes !== undefined) {
    exigir(Array.isArray(reacoes), 'reacoes deve ser uma lista.');
    for (const r of reacoes) {
      exigir(
        ehObjeto(r) && typeof r.situacao === 'string' && typeof r.resposta === 'string',
        'reacoes tem reação inválida (situacao e resposta devem ser texto).',
      );
    }
  }
}

/** Valida a estrutura completa da versão 2. */
function validarV2(dados: Objeto): void {
  exigir(dados.revisaoDados === undefined || ehNumero(dados.revisaoDados), 'revisaoDados deve ser numérico.');
  exigirIdentidade(dados.identidade, ['nome', 'jogador', 'raca', 'reino', 'armaPrincipal'], ['pilarLuganico']);
  exigirPilar(dados.pilar);

  const { regras, atributos, combate, dano, golpes, poderes, xp } = dados;

  exigir(ehObjeto(regras), 'campo regras ausente.');
  for (const campo of ['pontosIniciais', 'bonusPorNivel', 'nivelReferencia', 'bonusReferencia', 'diferencaMaximaAtributos']) {
    exigir(ehNumero(regras[campo]), `regras.${campo} deve ser numérico.`);
  }

  exigir(ehObjeto(atributos), 'campo atributos ausente.');
  for (const id of ATRIBUTOS) {
    const a = atributos[id];
    exigir(ehObjeto(a), `atributo ${id} ausente.`);
    for (const campo of ['bonusNivel', 'pontos']) {
      exigir(ehNumero(a[campo]), `atributos.${id}.${campo} deve ser numérico.`);
    }
    exigirFontes(a.extras, `atributos.${id}.extras`);
  }

  exigirPericias(dados.pericias);
  exigirFontes(dados.pvExtras, 'pvExtras');

  exigir(ehObjeto(combate), 'campo combate ausente.');
  for (const chave of CHAVES_COMBATE) {
    const e = combate[chave];
    exigir(ehObjeto(e), `combate.${chave} ausente.`);
    exigirFontes(e.fontes, `combate.${chave}.fontes`);
    exigirFontes(e.dadosExtras, `combate.${chave}.dadosExtras`);
    exigir(e.fieisPor === null || ehNumero(e.fieisPor), `combate.${chave}.fieisPor deve ser número ou nulo.`);
  }

  exigir(ehObjeto(dano), 'campo dano ausente.');
  exigir(typeof dano.atributo === 'string' && (ATRIBUTOS as string[]).includes(dano.atributo), 'dano.atributo desconhecido.');
  exigirFontes(dano.dadosExtras, 'dano.dadosExtras');
  exigirFontes(dano.fixos, 'dano.fixos');
  exigir(dano.fieisPor === null || ehNumero(dano.fieisPor), 'dano.fieisPor deve ser número ou nulo.');

  exigir(Array.isArray(golpes), 'golpes deve ser uma lista.');
  for (const g of golpes) {
    exigir(ehObjeto(g) && typeof g.id === 'string' && typeof g.nome === 'string', 'golpe sem id ou nome.');
    exigir(
      ehNumero(g.dadosAtaqueExtras) && ehNumero(g.dadosDanoExtras) && typeof g.ativo === 'boolean',
      `golpe ${g.id} com valores inválidos.`,
    );
    exigir(g.pressaoPorPonto === undefined || ehNumero(g.pressaoPorPonto), `golpe ${g.id} com pressaoPorPonto não numérico.`);
  }

  exigir(Array.isArray(poderes), 'poderes deve ser uma lista.');
  for (const p of poderes) {
    exigir(ehObjeto(p) && typeof p.id === 'string' && typeof p.nome === 'string', 'poder sem id ou nome.');
    exigir(p.nivel === null || ehNumero(p.nivel), `poder ${p.id} com nível inválido.`);
    exigir(typeof p.descricao === 'string', `poder ${p.id} sem descrição.`);
    exigir(typeof p.tipo === 'string' && TIPOS_PODER.includes(p.tipo), `poder ${p.id} com tipo desconhecido.`);
    for (const campo of ['custoFadiga', 'usosPorDia']) {
      exigir(p[campo] === undefined || ehNumero(p[campo]), `poder ${p.id} com ${campo} não numérico.`);
    }
    exigir(p.mostrarNaBatalha === undefined || typeof p.mostrarNaBatalha === 'boolean', `poder ${p.id} com mostrarNaBatalha inválido.`);
    exigir(p.requerPilar === undefined || ehNumero(p.requerPilar), `poder ${p.id} com requerPilar não numérico.`);
    exigir(p.pontosLivres === undefined || p.pontosLivres === null || ehNumero(p.pontosLivres), `poder ${p.id} com pontosLivres não numérico.`);
    exigir(p.valorBasePilar === undefined || ehNumero(p.valorBasePilar), `poder ${p.id} com valorBasePilar não numérico.`);
    exigir(p.origem === undefined || (typeof p.origem === 'string' && ORIGENS_PODER.includes(p.origem)), `poder ${p.id} com origem desconhecida.`);
    // Campos da regra antiga (nível = próprios + pilar): aceitos se numéricos e convertidos pela migração.
    exigir(p.pontosProprios === undefined || p.pontosProprios === null || ehNumero(p.pontosProprios), `poder ${p.id} com pontosProprios não numérico.`);
    exigir(p.pontosDoPilar === undefined || ehNumero(p.pontosDoPilar), `poder ${p.id} com pontosDoPilar não numérico.`);
    if (p.escala !== undefined) exigirEscala(p.escala, p.id);
  }

  exigirTsu(dados.tsu);
  exigirTextosBatalha(dados);
  exigir(ehNumero(dados.fieis), 'fieis deve ser numérico.');
  exigir(ehObjeto(xp) && ehNumero(xp.total) && ehNumero(xp.atual), 'xp inválido.');
}

/** Serializa a ficha para o backup em JSON (legível, com recuo de dois espaços). */
export function exportarJson(f: Ficha): string {
  return JSON.stringify(f, null, 2);
}

/**
 * Lê um backup em JSON. A versão 2 é validada por inteiro e recebe os padrões da aba Batalha e a escala por
 * nível dos poderes conhecidos quando faltam; a versão 1 é validada e migrada para a 2. Qualquer outra versão é rejeitada.
 */
export function importarJson(texto: string): Ficha {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error('Ficha inválida: o texto não é um JSON válido.');
  }

  exigir(ehObjeto(dados), 'o conteúdo deve ser um objeto.');
  exigir(dados.versao === 1 || dados.versao === 2, `versão não suportada (${String(dados.versao)}); esperadas 1 ou 2.`);

  if (dados.versao === 1) {
    validarV1(dados);
    return migrarFicha(dados);
  }
  validarV2(dados);
  return migrarFicha(dados);
}
