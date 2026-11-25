import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { criarDiretorioDeNomes } from './contactNames';

let pasta: string;

before(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'escala-contatos-'));
});

after(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('guarda o nome salvo e o nome de perfil do mesmo contato', () => {
  const diretorio = criarDiretorioDeNomes();

  diretorio.registrarContato({ id: 'ana@s.whatsapp.net', name: 'Ana Souza', notify: 'Aninha' });

  assert.deepEqual(diretorio.nomesDe(['ana@s.whatsapp.net']).sort(), ['Ana Souza', 'Aninha']);
});

test('associa o mesmo nome a todos os ids do contato', () => {
  const diretorio = criarDiretorioDeNomes();

  diretorio.registrarContato({ id: 'ana@s.whatsapp.net', lid: '123@lid', name: 'Ana' });

  assert.deepEqual(diretorio.nomesDe(['123@lid']), ['Ana']);
});

test('junta os nomes de ids diferentes sem repetir', () => {
  const diretorio = criarDiretorioDeNomes();
  diretorio.registrarContato({ id: 'a@s.whatsapp.net', name: 'Ana' });
  diretorio.registrarContato({ id: 'b@lid', name: 'Ana' });
  diretorio.registrarContato({ id: 'b@lid', notify: 'Aninha' });

  assert.deepEqual(diretorio.nomesDe(['a@s.whatsapp.net', 'b@lid']).sort(), ['Ana', 'Aninha']);
});

test('aprende o nome de perfil de quem escreveu no grupo', () => {
  const diretorio = criarDiretorioDeNomes();

  diretorio.registrarRemetente('joao@s.whatsapp.net', 'João');

  assert.deepEqual(diretorio.nomesDe(['joao@s.whatsapp.net']), ['João']);
});

test('ignora nomes vazios e ids ausentes', () => {
  const diretorio = criarDiretorioDeNomes();

  diretorio.registrarContato({ id: 'x@s.whatsapp.net', name: '   ', notify: null });
  diretorio.registrarRemetente(undefined, 'Fantasma');

  assert.deepEqual(diretorio.nomesDe(['x@s.whatsapp.net', undefined]), []);
});

test('persiste os contatos em arquivo e recarrega ao iniciar novamente', () => {
  const arquivo = path.join(pasta, 'contatos', 'nomes.json');
  const primeiro = criarDiretorioDeNomes(arquivo);

  primeiro.registrarContatos([
    { id: '5581999999999@s.whatsapp.net', lid: '123@lid', name: 'Gabriel Lucas' },
  ]);

  const segundo = criarDiretorioDeNomes(arquivo);
  assert.deepEqual(segundo.nomesDe(['123@lid']), ['Gabriel Lucas']);
  assert.deepEqual(segundo.nomesDe(['5581999999999@s.whatsapp.net']), ['Gabriel Lucas']);
});

test('ignora arquivo de contatos ilegível e recomeça do zero', () => {
  const arquivo = path.join(pasta, 'quebrado.json');
  fs.writeFileSync(arquivo, '{ não é json', 'utf8');

  const diretorio = criarDiretorioDeNomes(arquivo);

  assert.deepEqual(diretorio.nomesDe(['123@lid']), []);
});
