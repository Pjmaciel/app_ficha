import { PILAR_NIVEL_PADRAO, PRESSAO_GOLPE_POR_PONTO, acoesPadrao, lembretesPadrao, reacoesPadrao, textoVivo } from '../model/batalha-padrao';
import { escalaPadrao } from '../model/escalas-padrao';
import { limitarNivelPilar, pilarPadrao } from '../model/pilar-padrao';
import type {
  AcaoBatalha,
  Atributo,
  AtributoId,
  ChaveCombate,
  EfeitoEscalavel,
  EscalaPoder,
  Ficha,
  Fonte,
  FonteDerivada,
  GolpeEspecial,
  PatamarPoder,
  Pilar,
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

// ---------- Parcelas derivadas dos poderes (escala × nível) ----------

/** Nível usado nas escalas: poder sem nível conta como zero. */
const nivelDoPoder = (p: Poder): number => p.nivel ?? 0;

/** Poderes que contribuem: têm escala e não foram removidos. */
const poderesComEscala = (f: Ficha): (Poder & { escala: EscalaPoder })[] =>
  f.poderes.filter((p): p is Poder & { escala: EscalaPoder } => p.tipo !== 'removido' && p.escala !== undefined);

/** Parcela do poder: coeficiente × nível; sem coeficiente (ou zero) não há parcela. */
function parcela(p: Poder, coeficiente: number | undefined): FonteDerivada[] {
  if (coeficiente === undefined || coeficiente === 0) return [];
  const nivel = nivelDoPoder(p);
  return [{ nome: p.nome, valor: coeficiente * nivel, poderId: p.id, nivel, coeficiente }];
}

/** Parcela derivada (gerada pelo motor a partir de um poder) em vez de fonte manual. */
export function ehDerivada(fonte: Fonte): fonte is FonteDerivada {
  return fonte.poderId !== undefined;
}

/** Parcelas de ataque ou defesa que os poderes dão à chave de combate. */
export function fontesDerivadasCombate(f: Ficha, chave: ChaveCombate): FonteDerivada[] {
  return poderesComEscala(f).flatMap((p) => parcela(p, p.escala.ataquePorNivel?.[chave]));
}

/** Parcelas fixas de dano dos poderes. */
export function fontesDerivadasDano(f: Ficha): FonteDerivada[] {
  return poderesComEscala(f).flatMap((p) => parcela(p, p.escala.danoPorNivel));
}

/** Parcelas dos poderes no atributo (somam ao total, como os extras nomeados). */
export function fontesDerivadasAtributo(f: Ficha, id: AtributoId): FonteDerivada[] {
  return poderesComEscala(f).flatMap((p) =>
    p.escala.atributoPorNivel?.atributo === id ? parcela(p, p.escala.atributoPorNivel.valor) : []);
}

/** Parcelas de PV extra dos poderes. */
export function fontesDerivadasPv(f: Ficha): FonteDerivada[] {
  return poderesComEscala(f).flatMap((p) => parcela(p, p.escala.pvPorNivel));
}

/** Usos por dia efetivos: `usosPorNivel × nível` quando o poder tem nível e essa escala; senão o valor manual. */
export function usosPorDiaDoPoder(p: Poder): number | undefined {
  const porNivel = p.escala?.usosPorNivel;
  if (porNivel !== undefined && p.nivel !== null) return porNivel * p.nivel;
  return p.usosPorDia;
}

/** Fiéis sugeridos pelos poderes (fiéis por nível × nível); nulo se nenhum poder tem essa escala. */
export function fieisSugeridos(f: Ficha): number | null {
  const poderes = poderesComEscala(f).filter((p) => p.escala.fieisPorNivel !== undefined);
  if (poderes.length === 0) return null;
  return poderes.reduce((s, p) => s + (p.escala.fieisPorNivel ?? 0) * nivelDoPoder(p), 0);
}

/** Dados extras do golpe: o ajuste fixo do golpe mais a escala do poder de mesmo id (× nível). */
export function dadosDoGolpe(f: Ficha, g: GolpeEspecial): { ataque: number; dano: number } {
  const p = f.poderes.find((x) => x.id === g.id);
  const ativo = p !== undefined && p.tipo !== 'removido' ? p : undefined;
  const nivel = ativo ? nivelDoPoder(ativo) : 0;
  return {
    ataque: g.dadosAtaqueExtras + (ativo?.escala?.dadosAtaquePorNivel ?? 0) * nivel,
    dano: g.dadosDanoExtras + (ativo?.escala?.dadosDanoPorNivel ?? 0) * nivel,
  };
}

// ---------- Efeitos escaláveis, textos vivos, patamares e pilar ----------

/** Efeito de um poder no nível atual. Os de ids reservados vêm dos campos `...PorNivel` da escala. */
export interface EfeitoResolvido {
  id: string;
  rotulo: string;
  porPonto: number;
  fixo: number;
  aCada: number;
  unidade?: string;
  /** fixo + porPonto × ⌊nível ÷ aCada⌋; zero para poder removido ou sem nível. */
  valor: number;
  /** Id reservado (parcela de combate, dano, atributo, PV, usos, fiéis ou dados do golpe): a fonte é um campo `...PorNivel`. */
  reservado: boolean;
}

const ROTULO_CHAVE: Record<ChaveCombate, string> = {
  ataqueArmaBranca: 'Ataque com arma branca', ataqueMagico: 'Ataque mágico', ataqueLuta: 'Ataque de luta',
  ataqueArmaFogo: 'Ataque com arma de fogo', esquivar: 'Esquivar', bloquear: 'Bloquear', aparar: 'Aparar',
};

/** Id reservado do efeito de combate: `ataque_<chave sem o prefixo>` (armaBranca, magico, luta, armaFogo) ou `defesa_<chave>`. */
export function idEfeitoCombate(chave: ChaveCombate): string {
  return chave.startsWith('ataque') ? `ataque_${chave[6].toLowerCase()}${chave.slice(7)}` : `defesa_${chave}`;
}

/** Valor de um efeito no nível dado: fixo + porPonto × ⌊nível ÷ aCada⌋ (aCada ausente ou inválido vale 1). */
export function valorDoEfeito(e: Pick<EfeitoEscalavel, 'porPonto' | 'fixo' | 'aCada'>, nivel: number): number {
  const passo = e.aCada !== undefined && e.aCada > 0 ? e.aCada : 1;
  return (e.fixo ?? 0) + e.porPonto * Math.floor(nivel / passo);
}

/**
 * Todos os efeitos do poder no nível atual: primeiro os reservados (derivados dos campos `...PorNivel`), depois os
 * de `escala.efeitos`; se um id se repete, vale o primeiro. Poder removido ou sem nível (ou zero) tem valores zero.
 */
export function efeitosDoPoder(p: Poder): EfeitoResolvido[] {
  const e = p.escala;
  if (!e) return [];
  const nivel = p.tipo === 'removido' ? 0 : nivelDoPoder(p);
  const lista: EfeitoResolvido[] = [];
  const somar = (id: string, rotulo: string, porPonto: number, extra: Partial<EfeitoEscalavel>, reservado: boolean): void => {
    if (lista.some((x) => x.id === id)) return;
    const base = { porPonto, fixo: extra.fixo, aCada: extra.aCada };
    lista.push({
      id, rotulo, porPonto, fixo: extra.fixo ?? 0, aCada: extra.aCada !== undefined && extra.aCada > 0 ? extra.aCada : 1,
      unidade: extra.unidade, valor: nivel > 0 ? valorDoEfeito(base, nivel) : 0, reservado,
    });
  };
  for (const chave of Object.keys(ROTULO_CHAVE) as ChaveCombate[]) {
    const c = e.ataquePorNivel?.[chave];
    if (c !== undefined && c !== 0) somar(idEfeitoCombate(chave), ROTULO_CHAVE[chave], c, {}, true);
  }
  if (e.danoPorNivel) somar('dano', 'Dano fixo', e.danoPorNivel, {}, true);
  if (e.atributoPorNivel && e.atributoPorNivel.valor !== 0) {
    somar(`atributo_${e.atributoPorNivel.atributo}`, ROTULO_ATRIBUTO[e.atributoPorNivel.atributo], e.atributoPorNivel.valor, {}, true);
  }
  if (e.pvPorNivel) somar('pv_extra', 'PV extras', e.pvPorNivel, { unidade: 'PV' }, true);
  if (e.usosPorNivel !== undefined) somar('usos', 'Usos por dia', e.usosPorNivel, {}, true);
  if (e.fieisPorNivel) somar('fieis', 'Fiéis', e.fieisPorNivel, {}, true);
  if (e.dadosAtaquePorNivel) somar('dados_ataque', 'Dados de ataque do golpe', e.dadosAtaquePorNivel, { unidade: 'd' }, true);
  if (e.dadosDanoPorNivel) somar('dados_dano', 'Dados de dano do golpe', e.dadosDanoPorNivel, { unidade: 'd' }, true);
  for (const x of e.efeitos ?? []) somar(x.id, x.rotulo, x.porPonto, x, false);
  return lista;
}

/** Valor de um efeito de um poder da ficha; `nivel` devolve o nível. Nulo se o poder ou o efeito não existe. */
export function valorDeEfeito(f: Ficha, poderId: string, efeito: string, parte?: 'porPonto' | 'fixo'): number | null {
  const p = f.poderes.find((x) => x.id === poderId);
  if (!p) return null;
  if (efeito === 'nivel' && parte === undefined) return nivelDoPoder(p);
  const e = efeitosDoPoder(p).find((x) => x.id === efeito);
  if (!e) return null;
  return parte === 'porPonto' ? e.porPonto : parte === 'fixo' ? e.fixo : e.valor;
}

/** Número em português, com separador de milhar (8.000). */
export const formatarNumero = (n: number): string => n.toLocaleString('pt-BR');

const MARCADOR = /\{([^{}]*)\}/g;

/** Referência `<poder>.<efeito>[.porPonto|.fixo]`, com o prefixo `poder.` opcional; nulo se não tiver a forma. */
function lerReferencia(ref: string): { poderId: string; efeito: string; parte?: 'porPonto' | 'fixo' } | null {
  const partes = ref.trim().split('.');
  if (partes[0] === 'poder') partes.shift();
  const parte = partes[2];
  if (partes.length < 2 || partes.length > 3 || partes.some((x) => x === '')) return null;
  if (parte !== undefined && parte !== 'porPonto' && parte !== 'fixo') return null;
  return { poderId: partes[0], efeito: partes[1], parte };
}

/** Valor de um marcador (`poder.<id>.<efeito>` ou `soma:<a>+<b>`); nulo se algum poder ou efeito não existe. */
function valorDoMarcador(f: Ficha, corpo: string): number | null {
  const ehSoma = corpo.startsWith('soma:');
  if (!ehSoma && !corpo.startsWith('poder.')) return null;
  const refs = (ehSoma ? corpo.slice(5).split('+') : [corpo]).map(lerReferencia);
  let total = 0;
  for (const r of refs) {
    const v = r ? valorDeEfeito(f, r.poderId, r.efeito, r.parte) : null;
    if (v === null) return null;
    total += v;
  }
  return total;
}

/** Valor de um marcador do pilar (`pilar.nivel`, `pilar.<efeito>[.porPonto|.fixo]`); nulo se o efeito não existe. */
function valorDoMarcadorPilar(f: Ficha, corpo: string): number | null {
  const partes = corpo.split('.');
  if (partes[0] !== 'pilar' || partes.length < 2 || partes.length > 3 || partes.some((x) => x === '')) return null;
  const parte = partes[2];
  if (parte !== undefined && parte !== 'porPonto' && parte !== 'fixo') return null;
  if (partes[1] === 'nivel' && parte === undefined) return f.pilar.nivel;
  const e = efeitosDoPilar(f).find((x) => x.id === partes[1]);
  if (!e) return null;
  return parte === 'porPonto' ? e.porPonto : parte === 'fixo' ? e.fixo : e.valor;
}

/** Texto do marcador resolvido; nulo se não for um marcador vivo conhecido. Os do pilar saem sem separador de milhar (rolagens: 2400 + 1d×400). */
function resolverMarcador(f: Ficha, corpo: string): string | null {
  if (corpo.startsWith('pilar.')) {
    const v = valorDoMarcadorPilar(f, corpo);
    return v === null ? null : String(v);
  }
  const v = valorDoMarcador(f, corpo);
  return v === null ? null : formatarNumero(v);
}

/**
 * Resolve os marcadores vivos do texto: `{poder.<id>.<efeito>}`, `{poder.<id>.nivel}` (e `.porPonto`/`.fixo` do efeito),
 * `{soma:<id>.<efeito>+<id>.<efeito>}` e os do pilar, `{pilar.nivel}` e `{pilar.<efeito>}`. O que não for um marcador
 * conhecido fica como está, para o erro aparecer.
 */
export function resolverTexto(f: Ficha, texto: string): string {
  return texto.replace(MARCADOR, (inteiro, corpo: string) => resolverMarcador(f, corpo) ?? inteiro);
}

/** Marcadores do texto que parecem vivos (`{poder...}`, `{soma:...}`, `{pilar...}`) mas não resolvem: poder ou efeito inexistente. */
export function marcadoresInvalidos(f: Ficha, texto: string): string[] {
  const invalidos: string[] = [];
  for (const [inteiro, corpo] of texto.matchAll(MARCADOR)) {
    if (/^(poder\.|soma:|pilar\.)/.test(corpo) && resolverMarcador(f, corpo) === null) invalidos.push(inteiro);
  }
  return invalidos;
}

/** Marcadores que a ficha aceita hoje, com o valor no nível atual (ajuda da edição de textos). */
export function marcadoresDisponiveis(f: Ficha): { marcador: string; rotulo: string; valor: number }[] {
  return [
    ...f.poderes.filter((p) => p.tipo !== 'removido').flatMap((p) => [
      { marcador: `{poder.${p.id}.nivel}`, rotulo: `${p.nome}: nível`, valor: nivelDoPoder(p) },
      ...efeitosDoPoder(p).map((e) => ({ marcador: `{poder.${p.id}.${e.id}}`, rotulo: `${p.nome}: ${e.rotulo}`, valor: e.valor })),
    ]),
    { marcador: '{pilar.nivel}', rotulo: 'Pilar: nível', valor: f.pilar.nivel },
    ...efeitosDoPilar(f).map((e) => ({ marcador: `{pilar.${e.id}}`, rotulo: `Pilar: ${e.rotulo}`, valor: e.valor })),
  ];
}

export interface PatamarAtingido { nivel: number; texto: string; atingido: boolean }

/** Patamares do poder em ordem de nível, marcando os atingidos, e o próximo (o primeiro ainda não atingido). Textos já resolvidos. */
export function patamaresDoPoder(
  f: Ficha,
  p: Poder,
): { patamares: PatamarAtingido[]; atingidos: PatamarAtingido[]; proximo: PatamarAtingido | null } {
  const nivel = p.tipo === 'removido' ? 0 : nivelDoPoder(p);
  const patamares = [...(p.escala?.patamares ?? [])]
    .sort((a: PatamarPoder, b: PatamarPoder) => a.nivel - b.nivel)
    .map((x) => ({ nivel: x.nivel, texto: resolverTexto(f, x.texto), atingido: nivel >= x.nivel }));
  return { patamares, atingidos: patamares.filter((x) => x.atingido), proximo: patamares.find((x) => !x.atingido) ?? null };
}

export interface LinhaEfeito { id: string; rotulo: string; valor: number; texto: string }

/** Efeitos que o card não repete: combate (já em Ataques e Defesas) e usos (o card tem o contador de usos). */
const EFEITOS_FORA_DO_CARD = /^(ataque_|defesa_|dano$|dados_|usos$)/;

/** Efeitos do card do poder na aba Batalha: os com valor diferente de zero, sem as parcelas de combate e os usos. */
export function linhasDeEfeitos(p: Poder): LinhaEfeito[] {
  return efeitosDoPoder(p)
    .filter((e) => !EFEITOS_FORA_DO_CARD.test(e.id) && e.valor !== 0)
    .map((e) => {
      const sinal = e.reservado && (e.id === 'pv_extra' || e.id.startsWith('atributo_')) ? comSinal(e.valor) : formatarNumero(e.valor);
      return { id: e.id, rotulo: e.rotulo, valor: e.valor, texto: `${e.rotulo}: ${sinal}${e.unidade ? ` ${e.unidade}` : ''}` };
    });
}

/** Pilar como exibido na ficha: "Justiça 3" (só o nível se o pilar não tem nome; "—" se nenhum dos dois). */
export function pilarTexto(f: Ficha): string {
  const nome = f.pilar.nome.trim();
  const nivel = f.pilar.nivel;
  if (nome === '') return nivel > 0 ? String(nivel) : '—';
  return `${nome} ${nivel}`;
}

export interface AlertaPilar { poderId: string; nome: string; requer: number; atual: number }

/** Poderes ativos que exigem um aspecto do mundo (pilar) acima do atual: só funcionam quando o aspecto chega ao nível pedido. */
export function alertasPilar(f: Ficha): AlertaPilar[] {
  const atual = f.pilar.nivel;
  return f.poderes
    .filter((p) => p.tipo !== 'removido' && p.requerPilar !== undefined && p.requerPilar > atual)
    .map((p) => ({ poderId: p.id, nome: p.nome, requer: p.requerPilar as number, atual }));
}

// ---------- Pilar com escala: pacote de poderes por nível, efeitos e textos ----------

/** Pontos que o pilar dá ao poder: pacote × (nível do pilar − nível já aplicado); negativo quando o pilar desce abaixo da base. */
export function pontosDoPilar(f: Ficha, p: Poder): number {
  return (f.pilar.pacotePorNivel[p.id] ?? 0) * (f.pilar.nivel - f.pilar.nivelAplicado);
}

/** Nível do poder a partir dos pontos: próprios + pilar, nunca abaixo de zero; nulo se o poder não tem nível e o pilar não mexe nele. */
export function nivelPeloPilar(proprios: number | null, doPilar: number): number | null {
  if (proprios === null && doPilar === 0) return null;
  return Math.max(0, (proprios ?? 0) + doPilar);
}

/**
 * Recalcula, na própria ficha, o que o pilar deriva: limita o nível do pilar a 1..5 e, em cada poder, grava
 * `pontosDoPilar` e `nivel` (= próprios + pilar, nunca abaixo de 0). Poder sem `pontosProprios` (ficha montada à
 * mão) recebe o nível declarado como total atual. Idempotente; chamada na migração, ao mudar o pilar e a cada edição.
 */
export function aplicarPilar(f: Ficha): Ficha {
  f.pilar.nivel = limitarNivelPilar(f.pilar.nivel);
  for (const p of f.poderes) {
    const doPilar = pontosDoPilar(f, p);
    if (p.pontosProprios === undefined) {
      p.pontosProprios = p.nivel === null && doPilar === 0 ? null : Math.max(0, (p.nivel ?? 0) - doPilar);
    }
    p.pontosDoPilar = doPilar;
    p.nivel = nivelPeloPilar(p.pontosProprios, doPilar);
  }
  return f;
}

/** Ficha (nova) com o pilar no nível dado, limitado a 1..5: o pacote entra ou sai e todas as escalas recalculam. */
export function definirNivelPilar(f: Ficha, nivel: number): Ficha {
  const nova = structuredClone(f);
  nova.pilar.nivel = limitarNivelPilar(nivel);
  return aplicarPilar(nova);
}

/** Sobe o pilar um nível (no máximo 5). */
export const subirPilar = (f: Ficha): Ficha => definirNivelPilar(f, f.pilar.nivel + 1);

/** Desce o pilar um nível (no mínimo 1). */
export const descerPilar = (f: Ficha): Ficha => definirNivelPilar(f, f.pilar.nivel - 1);

/** Poderes que mudam de nível se o pilar for para `nivel`: o total de hoje e o de depois. */
export function previaPilar(f: Ficha, nivel: number): { poderId: string; nome: string; de: number | null; para: number | null }[] {
  const depois = definirNivelPilar(f, nivel);
  return f.poderes.flatMap((p, i) => {
    const para = depois.poderes[i].nivel;
    return p.nivel === para ? [] : [{ poderId: p.id, nome: p.nome, de: p.nivel, para }];
  });
}

/** Efeitos do pilar no nível atual (valor = fixo + porPonto × ⌊nível ÷ aCada⌋); se um id se repete, vale o primeiro. */
export function efeitosDoPilar(f: Ficha): EfeitoResolvido[] {
  const lista: EfeitoResolvido[] = [];
  for (const e of f.pilar.efeitos) {
    if (lista.some((x) => x.id === e.id)) continue;
    lista.push({
      id: e.id, rotulo: e.rotulo, porPonto: e.porPonto, fixo: e.fixo ?? 0, aCada: e.aCada !== undefined && e.aCada > 0 ? e.aCada : 1,
      unidade: e.unidade, valor: valorDoEfeito(e, f.pilar.nivel), reservado: false,
    });
  }
  return lista;
}

/** Teste da Proteção do Dragão Vermelho: nível do pilar × 800 + 1d×400 (efeitos `teste_dragao` e `teste_dado`); nulo sem esses efeitos. */
export function testeDragaoVermelho(f: Ficha): { base: number; dado: number; texto: string } | null {
  const efeitos = efeitosDoPilar(f);
  const base = efeitos.find((e) => e.id === 'teste_dragao');
  const dado = efeitos.find((e) => e.id === 'teste_dado');
  if (!base || !dado) return null;
  return { base: base.valor, dado: dado.valor, texto: `${base.valor} + 1d×${dado.valor}` };
}

/** Base do atributo: bônus de nível + pontos distribuídos (sem extras). */
export function baseAtributo(a: Atributo): number {
  return a.bonusNivel + a.pontos;
}

/** Total do atributo sem as parcelas dos poderes: base + soma dos extras nomeados (manuais). */
export function totalAtributo(a: Atributo): number {
  return baseAtributo(a) + somaFontes(a.extras);
}

/** Total do atributo na ficha: base + extras manuais + parcelas derivadas dos poderes. */
export function totalAtributoFicha(f: Ficha, id: AtributoId): number {
  return totalAtributo(f.atributos[id]) + somaFontes(fontesDerivadasAtributo(f, id));
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
  return p.inicial + totalAtributoFicha(f, p.atributo) + p.graduacao;
}

/** Pontos de vida sem extras: basePv × total de Fortitude. */
export function pvBase(f: Ficha): number {
  return f.identidade.basePv * totalAtributoFicha(f, 'fortitude');
}

/** Pontos de vida máximos: base + PV extras manuais + PV derivados dos poderes. */
export function pvTotal(f: Ficha): number {
  return pvBase(f) + somaFontes(f.pvExtras) + somaFontes(fontesDerivadasPv(f));
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
  const attr = (id: AtributoId) => totalAtributoFicha(f, id);
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
 * Valor de combate da aba LUGAN (linhas 26-32): alvo da fórmula + parcelas derivadas dos poderes + fontes
 * manuais + bônus de fiéis. A composição lista cada parcela, nessa ordem; a soma dela é o total.
 * Os dados são os do nível mais os extras.
 */
export function combate(
  f: Ficha,
  chave: ChaveCombate,
): { total: number; composicao: Fonte[]; dados: number; fieisBonus: number } {
  const entrada = f.combate[chave];
  const fieisBonus = bonusFieis(f.fieis, entrada.fieisPor);
  const composicao = [...baseCombate(f, chave), ...fontesDerivadasCombate(f, chave), ...entrada.fontes];
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
 * houver golpe, os dados de dano dele. O bônus fixo soma as parcelas dos poderes e as manuais; os fiéis
 * somam +1 por `fieisPor` a ele no texto.
 */
export function dano(f: Ficha, golpeEspecial?: GolpeEspecial): ResultadoDano {
  const d = f.dano;
  const dados =
    dadosPorNivel(f.identidade.nivel) + somaFontes(d.dadosExtras) + (golpeEspecial ? dadosDoGolpe(f, golpeEspecial).dano : 0);
  const multiplicador = totalAtributoFicha(f, d.atributo);
  const fixo = somaFontes(fontesDerivadasDano(f)) + somaFontes(d.fixos);
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
    ataqueDados: ataque.dados + dadosDoGolpe(f, g).ataque,
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
  return p.tipo !== 'removido' && (usosPorDiaDoPoder(p) !== undefined || p.custoFadiga !== undefined);
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
  const limite = usosPorDiaDoPoder(p) ?? null;
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
  /** Pressão em km²: pontos × `pressaoPorPonto` do golpe; sem ele, o efeito `pressao_km2` do poder (nulo se faltar ambos). */
  pressaoKm2: number | null;
  /** Usos por dia do poder correspondente; nulo se ele não existe ou não é consumível. */
  uso: UsoPoder | null;
}

export interface DefesaBatalha { chave: 'aparar' | 'bloquear' | 'esquivar'; nome: string; rolagem: RolagemPronta }

export interface ProtecaoBatalha {
  id: string;
  nome: string;
  nivel: number | null;
  /** Descrição com os marcadores vivos resolvidos. */
  descricao: string;
  uso: UsoPoder | null;
  /** Efeitos no nível atual, gerados de `escala` (sem as parcelas de combate). */
  efeitos: LinhaEfeito[];
  /** Todos os patamares do poder, com os atingidos marcados. */
  patamares: PatamarAtingido[];
  /** Primeiro patamar ainda não atingido; nulo se todos foram ou o poder não tem patamares. */
  proximoPatamar: PatamarAtingido | null;
  /** Resumo em uma linha: efeitos e patamares (atingidos e próximo). */
  resumo: string;
}

/** Card "Pilar da Justiça nível N" da aba Batalha, com os textos do pilar já resolvidos. */
export interface PilarBatalha {
  titulo: string;
  nome: string;
  nivel: number;
  /** Teste da Proteção do Dragão Vermelho calculado (ex.: "2400 + 1d×400"); nulo se o pilar não tem esses efeitos. */
  testeDragao: string | null;
  textos: string[];
}

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
  /** Card do pilar; nulo quando o pilar não tem textos nem efeitos. */
  pilar: PilarBatalha | null;
  /** Todos os poderes consumíveis, com os usos restantes. */
  usos: UsoPoder[];
}

const DEFESAS_BATALHA: { chave: DefesaBatalha['chave']; nome: string }[] = [
  { chave: 'aparar', nome: 'Aparar' },
  { chave: 'bloquear', nome: 'Bloquear' },
  { chave: 'esquivar', nome: 'Esquivar' },
];

/** Card de proteção do poder: efeitos no nível atual, patamares e o resumo em uma linha. */
function protecaoDoPoder(f: Ficha, p: Poder, uso: UsoPoder | null): ProtecaoBatalha {
  const efeitos = linhasDeEfeitos(p);
  const { patamares, atingidos, proximo } = patamaresDoPoder(f, p);
  const partes = efeitos.map((e) => e.texto);
  for (const x of atingidos) partes.push(`nível ${x.nivel}: ${x.texto}`);
  if (proximo) partes.push(`próximo patamar: nível ${proximo.nivel}, ${proximo.texto}`);
  return {
    id: p.id, nome: p.nome, nivel: p.nivel, descricao: resolverTexto(f, p.descricao), uso,
    efeitos, patamares, proximoPatamar: proximo, resumo: partes.join('; '),
  };
}

/** Título do card do pilar: "Pilar da Justiça nível 3" (só "Pilar nível N" sem nome). */
export function tituloPilar(f: Ficha): string {
  const nome = f.pilar.nome.trim();
  return nome === '' ? `Pilar nível ${f.pilar.nivel}` : `Pilar da ${nome} nível ${f.pilar.nivel}`;
}

/** Card do pilar da aba Batalha; nulo se o pilar não traz textos nem efeitos. */
function pilarDaBatalha(f: Ficha): PilarBatalha | null {
  if (f.pilar.textos.length === 0 && f.pilar.efeitos.length === 0) return null;
  return {
    titulo: tituloPilar(f),
    nome: f.pilar.nome.trim(),
    nivel: f.pilar.nivel,
    testeDragao: testeDragaoVermelho(f)?.texto ?? null,
    textos: f.pilar.textos.map((t) => resolverTexto(f, t)),
  };
}

/** Tudo o que a aba Batalha exibe, já calculado (textos vivos resolvidos); não altera a ficha nem a sessão. */
export function resumoBatalha(f: Ficha, sessao: Sessao): ResumoBatalha {
  const poderDe = (id: string) => f.poderes.find((p) => p.id === id);
  const velocidade = poderDe('velocidade_divina');
  const usoOuNulo = (p: Poder | undefined): UsoPoder | null =>
    p && poderUsavel(p) && usosPorDiaDoPoder(p) !== undefined ? usoDoPoder(p, sessao) : null;

  const golpes = f.golpes.map((g): GolpeBatalha => {
    const r = golpe(f, g);
    const poder = poderDe(g.id);
    const pontos = poder && poder.tipo !== 'removido' ? poder.nivel : null;
    // Pressão: o valor por ponto do próprio golpe, se houver; senão o efeito `pressao_km2` do poder de mesmo id.
    const pressaoDoPoder = poder && poder.tipo !== 'removido' ? efeitosDoPoder(poder).find((e) => e.id === 'pressao_km2') : undefined;
    return {
      id: g.id,
      nome: g.nome,
      ataque: { dados: r.ataqueDados, bonus: r.ataqueTotal, texto: formatarRolagem(r.ataqueDados, r.ataqueTotal) },
      dano: r.dano,
      pontos,
      pressaoKm2: g.pressaoPorPonto !== undefined
        ? (pontos !== null ? pontos * g.pressaoPorPonto : null)
        : (pressaoDoPoder?.valor ?? null),
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
    acoes: f.acoes.map((a) => ({ ...a, nome: resolverTexto(f, a.nome), rolagem: resolverTexto(f, a.rolagem), notas: resolverTexto(f, a.notas) })),
    protecoes: f.poderes.filter(mostraNaBatalha).map((p) => protecaoDoPoder(f, p, usoOuNulo(p))),
    reacoes: f.reacoes.map((r) => ({ situacao: resolverTexto(f, r.situacao), resposta: resolverTexto(f, r.resposta) })),
    lembretes: f.lembretes.map((t) => resolverTexto(f, t)),
    pilar: pilarDaBatalha(f),
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
  identidade: Omit<Ficha['identidade'], 'armaPrincipal'> & { pilarLuganico: string };
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
    // Só os efeitos informativos: as parcelas numéricas ficariam somadas em dobro ao bônus passivo opaco da versão 1.
    semearEfeitos(poder);
    return poder;
  });

  const { pilarLuganico, ...identidade } = v1.identidade;
  return aplicarPilar({
    versao: 2,
    revisaoDados: 0,
    identidade: { ...identidade, armaPrincipal: '' },
    pilar: pilarPadrao(pilarLuganico, PILAR_NIVEL_PADRAO),
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
  });
}

/**
 * Ficha versão 2 salva antes da aba Batalha ou do pilar com escala: os campos dela podem faltar, e o pilar pode
 * estar ainda em `identidade` (`pilarLuganico` e `pilarNivel`).
 */
type FichaV2Anterior = Omit<Ficha, 'acoes' | 'lembretes' | 'reacoes' | 'revisaoDados' | 'identidade' | 'pilar'> &
  Partial<Pick<Ficha, 'acoes' | 'lembretes' | 'reacoes' | 'revisaoDados' | 'pilar'>> & {
    identidade: Ficha['identidade'] & { pilarLuganico?: string; pilarNivel?: number };
  };

/** Versão 2 já com os campos da aba Batalha, mas ainda sem o pilar montado. */
type FichaSemPilar = Omit<Ficha, 'pilar' | 'identidade'> & Pick<FichaV2Anterior, 'pilar' | 'identidade'>;

/**
 * Completa a versão 2 com os valores padrão da aba Batalha. Cada lista ausente recebe os textos iniciais.
 * Só quando as três faltam (ficha anterior à aba) o Golpe Devastador também ganha usos por dia iguais aos
 * seus pontos e a pressão padrão; depois disso, apagar esses campos é uma escolha do jogador e é respeitada.
 */
function completarBatalha(f: FichaV2Anterior): FichaSemPilar {
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
    revisaoDados: f.revisaoDados ?? 0,
    acoes: f.acoes?.map((a) => ({ ...a, rolagem: textoVivo(a.rolagem), notas: textoVivo(a.notas) })) ?? acoesPadrao(),
    lembretes: f.lembretes?.map(textoVivo) ?? lembretesPadrao(),
    reacoes: f.reacoes?.map((r) => ({ ...r, resposta: textoVivo(r.resposta) })) ?? reacoesPadrao(),
  };
}

/**
 * Monta `Ficha.pilar` na versão 2 que ainda o guarda em `identidade` (`pilarLuganico`, `pilarNivel`) ou não o tem:
 * a semente do livro (Justiça traz pacote, efeitos e textos) com o nível salvo (3 quando ausente) e `nivelAplicado` =
 * esse nível, então nenhum ponto de poder muda. Um pilar já salvo é respeitado; só os campos ausentes são completados.
 * Os campos antigos saem de `identidade`. Poder sem `pontosProprios` recebe o nível atual (ver `aplicarPilar`).
 */
function completarPilar(f: FichaSemPilar): Ficha {
  const { pilarLuganico, pilarNivel, ...identidade } = f.identidade;
  const salvo = f.pilar;
  const nome = salvo?.nome ?? pilarLuganico ?? '';
  const nivel = limitarNivelPilar(salvo?.nivel ?? pilarNivel ?? PILAR_NIVEL_PADRAO);
  const semente = pilarPadrao(nome, nivel);
  const pilar: Pilar = {
    nome,
    nivel,
    nivelAplicado: typeof salvo?.nivelAplicado === 'number' ? Math.max(0, Math.round(salvo.nivelAplicado)) : semente.nivelAplicado,
    pacotePorNivel: salvo?.pacotePorNivel ?? semente.pacotePorNivel,
    efeitos: salvo?.efeitos ?? semente.efeitos,
    textos: salvo?.textos ?? semente.textos,
  };
  return { ...f, revisaoDados: f.revisaoDados ?? 0, identidade, pilar };
}

/** Retira da lista as fontes manuais com o nome dado; devolve a soma retirada, ou nulo se não havia nenhuma. */
function retirarFontes(fontes: Fonte[], nome: string): number | null {
  const achadas = fontes.filter((x) => x.poderId === undefined && x.nome.trim() === nome.trim());
  if (achadas.length === 0) return null;
  const restantes = fontes.filter((x) => !achadas.includes(x));
  fontes.splice(0, fontes.length, ...restantes);
  return somaFontes(achadas);
}

/**
 * Injeta a escala do livro no poder conhecido (por id) e converte em derivadas as fontes manuais que levam o
 * nome dele, preservando todos os totais: a diferença entre o valor salvo e coeficiente × nível vira uma fonte
 * manual "Ajuste do mestre (poder)". Só entra na escala o que corresponde a algo já salvo na ficha (uma fonte
 * com o nome do poder, os usos iguais ao nível, o golpe de mesmo id); o restante ficaria somado em dobro.
 */
function converterPoder(f: Ficha, p: Poder): void {
  const semente = escalaPadrao(p.id);
  if (!semente) return;
  const nivel = nivelDoPoder(p);
  const contribui = (coeficiente: number): number => (p.tipo === 'removido' ? 0 : coeficiente * nivel);
  const escala: EscalaPoder = {};
  const converter = (fontes: Fonte[], coeficiente: number): boolean => {
    const antes = retirarFontes(fontes, p.nome);
    if (antes === null) return false;
    const diferenca = antes - contribui(coeficiente);
    if (diferenca !== 0) fontes.push({ nome: `Ajuste do mestre (${p.nome})`, valor: diferenca });
    return true;
  };

  for (const chave of Object.keys(f.combate) as ChaveCombate[]) {
    const coeficiente = semente.ataquePorNivel?.[chave];
    if (coeficiente !== undefined && converter(f.combate[chave].fontes, coeficiente)) {
      escala.ataquePorNivel = { ...escala.ataquePorNivel, [chave]: coeficiente };
    }
  }
  if (semente.danoPorNivel !== undefined && converter(f.dano.fixos, semente.danoPorNivel)) {
    escala.danoPorNivel = semente.danoPorNivel;
  }
  const porAtributo = semente.atributoPorNivel;
  if (porAtributo && converter(f.atributos[porAtributo.atributo].extras, porAtributo.valor)) {
    escala.atributoPorNivel = { ...porAtributo };
  }
  if (semente.pvPorNivel !== undefined && converter(f.pvExtras, semente.pvPorNivel)) {
    escala.pvPorNivel = semente.pvPorNivel;
  }
  if (semente.usosPorNivel !== undefined && p.nivel !== null && p.usosPorDia === semente.usosPorNivel * p.nivel) {
    escala.usosPorNivel = semente.usosPorNivel;
    delete p.usosPorDia;
  }
  const golpeDoPoder = f.golpes.find((g) => g.id === p.id);
  if (golpeDoPoder) {
    if (semente.dadosAtaquePorNivel !== undefined) {
      escala.dadosAtaquePorNivel = semente.dadosAtaquePorNivel;
      golpeDoPoder.dadosAtaqueExtras -= contribui(semente.dadosAtaquePorNivel);
    }
    if (semente.dadosDanoPorNivel !== undefined) {
      escala.dadosDanoPorNivel = semente.dadosDanoPorNivel;
      golpeDoPoder.dadosDanoExtras -= contribui(semente.dadosDanoPorNivel);
    }
  }
  if (semente.fieisPorNivel !== undefined) escala.fieisPorNivel = semente.fieisPorNivel;

  if (Object.keys(escala).length > 0) p.escala = escala;
}

/**
 * Efeitos e patamares do livro para o poder conhecido que ainda não os tem (lista ausente; uma lista vazia é escolha do
 * jogador e é respeitada, como a escala vazia `{}`). Não há valor salvo a converter: os efeitos só acrescentam alcance, absorção e textos.
 */
function semearEfeitos(p: Poder): void {
  const semente = escalaPadrao(p.id);
  if (!semente || (p.escala !== undefined && Object.keys(p.escala).length === 0)) return;
  if (semente.efeitos !== undefined && p.escala?.efeitos === undefined) p.escala = { ...p.escala, efeitos: semente.efeitos };
  if (semente.patamares !== undefined && p.escala?.patamares === undefined) p.escala = { ...p.escala, patamares: semente.patamares };
}

/** Poderes já com `escala` (mesmo vazia) são respeitados; os conhecidos sem ela recebem a semente; os efeitos ausentes são semeados. */
function aplicarEscalas(f: Ficha): Ficha {
  for (const p of f.poderes) {
    if (p.escala === undefined) converterPoder(f, p);
    semearEfeitos(p);
  }
  return f;
}

/**
 * Devolve uma ficha na versão 2. A versão 1 é convertida (regras padrão do contrato: bônus 47 no
 * nível 41, então um bônus de nível antigo dispara o alerta de correção); a versão 2 é copiada e
 * recebe os valores padrão da aba Batalha e a escala por nível dos poderes conhecidos quando ausentes (as
 * fontes salvas que levam o nome do poder viram parcelas derivadas, sem mudar nenhum total).
 * Não valida a estrutura: para conteúdo externo, use `importarJson`.
 */
export function migrarFicha(json: unknown): Ficha {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Ficha inválida: o conteúdo deve ser um objeto.');
  }
  const versao = (json as { versao?: unknown }).versao;
  if (versao === 2) return aplicarEscalas(aplicarPilar(completarPilar(completarBatalha(structuredClone(json as FichaV2Anterior)))));
  if (versao === 1) return migrarV1(structuredClone(json as FichaV1));
  throw new Error(`Ficha inválida: versão não suportada (${String(versao)}); esperadas 1 ou 2.`);
}

/** O que fazer com a ficha salva no navegador diante da ficha embutida. */
export type DecisaoCarregamento =
  | { acao: 'embutida'; motivo: 'sem-salva' | 'planilha-antiga' }
  | { acao: 'salva'; avisarNovaRevisao: boolean };

/**
 * Decide o carregamento a partir do JSON já lido do armazenamento (ou nulo). Sem ficha salva, ou com a
 * versão 1 (planilha antiga), vale a embutida; a versão 2 com revisão menor que a embutida é mantida, mas pede aviso.
 */
export function decidirCarregamento(salva: unknown, embutida: Ficha): DecisaoCarregamento {
  if (typeof salva !== 'object' || salva === null || Array.isArray(salva)) return { acao: 'embutida', motivo: 'sem-salva' };
  const { versao, revisaoDados } = salva as { versao?: unknown; revisaoDados?: unknown };
  if (versao === 1) return { acao: 'embutida', motivo: 'planilha-antiga' };
  const revisao = typeof revisaoDados === 'number' && Number.isFinite(revisaoDados) ? revisaoDados : 0;
  return { acao: 'salva', avisarNovaRevisao: versao === 2 && revisao < embutida.revisaoDados };
}
