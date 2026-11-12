import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** Vzorec vykreslený KaTeXem. Zdroj je vždy náš vlastní obsah nebo výstup calc. */
export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false, output: 'html', strict: 'ignore' }),
    [tex, block],
  );
  const Tag = block ? 'div' : 'span';
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />;
}
