import { easedOffset, swipeFires } from '../SwipeRow';

describe('row swipe feel', () => {
  test('a short drag fires at 46 points', () => {
    expect(swipeFires(46, 0.05)).toBe(true);
    expect(swipeFires(-60, 0)).toBe(true);
    expect(swipeFires(40, 0.05)).toBe(false);
  });

  test('a quick flick fires from about half the distance, in the same direction only', () => {
    expect(swipeFires(30, 0.5)).toBe(true);
    expect(swipeFires(-30, -0.5)).toBe(true);
    expect(swipeFires(30, -0.5)).toBe(false);
    expect(swipeFires(20, 0.9)).toBe(false);
    expect(swipeFires(30, 0.1)).toBe(false);
  });

  test('the row follows the finger one to one up to the threshold, then gets heavier', () => {
    expect(easedOffset(30)).toBe(30);
    expect(easedOffset(-46)).toBe(-46);
    expect(easedOffset(146)).toBeCloseTo(46 + 100 * 0.34);
    expect(easedOffset(-146)).toBeCloseTo(-(46 + 100 * 0.34));
  });
});
