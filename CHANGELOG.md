## [1.7.1](https://github.com/aauren/jelu-importer/compare/v1.7.0...v1.7.1) (2026-01-01)


### Bug Fixes

* use semantic-release action for proper GitHub Actions outputs ([719e851](https://github.com/aauren/jelu-importer/commit/719e85185044c4c54decf6fe04f77ccac00aa069))

# [1.7.0](https://github.com/aauren/jelu-importer/compare/v1.6.0...v1.7.0) (2026-01-01)


### Bug Fixes

* typecheck errors ([0c33ee5](https://github.com/aauren/jelu-importer/commit/0c33ee591c5c1b5d53d3ed8352612633cd088ad5))


### Features

* update release flows for GitHub Actions ([cfa0c64](https://github.com/aauren/jelu-importer/commit/cfa0c648eea86d75a198e0433fb6813d717669b2))

# [1.6.0](https://github.com/aauren/jelu-importer/compare/v1.5.4...v1.6.0) (2026-01-01)


### Bug Fixes

* **base.json:** match www subdomain variants and non-www subdomain variants ([81d72a2](https://github.com/aauren/jelu-importer/commit/81d72a281ca840ec3f4f61a43ddd76c79d55f5df))
* **base.json:** remove tabs permission as its not needed to read current tab ([20a7297](https://github.com/aauren/jelu-importer/commit/20a7297a06f0a4c1a36376417542d4b5fd3df382))


### Features

* add autocomplete for some fields when user types ([473afcf](https://github.com/aauren/jelu-importer/commit/473afcffcf43a891eeacecabc41fa874a3011628))
* **options:** add test connection button ([5e00373](https://github.com/aauren/jelu-importer/commit/5e0037316e365e765cac7094459c10087d01451d))
* use consistent date picker across all date fields ([cbb3139](https://github.com/aauren/jelu-importer/commit/cbb31399900fc464331c0a823dc9532f24203403))

## [1.5.4](https://github.com/aauren/jelu-importer/compare/v1.5.3...v1.5.4) (2025-12-12)


### Bug Fixes

* remove AI dreamed license parameter to web-ext sign ([1945373](https://github.com/aauren/jelu-importer/commit/1945373637603b6c09d18d43cb9a2ea3679c5299))
* return firefox specific manifest settings ([00ca070](https://github.com/aauren/jelu-importer/commit/00ca070a1e4c00887ba2deebbf4b21206ebdf919))

## [1.5.3](https://github.com/aauren/jelu-importer/compare/v1.5.2...v1.5.3) (2025-12-12)


### Bug Fixes

* include apache license in signing request ([e1fd610](https://github.com/aauren/jelu-importer/commit/e1fd61041b05e93f7cd6ba2e16c2258671287219))

## [1.5.2](https://github.com/aauren/jelu-importer/compare/v1.5.1...v1.5.2) (2025-12-12)


### Bug Fixes

* continue trying to fix automated build ([c3a18cb](https://github.com/aauren/jelu-importer/commit/c3a18cb3f63ab4745be6f801784e7d41caa7f2ec))

## [1.5.1](https://github.com/aauren/jelu-importer/compare/v1.5.0...v1.5.1) (2025-12-12)


### Bug Fixes

* force rebuild for packaging ([75eb143](https://github.com/aauren/jelu-importer/commit/75eb143d138a6a506a8e9f4ee4393ec4d6b61d9b))
* force rebuild for packaging ([6fd89f0](https://github.com/aauren/jelu-importer/commit/6fd89f0334dfb4819d54ebdabfe94328f7bb9e1d))

# [1.5.0](https://github.com/aauren/jelu-importer/compare/v1.4.0...v1.5.0) (2025-12-12)


### Bug Fixes

* **package:** fix build problems introduced with chrome ([c49e373](https://github.com/aauren/jelu-importer/commit/c49e3730a18eae9a307f0b0fccbb197b7b5462bf))


### Features

* add chrome support ([c0e8063](https://github.com/aauren/jelu-importer/commit/c0e8063b387126349420b6ebf682c2709148d97a))

# [1.4.0](https://github.com/aauren/jelu-importer/compare/v1.3.0...v1.4.0) (2025-12-12)


### Features

* **release.yml:** attempt again to attach xpi to GitHub release ([d1aa566](https://github.com/aauren/jelu-importer/commit/d1aa56658d160b3002df2cd6a4428f7b4d88e512))

# [1.3.0](https://github.com/aauren/jelu-importer/compare/v1.2.0...v1.3.0) (2025-12-12)


### Features

* **release.config.cjs:** add the signed XPI to the GitHub Release ([2de2639](https://github.com/aauren/jelu-importer/commit/2de2639600ae06bd99f88b0479a209d326e3d8e2))

# [1.2.0](https://github.com/aauren/jelu-importer/compare/v1.1.0...v1.2.0) (2025-12-12)


### Features

* **release.yml:** add Mozilla add-on signing ([ffcd90e](https://github.com/aauren/jelu-importer/commit/ffcd90e4de14bab12e787c4ef50b6f55c3a2efa3))

# [1.1.0](https://github.com/aauren/jelu-importer/compare/v1.0.0...v1.1.0) (2025-12-07)


### Bug Fixes

* **index.ts:** remove unsafe HTML assignments ([65f47dd](https://github.com/aauren/jelu-importer/commit/65f47dd6d1db42d599292c444881f2313092898e))


### Features

* **manifest.json:** add an ID to the manifest ([37100b1](https://github.com/aauren/jelu-importer/commit/37100b1de3e6660c5d50cdb185b109d144d4875c))
* prepping for first release ([21894d1](https://github.com/aauren/jelu-importer/commit/21894d139de8119f96b2f83c18056ee1895d8f3b))

# 1.0.0 (2025-12-07)


### Features

* add consistent logging across all parsers ([43393b0](https://github.com/aauren/jelu-importer/commit/43393b0d5c81b4b4a5c05affc53e95891333bfef))
* add debug logging to Google & API fetch fallback ([ed48a43](https://github.com/aauren/jelu-importer/commit/ed48a4343bc6d4af95c83c6743eb25ccfeae7746))
* add icon for jelu-importer ([2d5112c](https://github.com/aauren/jelu-importer/commit/2d5112c07db09088f47e584e1973eb253ba6157c))
* add more items to gitignore ([38b805f](https://github.com/aauren/jelu-importer/commit/38b805fad653188fa866507af01640d25c8f2c8b))
* add release and PR automation ([3531703](https://github.com/aauren/jelu-importer/commit/3531703e6a08d8aecd8c34355ce7f5983845c473))
* **amazon:** fix amazon parser so that it actually works ([cf40110](https://github.com/aauren/jelu-importer/commit/cf40110dd5c4c064d983c768b700e553068fad09))
* bump to node v22 ([965cfa7](https://github.com/aauren/jelu-importer/commit/965cfa7a7188abe78cd74ac4d6ac00b7cef233bb))
* clean up README.md a bit and add markdownlint rules ([a386b04](https://github.com/aauren/jelu-importer/commit/a386b046e8271a67316cc8cdb8cf999d6b4369d6))
* **google:** improve google books parsing ([38b966b](https://github.com/aauren/jelu-importer/commit/38b966b8c7951723b71c4b3de581939c620406e9))
* improve audible parser to work better ([f77dc15](https://github.com/aauren/jelu-importer/commit/f77dc152842c4daca18d3e018bc230a4c9edd0b4))
* indicate status during import and add finished selector ([47d7ec1](https://github.com/aauren/jelu-importer/commit/47d7ec1f29cee1ce8df3d6c54c77cedd57a7968a))
* initial commit with basic functionality for goodreads ([116f470](https://github.com/aauren/jelu-importer/commit/116f470334e09415a72ce5f54b16fa51635c5b6e))
* license under Apache 2.0 ([edd7635](https://github.com/aauren/jelu-importer/commit/edd7635e1cc89f77f933c3a342bff20a0e966684))
* preview image during book import ([99fe4ac](https://github.com/aauren/jelu-importer/commit/99fe4ac98d1859e946dd76de19b91c277d18a05d))
* remove API token logic as it doesn't seem to work correctly ([2950709](https://github.com/aauren/jelu-importer/commit/29507093b4127f8ed2d73503db5614e90ee40ede))

## Changelog

Semantic-release maintains this file automatically. Do not edit entries manually; instead, use Conventional Commits so
new releases can be generated with accurate notes.
