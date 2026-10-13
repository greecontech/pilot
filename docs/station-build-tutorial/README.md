# Station build tutorial (source)

`../station-build-tutorial.pdf` is the hands-on tutorial for the technician who builds the soil moisture station. It is the companion to `../pilot-setup-guide.pdf`, which is for the project manager.

- `guide.html` holds the text. It uses the layout, fonts and logo of `../pilot-setup-guide`.
- Rebuild with `node docs/build-pdf.mjs docs/station-build-tutorial` (setup in the header of `../build-pdf.mjs`).

The platform side of the tutorial was run end to end on 12 October 2026. The firmware compiles, but has not yet run on a real board; the tutorial says so, and section 9.2 (solar power) is a reference design that has not been built or tested.
