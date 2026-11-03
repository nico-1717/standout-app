import { learntUuid, perUserUuid, studyRecordUuid } from '../uuid5';

// I valori attesi sono quelli calcolati dal server (lib/sync_manifest.php: sync_uuid_imparata, sync_uuid_record, sync_uuid_per_utente).
describe('uuid calcolati come sul server', () => {
  const target = '0192f3a0-0000-7000-8000-000000000001';
  it('carta imparata: utente + carta + flag figlia', () => {
    expect(learntUuid(2, target, false)).toBe('f9510f91-5e13-5065-8dc6-7242ad2a122e');
    expect(learntUuid(2, target, true)).toBe('8a46035a-1567-532b-9725-971c867de827');
    expect(learntUuid('2', target, false)).toBe(learntUuid(2, target, false));
  });
  it('record di studio: utente + tipo', () => {
    expect(studyRecordUuid(2, 'combo')).toBe('586b9970-53a7-5e11-8d2e-1fab9a8076e9');
  });
  it('impostazioni e obiettivo: una riga per utente', () => {
    expect(perUserUuid('fc_settings', 2)).toBe('711f7935-39a5-5518-abc7-8b3c84ff9fa2');
    expect(perUserUuid('fc_goals', 2)).toBe('9e913116-07c8-5183-b0e5-5066673aa2eb');
  });
});
