// Adaptador para as funções de src/import (importarXlsx, exportarJson, importarJson).
import { migrarFicha } from '../engine';
import { exportarJson, importarJson, importarXlsx } from '../import';
import type { Ficha } from '../model/types';
import { verificarFicha } from './estado';

/** O importador devolve as fontes nomeadas da planilha; a migração as converte em parcelas derivadas dos poderes. */
export function lerXlsx(dados: ArrayBuffer): Ficha {
  return verificarFicha(migrarFicha(importarXlsx(dados)));
}

export function lerJson(texto: string): Ficha {
  return verificarFicha(importarJson(texto));
}

export function gerarJson(ficha: Ficha): string {
  return exportarJson(ficha);
}
