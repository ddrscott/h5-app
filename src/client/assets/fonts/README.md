# Self-hosted font subsets

Bangers (display) and Barlow (body) come from `@fontsource/bangers` and `@fontsource/barlow`,
Latin subsets only, imported in `src/client/main.tsx`. The two files here are tiny CJK subsets so
a few glyphs render on devices without a CJK font. All are under the SIL Open Font License.

- `seal-*.woff2` hold three glyphs of Noto Serif SC Black (红, 心, 五), cut with
  `pyftsubset --text=…` from `@fontsource/noto-serif-sc`, at about 2 KB
  (`OFL-NotoSerifSC.txt`). The family is `H5 Seal`.
- `sfx-dela-gothic.woff2` holds the katakana the callout sound effects use (ドンゴバキッズーォガ)
  from Dela Gothic One, cut from `@fontsource/dela-gothic-one`'s chunk 119 with
  `uvx --from fonttools --with brotli pyftsubset … --text='ドンゴバキッズーォガ' --flavor=woff2`,
  at about 1.4 KB (`OFL-DelaGothicOne.txt`). The family is `H5 SFX`.

Both families are declared in `src/client/index.css`.
