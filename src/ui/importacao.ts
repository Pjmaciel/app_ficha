// Adaptador para as funções de src/import (importarXlsx, exportarJson, importarJson).
import { exportarJson, importarJson, importarXlsx } from '../import';
import type { Ficha } from '../model/types';
import { verificarFicha } from './estado';

export function lerXlsx(dados: ArrayBuffer): Ficha {
  return verificarFicha(importarXlsx(dados));
}

export function lerJson(texto: string): Ficha {
  return verificarFicha(importarJson(texto));
}

export function gerarJson(ficha: Ficha): string {
  return exportarJson(ficha);
}
