# Pilot setup guide (source)

`../pilot-setup-guide.pdf` is the guide for the project manager. This folder is its source.

- `guide.html` holds the text and layout. Edit it, then rebuild with `node docs/build-pdf.mjs docs/pilot-setup-guide` (setup in the header of `../build-pdf.mjs`).
- `style.css` is the shared layout. The companion `../station-build-tutorial` uses it too.
- `img/` has screenshots of the platform taken on 12 October 2026 and a render of the alert email. The screenshots use **illustrative data**, not a real farm, and are labelled that way in the guide.
- `fonts/` has IBM Plex Serif (SIL Open Font License 1.1), the platform's own typeface, so the guide renders the same everywhere.

When prices or plans change, update the tables in `guide.html` (sections A.1 to A.4, A.6 and Appendix 7) and rebuild.
