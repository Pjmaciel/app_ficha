// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dados from '../../src/data/alexsander.json';
import type { Ficha } from '../../src/model/types';
import { CHAVE_FICHA, CHAVE_SESSAO } from '../../src/ui/estado';
import { iniciar } from '../../src/ui/app';

function montar(ficha: Ficha): HTMLElement {
  localStorage.clear();
  localStorage.setItem(CHAVE_FICHA, JSON.stringify(ficha));
  localStorage.removeItem(CHAVE_SESSAO);
  document.body.innerHTML = '<div id="app"></div>';
  const raiz = document.getElementById('app') as HTMLElement;
  iniciar(raiz);
  return raiz;
}

const abrir = (raiz: HTMLElement, nome: string): void => {
  const botao = [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === nome);
  if (!botao) throw new Error(`Aba ausente: ${nome}`);
  botao.click();
};

const botao = (raiz: HTMLElement, texto: string): HTMLButtonElement => {
  const achado = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.startsWith(texto));
  if (!achado) throw new Error(`Botão ausente: ${texto}`);
  return achado;
};

/** Campo "Nível" do cartão do poder com o nome dado. */
function nivelDoPoder(raiz: HTMLElement, nome: string): HTMLInputElement {
  const cartao = [...raiz.querySelectorAll<HTMLElement>('.cartao.poder')]
    .find((c) => c.querySelector<HTMLInputElement>('input[type="text"]')?.value === nome);
  const rotulo = [...(cartao?.querySelectorAll<HTMLLabelElement>('label') ?? [])].find((l) => l.textContent?.startsWith('Nível'));
  if (!rotulo) throw new Error(`Poder ausente: ${nome}`);
  return rotulo.querySelector('input') as HTMLInputElement;
}

const salva = (): Ficha => JSON.parse(localStorage.getItem(CHAVE_FICHA) as string) as Ficha;
const embutida = (): Ficha => structuredClone(dados) as unknown as Ficha;

