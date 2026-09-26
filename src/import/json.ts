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
const TIPOS_PODER = ['passivo', 'ativo', 'defensivo', 'item', 'removido'];
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
    exigir(ehObjeto(f) && typeof f.nome === 'string' && ehNumero(f.valor), `${caminho} tem fonte inválida.`);
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

function exigirIdentidade(identidade: unknown, textos: string[]): asserts identidade is Objeto {
  exigir(ehObjeto(identidade), 'campo identidade ausente.');
  for (const campo of textos) {
    exigir(typeof identidade[campo] === 'string', `identidade.${campo} deve ser texto.`);
  }
  for (const campo of ['nivel', 'nivelLuganico', 'basePv']) {
    exigir(ehNumero(identidade[campo]), `identidade.${campo} deve ser numérico.`);
  }
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

/** Valida a estrutura completa da versão 2. */
function validarV2(dados: Objeto): void {
  exigirIdentidade(dados.identidade, ['nome', 'jogador', 'raca', 'reino', 'pilarLuganico', 'armaPrincipal']);

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
  }

  exigirTsu(dados.tsu);
  exigir(ehNumero(dados.fieis), 'fieis deve ser numérico.');
  exigir(ehObjeto(xp) && ehNumero(xp.total) && ehNumero(xp.atual), 'xp inválido.');
}

/** Serializa a ficha para o backup em JSON (legível, com recuo de dois espaços). */
export function exportarJson(f: Ficha): string {
  return JSON.stringify(f, null, 2);
}

/**
 * Lê um backup em JSON. A versão 2 é validada por inteiro; a versão 1 é validada e migrada para a 2.
 * Qualquer outra versão é rejeitada.
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
  return dados as unknown as Ficha;
}
