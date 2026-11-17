import appJson from '../../../app.json';

describe('app.json', () => {
  test('the React Compiler stays off (it freezes the screens that refresh with `version`)', () => {
    // Con il compilatore acceso (come in produzione) `useMemo(() => { void version; return repo.list(); }, [services, version])`
    // diventa «ricalcola solo se cambia repo»: dopo Avvia/Pausa del Pomodoro la pagina restava ferma. I test girano
    // senza compilatore, quindi in produzione deve essere spento per comportarsi come i test.
    expect(appJson.expo.experiments.reactCompiler).toBe(false);
  });
});
