import type { Settings, Background } from './types';

// A reference contributes colours only. Never execute its CSS, scripts or reuse its media/copy.
export function referenceDesign(analysis: unknown): Partial<Settings> {
  if (!analysis || typeof analysis !== 'object') return {};
  const colors = (analysis as { colors?: unknown }).colors;
  if (!Array.isArray(colors)) return {};
  const palette = [...new Set(colors.filter((c): c is string => typeof c === 'string')
    .map(c => /^#[a-f0-9]{3}$/i.test(c) ? '#' + [...c.slice(1)].map(x => x+x).join('') : c)
    .filter(c => /^#[a-f0-9]{6}$/i.test(c)).map(c => c.toLowerCase()))];
  const rgb = (c:string) => [1,3,5].map(i => parseInt(c.slice(i,i+2),16));
  const brightness = (c:string) => rgb(c).reduce((n,x,i) => n+x*[0.299,0.587,0.114][i],0);
  const accent = palette.find(c => Math.max(...rgb(c))-Math.min(...rgb(c))>35 && brightness(c)>35 && brightness(c)<200);
  const page = palette.find(c => brightness(c)>225);
  const background = (color:string):Background => ({mode:'color',color,image:'',tone:'auto',overlay:0});
  return {
    ...(accent ? {accentColor:accent} : {}),
    ...(page ? {backgrounds:{page:background(page),hero:background(page),information:background(page)}} : {}),
  };
}
