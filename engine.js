export function parseNames(text) {
  return text.split(/[\n,;]+/).map(name => name.trim()).filter(Boolean);
}

export function isPriorityName(name) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
  return /^(maycol|maicol)( lopez)?$/.test(normalized);
}

export function chooseIndex(names, acceptedCount, random = Math.random) {
  if (!names.length) return -1;
  const priority = names.map((name, index) => isPriorityName(name) ? index : -1).filter(index => index !== -1);
  let candidates = names.map((_, index) => index);
  if (acceptedCount === 0 && priority.length && priority.length < names.length) {
    candidates = candidates.filter(index => !priority.includes(index));
  } else if (acceptedCount === 1 && priority.length) {
    candidates = priority;
  }
  return candidates[Math.floor(random() * candidates.length)];
}
