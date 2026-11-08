import {
  learntUuid,
  perUserUuid,
  planDayUuid,
  planGoalUuid,
  planPaintUuid,
  studyRecordUuid,
  vocabRecordUuid,
} from '../uuid5';

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
  it('record di un corso di lingua: utente + corso + tipo', () => {
    expect(vocabRecordUuid(2, '0192f3a0-0000-7000-8000-000000000002', 'streak')).toBe(
      '6f05f8c6-3524-5479-81ee-4a6f93d944db',
    );
  });
  it('impostazioni e obiettivo: una riga per utente', () => {
    expect(perUserUuid('fc_settings', 2)).toBe('711f7935-39a5-5518-abc7-8b3c84ff9fa2');
    expect(perUserUuid('fc_goals', 2)).toBe('9e913116-07c8-5183-b0e5-5066673aa2eb');
  });
  it('il piano dei progetti: obiettivo, giorno evidenziato, blocco, il tuo tempo', () => {
    const p = '11111111-1111-4111-8111-111111111111';
    expect(planGoalUuid(p)).toBe('cffa9adb-5643-5663-a254-422828f9babe');
    expect(planPaintUuid(p, '2030-03-03')).toBe('2bb5aef3-43c3-5b7e-8cff-9631310a644b');
    expect(planDayUuid(p, '2030-03-03', 'study')).toBe('83ad9cbd-cdbc-5318-a9f6-94d02d9efcc5');
    expect(perUserUuid('plan_settings', 7)).toBe('9f87d4e0-bdd5-54db-ae1d-bce998d0ea07');
  });
});
