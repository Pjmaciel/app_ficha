import type { AtributoId, Ficha } from '../model/types';

const ATRIBUTOS: AtributoId[] = ['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental'];
const CHAVES_COMBATE = [
  'ataqueArmaBranca',
  'ataqueMagico',
  'ataqueLuta',
  'ataqueArmaFogo',
  'esquivar',
  'bloquear',
  'aparar',
];

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function exigir(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(`Ficha inválida: ${mensagem}`);
}

const ehNumero = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/** Serializa a ficha para o backup em JSON (legível, com recuo de dois espaços). */
export function exportarJson(f: Ficha): string {
  return JSON.stringify(f, null, 2);
}

/** Lê um backup em JSON e valida versão e campos essenciais antes de devolver a ficha. */
export function importarJson(texto: string): Ficha {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error('Ficha inválida: o texto não é um JSON válido.');
  }

  exigir(ehObjeto(dados), 'o conteúdo deve ser um objeto.');
  exigir(dados.versao === 1, `versão não suportada (${String(dados.versao)}); esperada 1.`);

  const { identidade, atributos, pericias, combate, poderes, tsu, xp } = dados;

  exigir(ehObjeto(identidade), 'campo identidade ausente.');
  for (const campo of ['nome', 'jogador', 'raca', 'reino', 'pilarLuganico']) {
    exigir(typeof identidade[campo] === 'string', `identidade.${campo} deve ser texto.`);
  }
  for (const campo of ['nivel', 'nivelLuganico', 'basePv']) {
    exigir(ehNumero(identidade[campo]), `identidade.${campo} deve ser numérico.`);
  }

  exigir(ehNumero(dados.pontosIniciais), 'pontosIniciais deve ser numérico.');

  exigir(ehObjeto(atributos), 'campo atributos ausente.');
  for (const id of ATRIBUTOS) {
    const a = atributos[id];
    exigir(ehObjeto(a), `atributo ${id} ausente.`);
    for (const campo of ['bonus', 'pontos', 'bonusExtra']) {
      exigir(ehNumero(a[campo]), `atributos.${id}.${campo} deve ser numérico.`);
    }
  }

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

  exigir(ehObjeto(combate) && ehObjeto(combate.bonusPassivo), 'combate.bonusPassivo ausente.');
  for (const chave of CHAVES_COMBATE) {
    exigir(ehNumero(combate.bonusPassivo[chave]), `combate.bonusPassivo.${chave} deve ser numérico.`);
  }

  exigir(Array.isArray(poderes), 'poderes deve ser uma lista.');
  for (const p of poderes) {
    exigir(ehObjeto(p) && typeof p.id === 'string' && typeof p.nome === 'string', 'poder sem id ou nome.');
    exigir(ehNumero(p.nivel) && typeof p.descricao === 'string', `poder ${p.id} com nível ou descrição inválidos.`);
  }

  exigir(Array.isArray(tsu), 'tsu deve ser uma lista.');
  for (const t of tsu) {
    exigir(
      ehObjeto(t) && typeof t.elemento === 'string' && ehNumero(t.nivel) && typeof t.real === 'boolean',
      'entrada de tsu inválida.',
    );
  }

  exigir(ehObjeto(xp) && ehNumero(xp.total) && ehNumero(xp.atual), 'xp inválido.');

  return dados as unknown as Ficha;
}
