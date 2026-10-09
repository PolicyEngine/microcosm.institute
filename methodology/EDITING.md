# Maintaining the public methodology

The public methodology explains how a dataset is built and how readers should
interpret it. Technical runbooks and implementation evidence remain in
[PolicyEngine/microcosm](https://github.com/PolicyEngine/microcosm).

## Review ownership

Before publication, maintainers should name an editorial owner and a UK data
maintainer responsible for checking technical claims. The initial UK page is a
draft pending those reviews.

Configure `.github/CODEOWNERS` for `/methodology/` with eligible human reviewers
who have write access. Enable required owner review on the publishing branch and
prevent automation from bypassing the review requirement. Protect the ownership
file and deployment configuration too. These are repository settings; contributor
instructions alone do not enforce review.

## Authoring

The canonical page source is `uk/index.html`. Its shared stylesheet is
`methodology.css`. The site remains static and deploys through the existing
Vercel configuration.

Keep the main page focused on the reviewed sequence: overview, sources,
geographic assignment, calibration, Enhanced FRS comparison, validation, and
versioned references. A material reorganisation needs editorial review.

For each substantive change:

1. Explain the method change and the dataset versions it affects in the PR.
2. Check the relevant code and source manifest; update pinned references.
3. Update the document version and history when the explanation changes.
4. Keep the prepared date distinct from the date of completed human review.
5. Review the rendered page on desktop and mobile, check its anchors and source
   links, and confirm its scope statement still matches the documented method.
6. Obtain editorial and technical approval before merging to the publishing branch.

Record an editorial review date only after review has occurred. Retain the Git
history and use tagged documentation versions or immutable commit links for
citations to earlier versions.

## Release evidence

The current page describes a pinned implementation and does not report performance
for a named dataset release. Before adding measured fit or validation figures,
identify the release, target scope, diagnostic artifact and measurement period.
Explain exclusions and differences in coverage beside the figures.

Check whether a dataset release changes the public methodology. Code refactors,
operational commands and build attempts normally belong in the technical docs;
changes to sources, assumptions, geography, calibration or interpretation may
require a public update.
