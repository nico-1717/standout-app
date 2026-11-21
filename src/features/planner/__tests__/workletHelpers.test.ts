import { readFileSync } from 'fs';
import { join } from 'path';

// The pinch runs on the UI thread, where a plain function (not marked 'worklet') cannot be called: it throws
// "Tried to synchronously call a Remote Function" and, before the Zoom alert existed, closed the app.
// Jest runs everything on one thread and cannot see this, so the helpers of the zoom files are checked by their source.
describe('zoom helpers called from the gesture are worklets', () => {
  for (const file of ['zoomEngine.ts', 'pinch.ts']) {
    test(file, () => {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      // top-level helpers: `const name = (...) => {` and `function name(...) {` outside the hook
      const helpers = [
        ...src.matchAll(
          /^(?:export )?(?:const (\w+) = \([^)]*\)\s*(?::\s*[\w<>[\] |]+)?\s*=>|function (\w+)[<(])/gm,
        ),
      ];
      expect(helpers.length).toBeGreaterThan(0);
      for (const m of helpers) {
        const start = m.index ?? 0;
        const body = src.slice(start, start + 400);
        const name = m[1] ?? m[2];
        // the hook itself (useZoomEngine) is a normal React function
        if (name === 'useZoomEngine') continue;
        expect({
          name,
          worklet: /'worklet'/.test(body.split('\n').slice(0, 4).join('\n')),
        }).toEqual({
          name,
          worklet: true,
        });
      }
    });
  }
});
