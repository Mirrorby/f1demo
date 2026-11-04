import { normalizeLanguage, translate, english, type Language } from './language';
import { switchSettingsLanguage } from './templates';
import type { Settings, Product } from './types';

export function selectStoreLanguage(cfg: Settings, requested: string | null): Language {
  const primary = cfg.language || 'ru';
  return requested && (cfg.languages || [primary]).includes(requested as Language)
    ? normalizeLanguage(requested)
    : primary;
}
const reverseBuiltins = new Map<Language, Map<string, string>>();
function builtIn(value: string, from: Language, to: Language) {
  if (from === to) return value;
  let dictionary = reverseBuiltins.get(from);
  if (!dictionary) {
    dictionary = new Map(Object.keys(english).map((key) => [translate(key, from), key]));
    reverseBuiltins.set(from, dictionary);
  }
  const original = dictionary.get(value);
  return original ? translate(original, to) : value;
}
export function localizedSettings(cfg: Settings, language: Language): Settings {
  const translated = switchSettingsLanguage({ ...cfg, language, texts: { ...cfg.texts } }, cfg);
  const custom = cfg.translations?.[language] || {};
  return { ...translated, ...custom, language, texts: { ...translated.texts, ...custom.texts } };
}
export function localizedName(name: string, cfg: Settings, language: Language): string {
  return cfg.translations?.[language]?.name || name;
}
export function localizedProduct(p: Product, cfg: Settings, language: Language): Product {
  const copy = { ...p };
  for (const key of ['name', 'category', 'description', 'brand', 'collection', 'color'] as const)
    copy[key] = builtIn(p[key], cfg.language || 'ru', language);
  const custom = p.translations?.[language] || {};
  copy.variants = p.variants.map((v) => ({
    ...v,
    label: custom.variantLabels?.[v.id] || builtIn(v.label, cfg.language || 'ru', language),
  }));
  copy.attributes = p.attributes.map((a) => ({
    label: builtIn(a.label, cfg.language || 'ru', language),
    value: builtIn(a.value, cfg.language || 'ru', language),
  }));
  return {
    ...copy,
    ...Object.fromEntries(
      Object.entries(custom).filter(([key, v]) => key !== 'variantLabels' && v !== ''),
    ),
  };
}
