// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// A strong password that is easy to type, in the format of Apple: three groups of six letters (consonant, vowel, consonant, consonant, vowel, consonant), one digit and one capital
// somewhere in it, for example tuntod-jeznyt-6kukmY. The same generator is in backend/apps/accounts/passgen.py: use one of them wherever a password is made.
const CONS = "bcdfghjkmnpqrstvwxz";
const VOWELS = "aeiouy";

function below(n) {  // a random number 0..n-1 without bias
  const a = new Uint32Array(1);
  const max = Math.floor(0x100000000 / n) * n;
  do { crypto.getRandomValues(a); } while (a[0] >= max);
  return a[0] % n;
}

export function generatePassword() {
  const chars = [];
  for (let g = 0; g < 3; g++) for (let p = 0; p < 6; p++) { const set = p === 1 || p === 4 ? VOWELS : CONS; chars.push(set[below(set.length)]); }
  const i = below(chars.length);
  let j = below(chars.length - 1); if (j >= i) j += 1;
  chars[i] = String(below(10));
  chars[j] = chars[j].toUpperCase();
  return [0, 1, 2].map((g) => chars.slice(g * 6, g * 6 + 6).join("")).join("-");
}
