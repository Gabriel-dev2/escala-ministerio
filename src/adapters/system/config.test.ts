import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { carregarArquivoEnv, carregarConfiguracao, decodificarTexto, interpretarEnv } from './config';

let pasta: string;

before(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-config-'));
});

after(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

function escrever(nome: string, bytes: Buffer | string): string {
  const caminho = path.join(pasta, nome);
  fs.writeFileSync(caminho, bytes);
  return caminho;
}

test('lê o nome do grupo sem espaços nas pontas', () => {
  const configuracao = carregarConfiguracao({ GROUP_NAME: '  Ministério de Louvor ' });

  assert.equal(configuracao.nomeGrupo, 'Ministério de Louvor');
});

test('falha quando GROUP_NAME não foi definido', () => {
  assert.throws(() => carregarConfiguracao({}, path.join(pasta, 'inexistente', '.env')), /GROUP_NAME/);
});

test('falha quando GROUP_NAME está em branco', () => {
  assert.throws(() => carregarConfiguracao({ GROUP_NAME: '   ' }, path.join(pasta, 'inexistente', '.env')), /GROUP_NAME/);
});

test('interpreta chaves, comentários, aspas, "export" e quebras de linha do Windows', () => {
  const variaveis = interpretarEnv(
    ['# comentário', '', 'GROUP_NAME="Ministério de Louvor"', "OUTRA='x'", 'export TERCEIRA=y', 'SEM_IGUAL'].join('\r\n'),
  );

  assert.deepEqual(variaveis, { GROUP_NAME: 'Ministério de Louvor', OUTRA: 'x', TERCEIRA: 'y' });
});

test('mantém o "=" que faz parte do valor', () => {
  assert.deepEqual(interpretarEnv('GROUP_NAME=a=b'), { GROUP_NAME: 'a=b' });
});

test('decodifica UTF-8, UTF-8 com BOM, UTF-16 LE e UTF-16 BE', () => {
  const texto = 'GROUP_NAME=Ministério';
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(texto, 'utf16le')]);
  const utf16be = Buffer.from(utf16le.subarray(2));
  utf16be.swap16();

  assert.equal(decodificarTexto(Buffer.from(texto, 'utf8')), texto);
  assert.equal(decodificarTexto(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(texto)])), texto);
  assert.equal(decodificarTexto(utf16le), texto);
  assert.equal(decodificarTexto(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be])), texto);
});

test('carrega um .env criado pelo PowerShell (UTF-16)', () => {
  const caminho = escrever('utf16.env', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('GROUP_NAME=Louvor\r\n', 'utf16le')]));
  const ambiente: NodeJS.ProcessEnv = {};

  carregarArquivoEnv(caminho, ambiente);

  assert.equal(ambiente.GROUP_NAME, 'Louvor');
});

test('carrega um .env salvo com BOM e quebras de linha do Windows', () => {
  const caminho = escrever('bom.env', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('GROUP_NAME=Louvor\r\n')]));
  const ambiente: NodeJS.ProcessEnv = {};

  carregarArquivoEnv(caminho, ambiente);

  assert.equal(ambiente.GROUP_NAME, 'Louvor');
});

test('não sobrescreve variável que já veio do ambiente', () => {
  const caminho = escrever('ja-definida.env', 'GROUP_NAME=Do arquivo');
  const ambiente: NodeJS.ProcessEnv = { GROUP_NAME: 'Do ambiente' };

  carregarArquivoEnv(caminho, ambiente);

  assert.equal(ambiente.GROUP_NAME, 'Do ambiente');
});

test('sem arquivo .env, segue com o ambiente atual', () => {
  const ambiente: NodeJS.ProcessEnv = {};

  carregarArquivoEnv(path.join(pasta, 'nao-existe.env'), ambiente);

  assert.deepEqual(ambiente, {});
});

test('quando o arquivo existe sem GROUP_NAME, o erro diz isso', () => {
  const caminho = escrever('sem-grupo.env', 'OUTRA=1');

  assert.throws(() => carregarConfiguracao({}, caminho), /existe, mas não tem a linha GROUP_NAME/);
});

test('quando o arquivo está como ".env.txt", o erro sugere renomear', () => {
  const subpasta = fs.mkdtempSync(path.join(pasta, 'txt-'));
  fs.writeFileSync(path.join(subpasta, '.env.txt'), 'GROUP_NAME=Louvor');

  assert.throws(() => carregarConfiguracao({}, path.join(subpasta, '.env')), /".env.txt": renomeie para exatamente ".env"/);
});
