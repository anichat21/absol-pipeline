/* docs.js — shared script for project doc pages.
   Served at /docs/_assets/js/docs.js
   Loaded with: <script type="module" src="/docs/_assets/js/docs.js"></script>
   Handles:
   - Mermaid bootstrap (any <pre class="mermaid">…</pre>)
   - Hover anchor links on h2/h3 with ids (or inside <section id="…">) */

import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";

const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

mermaid.initialize({
  startOnLoad: true,
  theme: "base",
  themeVariables: {
    primaryColor: dark ? "#1a1a1a" : "#f3f3f3",
    primaryTextColor: dark ? "#d9c3ab" : "#1c1b17",
    primaryBorderColor: dark ? "#EB4604" : "#E85002",
    lineColor: dark ? "#a7a7a7" : "#646464",
    secondaryColor: "#99A57D",
    secondaryBorderColor: "#99A57D",
    tertiaryColor: dark ? "#0e0e0e" : "#fafafa",
    fontFamily: "Inter, -apple-system, sans-serif"
  },
  securityLevel: "loose",
  fontFamily: "Inter, -apple-system, sans-serif"
});

document.querySelectorAll(".doc h2, .doc h3").forEach(h => {
  let id = h.id;
  if (!id) {
    const sect = h.closest("section[id]");
    if (sect) id = sect.id;
  }
  if (!id) return;
  const a = document.createElement("a");
  a.className = "anchor";
  a.href = "#" + id;
  a.setAttribute("aria-label", "Link to this section");
  a.textContent = "#";
  h.appendChild(a);
});
