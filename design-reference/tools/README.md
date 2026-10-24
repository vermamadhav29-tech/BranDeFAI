# Template generator

These scripts turned the saved Framer page sources in `../` into the React components in `frontend/src/components/draftr/`.
They were run from a scratch folder, so the `SP`/`FE` path constants at the top of `gen.js` and `post.js` need updating before reuse.

Order: `decode.js` -> `split.js` -> `build-home.js` / `build-page.js blog|contact` -> `post.js home blog contact`.
