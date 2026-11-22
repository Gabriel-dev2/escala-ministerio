import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioDeNomes } from './contactNames';

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
