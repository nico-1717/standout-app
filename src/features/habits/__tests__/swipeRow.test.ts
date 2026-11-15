import { isRowSwipe, swipeFires } from '../SwipeRow';

describe('row swipe feel', () => {
  test('a mostly sideways move is a row swipe, even a slightly slanted one', () => {
    expect(isRowSwipe(12, 3)).toBe(true);
    expect(isRowSwipe(14, 12)).toBe(true); // before: needed 1.5x, a natural thumb swipe was missed
    expect(isRowSwipe(-9, 2)).toBe(true);
  });

  test('a vertical move or a tiny one is the page scrolling, not the row', () => {
    expect(isRowSwipe(5, 0)).toBe(false);
    expect(isRowSwipe(10, 30)).toBe(false);
    expect(isRowSwipe(0, 40)).toBe(false);
  });

  test('a short drag fires at 52 points', () => {
    expect(swipeFires(52, 0.05)).toBe(true);
    expect(swipeFires(-60, 0)).toBe(true);
    expect(swipeFires(40, 0.05)).toBe(false);
  });

  test('a quick flick fires from half the distance, in the same direction only', () => {
    expect(swipeFires(30, 0.5)).toBe(true);
    expect(swipeFires(-30, -0.5)).toBe(true);
    expect(swipeFires(30, -0.5)).toBe(false);
    expect(swipeFires(20, 0.9)).toBe(false);
    expect(swipeFires(30, 0.1)).toBe(false);
  });
});
