/**
 * docs/49 ASTRAL-98 — the ceremonial token is REQUIRED, asserted at the type
 * level rather than by reading the interface.
 *
 * Why a compiler run and not `@ts-expect-error`: this suite is transpiled by
 * ts-jest with `isolatedModules: true`, which does no type-checking at all, so
 * a `@ts-expect-error` here would assert nothing whatsoever — the exact
 * "green proving nothing" shape the rest of this package's tests exist to
 * avoid. So the test compiles two real host files with the package's own
 * options: one that omits the token (must fail, on that property) and one that
 * supplies it (must compile clean).
 */

import { join } from 'path';
import ts from 'typescript';

const PKG = join(__dirname, '..', '..');

function diagnosticsFor(fixture: string): ts.Diagnostic[] {
  const file = join(PKG, 'type-fixtures', fixture);
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    // The package's deliberate rule: no DOM, no react-native types.
    lib: ['lib.es2022.d.ts'],
  });
  return [
    ...program.getSemanticDiagnostics(),
    ...program.getSyntacticDiagnostics(),
  ];
}

describe('AstralTheme requires a ceremonial accent', () => {
  it('a host that omits it does not compile', () => {
    const errors = diagnosticsFor('omits-ceremonial.ts');
    expect(errors.length).toBeGreaterThan(0);
    const text = errors
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
      .join('\n');
    expect(text).toContain('ceremonial');
    // TS2741 — "Property 'x' is missing in type ... but required in type ...".
    // Asserting the CODE stops an unrelated error (a bad import path, say)
    // from standing in for the one this test is about.
    expect(errors.map((d) => d.code)).toContain(2741);
  });

  it('the same host WITH it compiles clean', () => {
    const errors = diagnosticsFor('supplies-ceremonial.ts');
    expect(
      errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')),
    ).toEqual([]);
  });
});
