// Lines are stored bilingually as { cn, en }; either one may be empty.
const CHINESE = /[一-鿿]/;

// Typed into the composer as one string: Chinese goes to cn, anything else to en.
export function splitByLanguage(input) {
  return CHINESE.test(input) ? { cn: input, en: '' } : { cn: '', en: input };
}
