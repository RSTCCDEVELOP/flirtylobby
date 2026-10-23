// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Dummy text (lorem ipsum) for building pages: lorem(words) gives that many words as sentences; with paragraphs it is split in paragraphs of about 45 words.
const WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi "
  + "aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt "
  + "mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar sapien ligula vitae egestas turpis mauris vehicula felis eget tellus integer posuere erat fermentum").split(" ");

export function lorem(count, paragraphs = false) {
  const n = Math.min(Math.max(Math.round(Number(count) || 0), 1), 2000);
  const words = [];
  for (let i = 0; i < n; i++) words.push(WORDS[i % WORDS.length]);
  // sentences of 6-14 words, the first one starts with "Lorem ipsum dolor sit amet"
  const sentences = [];
  let i = 0, k = 0;
  while (i < words.length) {
    const len = Math.min(6 + ((k * 5 + 3) % 9), words.length - i);
    const s = words.slice(i, i + len);
    sentences.push(s[0][0].toUpperCase() + s.join(" ").slice(1) + ".");
    i += len; k++;
  }
  if (!paragraphs) return sentences.join(" ");
  const out = [];
  let cur = [], cnt = 0;
  for (const s of sentences) {
    cur.push(s); cnt += s.split(" ").length;
    if (cnt >= 45) { out.push(cur.join(" ")); cur = []; cnt = 0; }
  }
  if (cur.length) out.push(cur.join(" "));
  return out.join("\n\n");
}
