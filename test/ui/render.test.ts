// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fichaCompleta } from '../fixtures/ficha-completa';
import dados from '../../src/data/alexsander.json';
import type { Ficha } from '../../src/model/types';
import { CHAVE_FICHA, CHAVE_SESSAO } from '../../src/ui/estado';
import { iniciar } from '../../src/ui/app';

const ABAS = ['Batalha', 'Resumo de Combate', 'Identidade', 'Atributos', 'Perícias', 'Combate', 'Poderes', 'Tsu'];

/** Monta o app inteiro em um DOM com a ficha dada salva no armazenamento local e devolve a raiz. */
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

describe('renderização das abas em um DOM', () => {
  let erros: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { erros = vi.spyOn(console, 'error').mockImplementation(() => {}); });

  describe.each([
    ['ficha embutida (build da mesa)', () => structuredClone(dados) as unknown as Ficha],
    ['ficha completa (todos os poderes ativos)', () => fichaCompleta()],
  ])('%s', (_nome, criar) => {
    it('monta o app e todas as abas sem exceção nem erro no console', () => {
      const raiz = montar(criar());
      for (const aba of ABAS) {
        expect(() => abrir(raiz, aba)).not.toThrow();
        const conteudo = raiz.querySelector('main') as HTMLElement;
        expect(conteudo.textContent, `aba ${aba} vazia`).not.toBe('');
        expect(conteudo.textContent).not.toContain('Não foi possível exibir a aba');
      }
      expect(erros).not.toHaveBeenCalled();
    });

    it('a aba Batalha mostra o cabeçalho e o painel principal', () => {
      const raiz = montar(criar());
      expect(raiz.querySelector('h1')?.textContent).toBe('Alexsander Somar III');
      expect(raiz.querySelector('.aba-batalha')).not.toBeNull();
    });
  });

  it('a build da mesa mostra 3904, 5d×100 +868, "Defesa com Jikar" e "2 / 2 rodadas"', () => {
    const raiz = montar(structuredClone(dados) as unknown as Ficha);
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('3904');
    expect(texto).toContain('5d×100 +868');
    expect(texto).toContain('Defesa com Jikar');
    expect(texto).toContain('2 / 2 rodadas');
    expect(texto).toContain('Não reduz Tsu real no nível 2');
    expect(raiz.querySelector('.golpe')).toBeNull();
    expect(erros).not.toHaveBeenCalled();
  });

  it('a ficha completa (Golpe Devastador ativo) mostra o card do golpe sem quebrar', () => {
    const raiz = montar(fichaCompleta());
    expect(raiz.querySelector('.golpe')).not.toBeNull();
    expect(raiz.textContent).toContain('4904');
  });

  it('golpe com poder removido e outro golpe ativo: a Batalha busca o golpe por id, não por posição', () => {
    const f = structuredClone(dados) as unknown as Ficha;
    f.golpes.push({ id: 'golpe_extra', nome: 'Golpe extra', dadosAtaqueExtras: 1, dadosDanoExtras: 1, ativo: false });
    const raiz = montar(f);
    expect(raiz.textContent).toContain('Golpe extra');
    expect(erros).not.toHaveBeenCalled();
  });

  it('uma aba que falha ao montar mostra a mensagem no lugar dela e o app continua funcionando', () => {
    const raiz = montar(structuredClone(dados) as unknown as Ficha);
    abrir(raiz, 'Identidade');
    const falha = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(() => { throw new Error('falha simulada'); });
    expect(() => abrir(raiz, 'Batalha')).not.toThrow();
    falha.mockRestore();
    const conteudo = raiz.querySelector('main') as HTMLElement;
    expect(conteudo.textContent).toContain('Não foi possível exibir a aba Batalha');
    expect(conteudo.textContent).toContain('falha simulada');
    // O cabeçalho, as abas e o rodapé seguem no lugar, e as outras abas abrem normalmente.
    expect(raiz.querySelector('h1')?.textContent).toBe('Alexsander Somar III');
    expect(raiz.querySelectorAll('[role="tab"]')).toHaveLength(ABAS.length);
    abrir(raiz, 'Poderes');
    expect(raiz.querySelector('main')?.textContent).not.toContain('Não foi possível exibir');
    abrir(raiz, 'Batalha');
    expect(raiz.querySelector('.aba-batalha')).not.toBeNull();
  });
});
