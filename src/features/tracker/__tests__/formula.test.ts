import {
  CYCLE,
  DIV0,
  ERR,
  cellKey,
  colIndex,
  colName,
  columnSum,
  evaluate,
  show,
} from '../formula';

describe('colonne', () => {
  it('A..Z, AA', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colIndex('AA')).toBe(26);
    expect(cellKey(1, 2)).toBe('B3');
  });
});

describe('formule', () => {
  it('numeri, virgola decimale, testo', () => {
    const v = evaluate({ A1: '12', A2: '3,5', A3: 'ciao', A4: '' });
    expect(v.A1).toBe(12);
    expect(v.A2).toBe(3.5);
    expect(v.A3).toBe('ciao');
  });
  it('operazioni con la precedenza giusta e le parentesi', () => {
    const v = evaluate({ A1: '=2+3*4', B1: '=(2+3)*4', C1: '=-A1+1', D1: '=10/4' });
    expect(v.A1).toBe(14);
    expect(v.B1).toBe(20);
    expect(v.C1).toBe(-13);
    expect(v.D1).toBe(2.5);
  });
  it('SUM, AVG, MIN, MAX, COUNT su intervalli, saltando il testo', () => {
    const c = {
      A1: '4',
      A2: '6',
      A3: 'x',
      A4: '',
      B1: '=SUM(A1:A4)',
      B2: '=AVG(A1:A4)',
      B3: '=MIN(A1:A3)',
      B4: '=MAX(A1:A3)',
      B5: '=COUNT(A1:A4)',
    };
    const v = evaluate(c);
    expect([v.B1, v.B2, v.B3, v.B4, v.B5]).toEqual([10, 5, 4, 6, 2]);
  });
  it('più argomenti e riferimenti dentro le funzioni', () => {
    const v = evaluate({ A1: '2', A2: '3', B1: '=SUM(A1, A2, 10)', B2: '=SUM(A1:A2, B1)' });
    expect(v.B1).toBe(15);
    expect(v.B2).toBe(20);
  });
  it('un rettangolo', () => {
    const v = evaluate({ A1: '1', B1: '2', A2: '3', B2: '4', C1: '=SUM(A1:B2)' });
    expect(v.C1).toBe(10);
  });
  it('gli errori non fanno crollare: ERR, DIV0, CYCLE', () => {
    const v = evaluate({
      A1: '=1/0',
      A2: '=1+',
      A3: '=B3',
      B3: '=A3',
      A4: '=A1+1',
      A5: '=A6',
      A6: 'testo',
      A7: '=foo(1)',
      A8: '=1 $ 2',
    });
    expect(v.A1).toBe(DIV0);
    expect(v.A2).toBe(ERR);
    expect(v.A3).toBe(CYCLE);
    expect(v.A4).toBe(DIV0);
    expect(v.A5).toBe(ERR);
    expect(v.A7).toBe(ERR);
    expect(v.A8).toBe(ERR);
  });
  it('una cella vuota vale zero nelle operazioni', () => {
    expect(evaluate({ A1: '=Z9+5' }).A1).toBe(5);
  });
  it('mostra i numeri senza zeri inutili', () => {
    expect(show(2.5)).toBe('2.5');
    expect(show(0.1 + 0.2)).toBe('0.3');
    expect(show('x')).toBe('x');
  });
  it('somma di una colonna', () => {
    expect(columnSum(evaluate({ A1: '1', A2: '2', A3: 'x' }), 0, 3)).toBe(3);
  });
});
