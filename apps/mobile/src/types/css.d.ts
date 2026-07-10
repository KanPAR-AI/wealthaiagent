// The SDK 57 default template ships web-target files that import CSS
// (animated-icon.web.tsx, global.css side-effect import) but no matching
// TypeScript declarations, so a bare `tsc --noEmit` fails out of the box.
// Metro handles the actual bundling; these declarations only satisfy tsc.

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
