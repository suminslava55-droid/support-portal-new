const RU_TO_EN = {
  'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
  'х':'[','ъ':']','ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k',
  'д':'l','ж':';','э':"'",'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m',
  'б':',','ю':'.','Й':'Q','Ц':'W','У':'E','К':'R','Е':'T','Н':'Y','Г':'U',
  'Ш':'I','Щ':'O','З':'P','Х':'{','Ъ':'}','Ф':'A','Ы':'S','В':'D','А':'F','П':'G',
  'Р':'H','О':'J','Л':'K','Д':'L','Ж':':','Э':'"','Я':'Z','Ч':'X','С':'C','М':'V',
  'И':'B','Т':'N','Ь':'M','Б':'<','Ю':'>'
};

const EN_TO_RU = Object.fromEntries(Object.entries(RU_TO_EN).map(([k, v]) => [v, k]));

function isLatinLayout(str) {
  let latin = 0, cyrillic = 0;
  for (const ch of str) {
    if (EN_TO_RU[ch]) latin++;
    else if (/[а-яёА-ЯЁ]/.test(ch)) cyrillic++;
  }
  // Строка считается латинской раскладкой если латинских больше чем кириллических
  return latin > cyrillic && latin > str.length * 0.4;
}

export function convertLayout(str) {
  if (!str) return str;
  if (isLatinLayout(str)) {
    return str.split('').map(ch => EN_TO_RU[ch] || ch).join('');
  }
  return str;
}

export function getSearchVariants(str) {
  if (!str) return [str];
  const converted = convertLayout(str);
  return converted !== str ? [str, converted] : [str];
}
