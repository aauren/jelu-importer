module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          'node ./scripts/update-manifest-version.mjs ${nextRelease.version} && npm run package',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'package.json',
          'package-lock.json',
          'manifests/base.json',
        ],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'artifacts/firefox/*.zip',
            label: 'Firefox Unsigned Build',
          },
          {
            path: 'artifacts/chrome/*.zip',
            label: 'Chrome Build',
          },
        ],
      },
    ],
  ],
};
