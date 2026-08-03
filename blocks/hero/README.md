# Hero Block

## Overview

The Hero block renders a full-width promotional banner, typically used at the top of the homepage or landing pages. It is a pure content/CSS block (no JavaScript decoration): authors provide a background image and a heading/CTA, and the block lays them out with the image behind the text.

## Integration

<!-- ### Block Configuration

No block configuration is read via `readBlockConfig()`. The block is driven entirely by its authored content (image, heading, paragraphs, links) and CSS variants applied via extra classes (e.g. `hero yoga`). -->

<!-- ### URL Parameters

No URL parameters are used by this block. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

<!-- ### Events

No event listeners or emitters are used by this block. -->

## Behavior Patterns

### Page Context Detection

- **Default variant**: An authored `picture`/`img` is positioned behind the content as a full-bleed background, with the heading (`h1`) rendered in a light color on top.
- **`yoga` variant**: Used for promo banners without an authored image yet — renders a gradient background with the text content right-aligned in a light card, instead of relying on a background photo.

### User Interaction Flows

1. **Display**: Author places an image and heading/paragraph/CTA link content in the block; it renders as a banner with no further interaction required.

### Error Handling

<!-- No error handling: this is a static content block. -->
