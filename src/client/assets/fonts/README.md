# Self-hosted font subsets

Bangers (display) and Barlow (body) come from `@fontsource/bangers` and `@fontsource/barlow`,
Latin subsets only, imported in `src/client/main.tsx`. The two files here are tiny CJK subsets so
a few glyphs render on devices without a CJK font. All are under the SIL Open Font License.

- `seal-*.woff2` hold three glyphs of Noto Serif SC Black (红, 心, 五), cut with
  `pyftsubset --text=…` from `@fontsource/noto-serif-sc`, at about 2 KB
  (`OFL-NotoSerifSC.txt`). The family is `H5 Seal`.
- `sfx-zcool.woff2` holds the Chinese comic sound effects the callouts use (唰 轰 隆 砰 ！) and the seat
  emotes (牛 绝了 溜了 我太难了, see `components/game/Emotes.tsx`) from ZCOOL QingKe HuangYou. The
  `@fontsource/zcool-qingke-huangyou` chunks holding them are decompressed, merged with
  `fonttools merge`, and cut with
  `uvx --from fonttools --with brotli pyftsubset merged.ttf --text='唰轰隆砰！牛绝了溜我太难' --flavor=woff2`,
  at about 4.7 KB (`OFL-ZCOOLQingKeHuangYou.txt`). The family is `H5 SFX`. Adding a glyph means
  re-cutting it and widening the `unicode-range` in `index.css`.

Both families are declared in `src/client/index.css`.
