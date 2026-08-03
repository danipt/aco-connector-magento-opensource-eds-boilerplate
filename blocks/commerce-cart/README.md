# Commerce Cart Block

## Overview

The Commerce Cart block renders a read-only shopping cart summary (line items and order total) sourced from the ACO connector's mesh GraphQL fields (`connectorGetCart`) rather than the native Magento Cart GraphQL schema. Because that connector schema only carries `sku`/`name`/`qty`/`price`/`rowTotal`, this block does not use `@dropins/storefront-cart`'s containers and does not support product images, configurable options, quantity updates, item removal, coupons, gift cards, or shipping estimation.

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required | Side Effects |
|-------------------|------|---------|-------------|----------|--------------|
| `hide-heading` | string | `'false'` | Controls whether the cart heading is hidden | No | Changes visibility of cart section heading |
| `max-items` | string | undefined | Maximum number of items to display in cart | No | Limits the number of cart items shown |
| `start-shopping-url` | string | `''` | URL for "Start Shopping" button when cart is empty | No | Sets destination for empty cart CTA |
| `checkout-url` | string | `''` | URL for checkout button | No | Sets destination for checkout action |

<!-- ### URL Parameters

No URL parameters directly affect this block's behavior. -->

<!-- ### Local Storage

No localStorage keys are used by this block. -->

### Events

#### Event Listeners

- `events.on('wishlist/alert', callback)` - Listens for wishlist actions to show wishlist-related notifications

## Behavior Patterns

### Page Context Detection

- **Empty Cart**: When the connector cart has no items, shows empty cart message with start shopping CTA
- **Populated Cart**: When cart has items, shows a line-item table (name, qty, price, subtotal) and the order total

### User Interaction Flows

1. **Cart Display**: On decoration, the block fetches the current cart from the connector mesh (`scripts/connector-cart.js`) and renders it
2. **Checkout Flow**: Users can proceed to checkout via the configured checkout URL
3. **Empty Cart Handling**: When cart is empty, shows start shopping CTA and hides the item table/order summary

### Error Handling

- **Cart Data Errors**: If the connector mesh request fails, shows an inline error notification and treats the cart as empty
