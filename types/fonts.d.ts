// Metro turns a font file import into an asset id (components/ds/fontFiles.web.ts).
declare module '*.woff2' {
  const asset: number;
  export default asset;
}
