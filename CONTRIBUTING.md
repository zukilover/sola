# Contributing to Sola

We welcome contributions to the Sola specification and TypeScript runtime.

## Getting Started

1. Clone this repository
2. Install dependencies: `npm ci`
3. Build: `npm run build`
4. Run tests: `npm test`

`npm ci` runs `prepare`, which compiles `src/` to `dist/`.

## Development Process

1. Create a branch for your change
2. Make the change
3. Run `npm run typecheck` and `npm test`
4. Update documentation as needed
5. Add an entry under `## [Unreleased]` in [CHANGELOG.md](./CHANGELOG.md)
6. Open a pull request

## Spec vs runtime

Normative behavior lives in `spec/`. TypeScript in `src/` implements that behavior. If they disagree, the spec wins after the mismatch is fixed in the same change.

Use RFC 2119 language in spec documents: MUST, MUST NOT, SHOULD, MAY.

## Pull Request Guidelines

- One concern per pull request
- Include tests for new behavior
- Follow the existing code style
- Keep changes focused
- If you change a MUST/SHOULD rule, update the matching spec page
- Do not add a product registry (a specific SaaS API) to this repository. Registries are host implementations.
- Do not generate catalogs from OpenAPI or other backend specs in this repository. Adapters may draft a catalog; they must not become the server.

## Versioning

This package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

A merge to `main` publishes the next patch release. Put notes under `## [Unreleased]` in [CHANGELOG.md](./CHANGELOG.md). The release workflow moves those notes, bumps the patch version, tags `vX.Y.Z`, and opens the GitHub Release. That release publishes the package to npm.

## Catalog language

The 0.1 encoding is TypeScript (`CatalogTool`). Do not add a second encoding (YAML, custom IDL files) until 0.1 is complete and versioned.

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). Please review it before contributing.

## Reporting Issues

- Search existing issues before opening a new one
- Provide clear reproduction steps

## Security Issues

Please review our [Security Policy](SECURITY.md) for reporting vulnerabilities. Do not file a public issue for an unreleased vulnerability.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