describe('interface da evolução por nível divino', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('a Identidade mostra a barra de XP com a extrapolação, os campos de custo e incremento e os pontos de poder', () => {
    const raiz = montar(embutida());
    abrir(raiz, 'Identidade');
    expect(raiz.textContent).toContain('XP: 62 / 50 para o nível 42 (extrapolação; confirme com o mestre)');
    const barra = raiz.querySelector('.barra.xp');
    expect(barra?.getAttribute('aria-valuenow')).toBe('50');
    expect(barra?.getAttribute('aria-valuemax')).toBe('50');
    expect(raiz.querySelector<HTMLElement>('.barra.xp .preenchimento')?.style.width).toBe('100%');
    expect(raiz.textContent).toContain('Pontos de poder disponíveis: 0');
    expect(raiz.textContent).toContain('XP para o próximo nível');
    expect(raiz.textContent).toContain('Incremento de XP por nível');
    expect(raiz.textContent).toContain('Nível lugânico (informativo; não existe no livro)');
  });

  it('com XP insuficiente o botão pede confirmação; recusar não abre a escolha', () => {
    const f = embutida();
    f.xp.atual = 20;
    const raiz = montar(f);
    abrir(raiz, 'Identidade');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    botao(raiz, 'Subir de nível (forçar)').click();
    expect(confirmar).toHaveBeenCalledOnce();
    expect(raiz.querySelector<HTMLElement>('.painel-subir-nivel')?.hidden).toBe(true);
    expect(salva().identidade.nivel).toBe(41);
  });

  it('fluxo completo na ficha embutida (XP 62 ≥ 50, sem confirmação): 4 atributos, prévia e aplicar (nível 42, +10, +4 em perícias, XP 12)', () => {
    const antes = embutida();
    const raiz = montar(antes);
    abrir(raiz, 'Identidade');
    const confirmar = vi.spyOn(window, 'confirm');
    botao(raiz, 'Subir de nível').click();
    expect(botao(raiz, 'Subir de nível').textContent).toBe('Subir de nível');
    expect(confirmar).not.toHaveBeenCalled();
    const painel = raiz.querySelector<HTMLElement>('.painel-subir-nivel') as HTMLElement;
    expect(painel.hidden).toBe(false);
    expect(painel.textContent).toContain('Subir para o nível 42');
    const confirmarSubida = botao(painel, 'Confirmar');
    expect(confirmarSubida.disabled).toBe(true);

    const marcar = (id: string): void => {
      const caixa = painel.querySelector<HTMLInputElement>(`input[data-atributo="${id}"]`) as HTMLInputElement;
      caixa.checked = !caixa.checked;
      caixa.dispatchEvent(new Event('change'));
    };
    marcar('forca'); marcar('agilidade'); marcar('fortitude');
    expect(painel.textContent).toContain('Atributos escolhidos: 3 de 4');
    expect(confirmarSubida.disabled).toBe(true);
    marcar('mental');
    expect(painel.textContent).toContain('Atributos escolhidos: 4 de 4');
    expect(painel.textContent).toContain('+10 no bônus de nível de Força, Agilidade, Fortitude, Mental');
    expect(painel.textContent).toContain('Nível 42 é par: +4 na graduação de todas as perícias');
    expect(painel.textContent).toContain('XP atual: 62 → 12');
    expect(painel.textContent).toContain('custará 50');
    expect(confirmarSubida.disabled).toBe(false);
    marcar('reflexos');
    expect(painel.textContent).toContain('Atributos escolhidos: 5 de 4');
    expect(confirmarSubida.disabled).toBe(true);
    marcar('reflexos');

    confirmarSubida.click();
    const depois = salva();
    expect(depois.identidade.nivel).toBe(42);
    expect(depois.atributos.forca.bonusNivel).toBe(antes.atributos.forca.bonusNivel + 10);
    expect(depois.atributos.reflexos.bonusNivel).toBe(antes.atributos.reflexos.bonusNivel);
    expect(depois.pericias[0].graduacao).toBe(antes.pericias[0].graduacao + 4);
    expect(depois.xp).toEqual({ total: 62, atual: 12 });
    expect(depois.regras.xpProximoNivel).toBe(50);
    expect(raiz.textContent).toContain('XP: 12 / 50 para o nível 43');
    // Agora o XP não chega ao custo: o botão passa a pedir confirmação para forçar.
    expect(botao(raiz, 'Subir de nível').textContent).toBe('Subir de nível (forçar)');
    expect(raiz.querySelector('[role="status"][aria-live]')?.textContent).toContain('Subiu para o nível 42');
  });

  it('forçar com XP insuficiente: confirma, abre a escolha e o XP atual vai a zero', () => {
    const f = embutida();
    f.xp.atual = 20;
    const raiz = montar(f);
    abrir(raiz, 'Identidade');
    expect(raiz.textContent).toContain('XP: 20 / 50 para o nível 42');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    botao(raiz, 'Subir de nível (forçar)').click();
    expect(confirmar).toHaveBeenCalledOnce();
    const painel = raiz.querySelector<HTMLElement>('.painel-subir-nivel') as HTMLElement;
    expect(painel.hidden).toBe(false);
    expect(painel.textContent).toContain('XP atual: 20 → 0');
    for (const id of ['forca', 'agilidade', 'fortitude', 'mental']) {
      const caixa = painel.querySelector<HTMLInputElement>(`input[data-atributo="${id}"]`) as HTMLInputElement;
      caixa.checked = true;
      caixa.dispatchEvent(new Event('change'));
    }
    botao(painel, 'Confirmar').click();
    expect(salva().identidade.nivel).toBe(42);
    expect(salva().xp).toEqual({ total: 62, atual: 0 });
  });

  it('com o XP atingido o botão não pede confirmação; nível ímpar mostra o ponto de poder na Identidade e na aba Poderes', () => {
    const f = embutida();
    f.identidade.nivel = 42;
    const raiz = montar(f);
    abrir(raiz, 'Identidade');
    const confirmar = vi.spyOn(window, 'confirm');
    botao(raiz, 'Subir de nível').click();
    expect(confirmar).not.toHaveBeenCalled();
    const painel = raiz.querySelector<HTMLElement>('.painel-subir-nivel') as HTMLElement;
    expect(painel.textContent).toContain('Nível 43 é ímpar: perícias inalteradas e +1 ponto de poder');
    for (const id of ['forca', 'agilidade', 'fortitude', 'mental']) {
      const caixa = painel.querySelector<HTMLInputElement>(`input[data-atributo="${id}"]`) as HTMLInputElement;
      caixa.checked = true;
      caixa.dispatchEvent(new Event('change'));
    }
    botao(painel, 'Confirmar').click();
    expect(salva().pontosDePoderDisponiveis).toBe(1);
    expect(salva().identidade.nivel).toBe(43);
    expect(raiz.textContent).toContain('Pontos de poder disponíveis: 1');
    abrir(raiz, 'Poderes');
    const campoPontos = raiz.querySelector<HTMLInputElement>('.pontos-de-poder input') as HTMLInputElement;
    expect(campoPontos.value).toBe('1');
  });

  it('na regra da planilha o botão pergunta quantos níveis e soma o bônus a todos os atributos', () => {
    const f = embutida();
    f.regras.regraNivel = 'planilha';
    const raiz = montar(f);
    abrir(raiz, 'Atributos');
    vi.spyOn(window, 'prompt').mockReturnValue('2');
    botao(raiz, 'Subir de nível').click();
    const depois = salva();
    expect(depois.identidade.nivel).toBe(43);
    expect(depois.atributos.mental.bonusNivel).toBe(f.atributos.mental.bonusNivel + 8);
    expect(depois.xp).toEqual(f.xp);
  });

  it('ao aumentar o nível de um poder livre, oferece descontar pontos de poder (sem bloquear a edição)', () => {
    const f = embutida();
    f.pontosDePoderDisponiveis = 2;
    const raiz = montar(f);
    abrir(raiz, 'Poderes');
    const entrada = nivelDoPoder(raiz, 'Campeão do Combate Divino');
    expect(entrada.value).toBe('3');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    entrada.value = '4';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('change'));
    expect(confirmar).toHaveBeenCalledOnce();
    expect(salva().pontosDePoderDisponiveis).toBe(1);
    expect(salva().poderes.find((p) => p.id === 'campeao_do_combate_divino')?.nivel).toBe(4);

    // Recusar mantém o nível novo e os pontos.
    confirmar.mockReturnValueOnce(false);
    entrada.value = '5';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('change'));
    expect(salva().pontosDePoderDisponiveis).toBe(1);
    expect(salva().poderes.find((p) => p.id === 'campeao_do_combate_divino')?.nivel).toBe(5);

    // Ao diminuir o nível não pergunta.
    confirmar.mockClear();
    entrada.value = '3';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('change'));
    expect(confirmar).not.toHaveBeenCalled();
    expect(salva().pontosDePoderDisponiveis).toBe(1);
  });

  it('sem pontos de poder disponíveis, aumentar o nível de um poder não pergunta nada', () => {
    const raiz = montar(embutida());
    abrir(raiz, 'Poderes');
    const confirmar = vi.spyOn(window, 'confirm');
    const entrada = nivelDoPoder(raiz, 'Campeão do Combate Divino');
    entrada.value = '4';
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('change'));
    expect(confirmar).not.toHaveBeenCalled();
    expect(salva().poderes.find((p) => p.id === 'campeao_do_combate_divino')?.nivel).toBe(4);
  });

  it('a aba Batalha lembra que o PV se recupera por completo em 1 hora', () => {
    const raiz = montar(embutida());
    abrir(raiz, 'Batalha');
    expect(raiz.querySelector('.lembrete-pv')?.textContent).toBe('PV se recupera por completo em 1 hora.');
  });
});
