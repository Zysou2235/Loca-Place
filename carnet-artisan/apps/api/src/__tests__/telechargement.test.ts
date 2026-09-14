/**
 * Protection du telechargement des enregistrements (SSRF).
 *
 * L'URL vient d'un service externe : on ne lui fait confiance sur rien.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  domaineAutorise,
  estAdresseInterne,
  telechargerAudio,
  urlPourJournal,
  verifierUrl,
  ErreurTelechargement,
} from '../securite/telechargement-audio.js';

const AUTORISES = ['zadarma.com', 'api.zadarma.com'];

const optionsBase = {
  domainesAutorises: AUTORISES,
  tailleMaxOctets: 1024,
  timeoutMs: 1000,
  resolveur: () => Promise.resolve(['93.184.216.34']),
};

function reponseAudio(corps: Buffer, entetes: Record<string, string> = {}): Response {
  return new Response(corps, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', ...entetes },
  });
}

describe('verifierUrl', () => {
  it('accepte un domaine autorise en HTTPS', () => {
    expect(verifierUrl('https://api.zadarma.com/rec/1.mp3', AUTORISES)).toMatchObject({ ok: true });
  });

  it('accepte un sous-domaine d un domaine autorise', () => {
    expect(verifierUrl('https://cdn.zadarma.com/rec/1.mp3', AUTORISES)).toMatchObject({ ok: true });
  });

  it('refuse un domaine qui se contente de finir pareil', () => {
    // "evilzadarma.com" ne doit pas passer pour un sous-domaine de zadarma.com.
    expect(verifierUrl('https://evilzadarma.com/rec.mp3', AUTORISES)).toMatchObject({ ok: false });
  });

  it('refuse HTTP en clair', () => {
    expect(verifierUrl('http://api.zadarma.com/rec.mp3', AUTORISES)).toMatchObject({ ok: false });
  });

  it('refuse les autres schemas', () => {
    for (const url of ['file:///etc/passwd', 'gopher://zadarma.com/', 'ftp://zadarma.com/x']) {
      expect(verifierUrl(url, AUTORISES)).toMatchObject({ ok: false });
    }
  });

  it('refuse les identifiants dans l URL', () => {
    expect(verifierUrl('https://user:mdp@api.zadarma.com/rec.mp3', AUTORISES)).toMatchObject({
      ok: false,
    });
  });

  it('refuse un domaine non autorise', () => {
    expect(verifierUrl('https://exemple.test/rec.mp3', AUTORISES)).toMatchObject({ ok: false });
  });
});

describe('domaineAutorise', () => {
  it('ignore la casse et le point final', () => {
    expect(domaineAutorise('API.Zadarma.com.', AUTORISES)).toBe(true);
  });
  it('refuse une liste vide', () => {
    expect(domaineAutorise('api.zadarma.com', [])).toBe(false);
  });
});

describe('estAdresseInterne', () => {
  it('repere les plages privees et locales', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // metadonnees cloud
      '0.0.0.0',
      '100.64.0.1', // CGNAT
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(estAdresseInterne(ip), ip).toBe(true);
    }
  });

  it('laisse passer une adresse publique', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '2001:4860:4860::8888']) {
      expect(estAdresseInterne(ip), ip).toBe(false);
    }
  });

  it('refuse 172.32.x.x hors de la plage privee', () => {
    expect(estAdresseInterne('172.32.0.1')).toBe(false);
  });
});

describe('telechargerAudio', () => {
  it('telecharge un fichier conforme', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(reponseAudio(Buffer.from('audio'))));
    const resultat = await telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
      ...optionsBase,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(resultat.typeMime).toBe('audio/mpeg');
    expect(resultat.contenu.toString()).toBe('audio');
  });

  it('refuse un domaine autorise qui resout vers une adresse interne', async () => {
    // Le cas "DNS rebinding" : le domaine est dans la liste blanche, mais il
    // pointe vers le reseau interne.
    const fetchImpl = vi.fn(() => Promise.resolve(reponseAudio(Buffer.from('audio'))));
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        resolveur: () => Promise.resolve(['169.254.169.254']),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/adresse interne/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('revalide la cible d une redirection', async () => {
    const fetchImpl = vi.fn((url: URL) => {
      if (url.hostname === 'api.zadarma.com') {
        return Promise.resolve(
          new Response(null, { status: 302, headers: { location: 'https://exfiltration.test/x' } }),
        );
      }
      return Promise.resolve(reponseAudio(Buffer.from('secret')));
    });
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Domaine non autorise/);
  });

  it('limite le nombre de redirections', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: 'https://api.zadarma.com/boucle' } }),
      ),
    );
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        maxRedirections: 2,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Trop de redirections/);
  });

  it('refuse un type de contenu qui n est pas de l audio', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      ),
    );
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Type de contenu refuse/);
  });

  it('refuse un fichier annonce trop gros', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(reponseAudio(Buffer.from('x'), { 'content-length': '999999' })),
    );
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/au-dela de la limite/);
  });

  it('coupe un fichier qui depasse la limite en cours de lecture', async () => {
    // content-length peut mentir : seuls les octets recus font foi.
    const fetchImpl = vi.fn(() =>
      Promise.resolve(reponseAudio(Buffer.alloc(5000, 1), { 'content-length': '10' })),
    );
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(ErreurTelechargement);
  });

  it('remonte une reponse en erreur du fournisseur', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('non', { status: 404 })));
    await expect(
      telechargerAudio('https://api.zadarma.com/rec/1.mp3', {
        ...optionsBase,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/404/);
  });
});

describe('urlPourJournal', () => {
  it('retire la chaine de requete, qui porte souvent un jeton', () => {
    expect(urlPourJournal('https://api.zadarma.com/rec/1.mp3?token=SECRET&x=1')).toBe(
      'https://api.zadarma.com/rec/1.mp3',
    );
  });

  it('ne plante pas sur une URL illisible', () => {
    expect(urlPourJournal('pas une url')).toBe('[url illisible]');
  });
});
