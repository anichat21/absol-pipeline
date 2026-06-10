/* docs.js — shared script for project doc pages.
   Served at /docs/_assets/js/docs.js
   Loaded with: <script type="module" src="/docs/_assets/js/docs.js"></script>
   Handles:
   - Mermaid bootstrap (any <pre class="mermaid">…</pre>)
   - Hover anchor links on h2/h3 with ids (or inside <section id="…">)
   - Back-link + footer injection from the docs registry */

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

/* Back-link + footer injection
   Every doc page at /docs/<slug>/<page> gets:
   - top-left back-link: index pages → docs hub; non-index pages → project index
   - bottom footer: <Name> · project ↗ · (index if not on index) · all docs · dashboard
   Pulls display name + projectUrl from the docs registry. */
(async () => {
  const m = location.pathname.match(/^\/docs\/([^/]+)\/(.*)$/);
  if (!m) return; // not a /docs/<slug>/... page
  const slug = m[1];
  const page = m[2] || "index.html";
  const isIndex = page === "" || page === "index.html";

  let entry = null;
  try {
    const res = await fetch("/docs/_assets/docs-registry.json", { cache: "no-cache" });
    if (res.ok) {
      const reg = await res.json();
      entry = (reg.projects || []).find(p => p.slug === slug) || null;
    }
  } catch (_) { /* swallow — fall back to slug-derived labels */ }

  const name = (entry && entry.name) || slug;
  const projectUrl = entry && entry.projectUrl;

  // Top-left back-link
  const back = document.querySelector(".doc .back-link");
  if (back) {
    if (isIndex) {
      back.textContent = "← All docs";
      back.href = "/docs/";
    } else {
      back.textContent = `← ${name}`;
      back.href = `/docs/${slug}/`;
    }
  }

  // Footer — find existing .doc-footer or create one before </article>
  let footer = document.querySelector(".doc .doc-footer");
  if (!footer) {
    const article = document.querySelector("article.doc") || document.querySelector(".doc");
    if (article) {
      footer = document.createElement("footer");
      footer.className = "doc-footer";
      article.appendChild(footer);
    }
  }
  if (footer) {
    const parts = [];
    parts.push(`<strong>${escapeHtml(name)}</strong>`);
    if (projectUrl) parts.push(`<a href="${encodeURI(projectUrl)}" target="_blank" rel="noopener">project ↗</a>`);
    if (!isIndex) parts.push(`<a href="/docs/${encodeURIComponent(slug)}/">index</a>`);
    parts.push(`<a href="/docs/">all docs</a>`);
    parts.push(`<a href="/">dashboard</a>`);
    footer.innerHTML = `<p>${parts.join(" · ")}</p>`;
  }
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
