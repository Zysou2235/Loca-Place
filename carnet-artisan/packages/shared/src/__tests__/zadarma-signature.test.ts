import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chaineDeRequete,
  chaineSigneeWebhook,
  cleIdempotence,
  encoderRfc1738,
  enteteAuthorization,
  verifierSignatureWebhook,
} from '../zadarma-signature.js';

const SECRET = 'secret-de-test';

function signerWebhook(corps: Record<string, unknown>): string {
  return createHmac('sha1', SECRET).update(chaineSigneeWebhook(corps) ?? '').digest('base64');
}

describe('encodage RFC 1738', () => {
  it('encode l espace en + et les caracteres reserves de PHP', () => {
    expect(encoderRfc1738('a b')).toBe('a+b');
    expect(encoderRfc1738("o'brien")).toBe('o%27brien');
    expect(encoderRfc1738('a~b')).toBe('a%7Eb');
    expect(encoderRfc1738('+33612345678')).toBe('%2B33612345678');
  });
});

describe('chaineDeRequete', () => {
  it('trie les parametres par cle', () => {
    expect(chaineDeRequete({ zzz: 1, aaa: 2, mmm: 3 })).toBe('aaa=2&mmm=3&zzz=1');
  });

  it('ignore null et undefined sans les transformer en chaine vide', () => {
    expect(chaineDeRequete({ a: 1, b: null, c: undefined })).toBe('a=1');
  });

  it('gere un ensemble vide', () => {
    expect(chaineDeRequete({})).toBe('');
  });
});

describe('enteteAuthorization', () => {
  it('produit le format cle:signature avec un base64 du hexadecimal', () => {
    const entete = enteteAuthorization('/v1/info/balance/', {}, 'MA_CLE', SECRET);
    const [cle, signature] = entete.split(':');
    expect(cle).toBe('MA_CLE');
    // La signature officielle est base64(hex(hmac)) : 40 caracteres hex -> 56 en base64.
    const decode = Buffer.from(signature ?? '', 'base64').toString('utf8');
    expect(decode).toMatch(/^[0-9a-f]{40}$/);
  });

  it('reste stable pour les memes entrees', () => {
    const a = enteteAuthorization('/v1/pbx/record/request/', { call_id: 'abc' }, 'K', SECRET);
    const b = enteteAuthorization('/v1/pbx/record/request/', { call_id: 'abc' }, 'K', SECRET);
    expect(a).toBe(b);
  });

  it('change si un parametre change', () => {
    const a = enteteAuthorization('/v1/pbx/record/request/', { call_id: 'abc' }, 'K', SECRET);
    const b = enteteAuthorization('/v1/pbx/record/request/', { call_id: 'abd' }, 'K', SECRET);
    expect(a).not.toBe(b);
  });
});

describe('chaineSigneeWebhook', () => {
  it('utilise les champs documentes pour chaque evenement', () => {
    expect(
      chaineSigneeWebhook({
        event: 'NOTIFY_START',
        caller_id: '33612345678',
        called_did: '33299000000',
        call_start: '2026-03-18 10:00:00',
      }),
    ).toBe('3361234567833299000000' + '2026-03-18 10:00:00');

    expect(
      chaineSigneeWebhook({
        event: 'NOTIFY_RECORD',
        pbx_call_id: 'in_abc',
        call_id_with_rec: 'rec_123',
      }),
    ).toBe('in_abcrec_123');

    expect(
      chaineSigneeWebhook({
        event: 'NOTIFY_OUT_START',
        internal: '100',
        destination: '33612345678',
        call_start: '2026-03-18 10:00:00',
      }),
    ).toBe('10033612345678' + '2026-03-18 10:00:00');
  });

  it('retourne null pour un evenement inconnu', () => {
    expect(chaineSigneeWebhook({ event: 'AUTRE_CHOSE' })).toBeNull();
  });
});

describe('verifierSignatureWebhook', () => {
  const corps = {
    event: 'NOTIFY_END',
    caller_id: '33612345678',
    called_did: '33299000000',
    call_start: '2026-03-18 10:00:00',
    duration: '183',
    disposition: 'answered',
    is_recorded: '1',
    call_id_with_rec: 'rec_123',
    pbx_call_id: 'in_abc',
  };

  it('accepte une signature correcte', () => {
    const r = verifierSignatureWebhook(corps, signerWebhook(corps), SECRET);
    expect(r).toEqual({ valide: true, evenement: 'NOTIFY_END' });
  });

  it('REFUSE quand l en-tete Signature est absent (ferme par defaut)', () => {
    // La bibliotheque officielle accepterait : c est precisement ce qu on corrige.
    expect(verifierSignatureWebhook(corps, undefined, SECRET)).toMatchObject({ valide: false });
    expect(verifierSignatureWebhook(corps, '', SECRET)).toMatchObject({ valide: false });
    expect(verifierSignatureWebhook(corps, '   ', SECRET)).toMatchObject({ valide: false });
  });

  it('refuse une signature falsifiee', () => {
    expect(verifierSignatureWebhook(corps, 'bWF1dmFpc2U=', SECRET)).toMatchObject({
      valide: false,
      raison: 'Signature invalide.',
    });
  });

  it('refuse un evenement signe avec le secret d une autre entreprise', () => {
    const signatureAutreEntreprise = createHmac('sha1', 'secret-du-voisin')
      .update(chaineSigneeWebhook(corps) ?? '')
      .digest('base64');
    expect(verifierSignatureWebhook(corps, signatureAutreEntreprise, SECRET)).toMatchObject({
      valide: false,
    });
  });

  it('refuse si aucun secret n est configure', () => {
    expect(verifierSignatureWebhook(corps, 'peu-importe', '')).toMatchObject({ valide: false });
  });

  it('refuse un evenement dont le champ signe a ete modifie', () => {
    const signature = signerWebhook(corps);
    const falsifie = { ...corps, caller_id: '33699999999' };
    expect(verifierSignatureWebhook(falsifie, signature, SECRET)).toMatchObject({ valide: false });
  });

  it('refuse un type d evenement inconnu', () => {
    expect(verifierSignatureWebhook({ event: 'INCONNU' }, 'x', SECRET)).toMatchObject({
      valide: false,
    });
  });
});

describe('cleIdempotence', () => {
  it('produit la meme cle pour un evenement rejoue a l identique', () => {
    const corps = { event: 'NOTIFY_END', pbx_call_id: 'in_abc', call_start: '2026-03-18 10:00:00' };
    expect(cleIdempotence(corps)).toBe(cleIdempotence({ ...corps }));
  });

  it('distingue deux etapes du meme appel', () => {
    const base = { pbx_call_id: 'in_abc', call_start: '2026-03-18 10:00:00' };
    expect(cleIdempotence({ ...base, event: 'NOTIFY_START' })).not.toBe(
      cleIdempotence({ ...base, event: 'NOTIFY_END' }),
    );
  });

  it('distingue deux appels differents', () => {
    expect(
      cleIdempotence({ event: 'NOTIFY_END', pbx_call_id: 'in_a', call_start: 'x' }),
    ).not.toBe(cleIdempotence({ event: 'NOTIFY_END', pbx_call_id: 'in_b', call_start: 'x' }));
  });

  it('retourne null sans identifiant d appel exploitable', () => {
    expect(cleIdempotence({ event: 'NOTIFY_END' })).toBeNull();
    expect(cleIdempotence({ pbx_call_id: 'in_a' })).toBeNull();
  });
});
