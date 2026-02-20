const STUB_URL = 'data:text/javascript,export default {};export const Challenge=class{};export const Credential=class{};export const Receipt=class{};export const tempo=()=>({});';

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier === 'mpay' || specifier === 'mpay/server') return { url: STUB_URL, shortCircuit: true };
  return nextResolve(specifier, context);
}
