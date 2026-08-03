import { events } from '@dropins/tools/event-bus.js';
import { h } from '@dropins/tools/preact.js';
import {
  InLineAlert,
  Icon,
  provider as UI,
} from '@dropins/tools/components.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';
import { WishlistAlert } from '@dropins/storefront-wishlist/containers/WishlistAlert.js';

import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink } from '../../scripts/commerce.js';
import { refreshCart } from '../../scripts/connector-cart.js';

/**
 * The connector cart only carries sku/name/qty/price/rowTotal, so this
 * cart is rendered directly from that data instead of through
 * @dropins/storefront-cart's containers, which expect the full native
 * Magento Cart schema (images, options, coupons, shipping, etc).
 */

function formatPrice(amount, currency) {
  return new Intl.NumberFormat(document.documentElement.lang || 'en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount ?? 0);
}

export default async function decorate(block) {
  const {
    'hide-heading': hideHeading = 'false',
    'max-items': maxItems,
    'start-shopping-url': startShoppingURL = '',
    'checkout-url': checkoutURL = '',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();

  let currentNotification = null;

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="cart__notification"></div>
    <div class="cart__wrapper" hidden>
      <div class="cart__left-column">
        <h1 class="cart__heading"></h1>
        <table class="cart__table">
          <thead>
            <tr>
              <th>${placeholders?.Cart?.CartSummaryTable?.item ?? 'Item'}</th>
              <th>${placeholders?.Cart?.CartSummaryTable?.qty ?? 'Qty'}</th>
              <th>${placeholders?.Cart?.CartSummaryTable?.price ?? 'Price'}</th>
              <th>${placeholders?.Cart?.CartSummaryTable?.subtotal ?? 'Subtotal'}</th>
            </tr>
          </thead>
          <tbody class="cart__list"></tbody>
        </table>
      </div>
      <div class="cart__right-column">
        <div class="cart__order-summary">
          <h2>${placeholders?.Cart?.PriceSummary?.orderSummary ?? 'Order Summary'}</h2>
          <div class="cart__summary-row cart__summary-row--total">
            <span>${placeholders?.Cart?.PriceSummary?.total?.label ?? 'Total'}</span>
            <span class="cart__total-value"></span>
          </div>
          <a class="cart__checkout-button button" href="${checkoutURL ? rootLink(checkoutURL) : '#'}">
            ${placeholders?.Cart?.PriceSummary?.checkout ?? 'Checkout'}
          </a>
        </div>
      </div>
    </div>
    <div class="cart__empty-cart" hidden>
      <h2 class="cart__empty-cart-heading">${placeholders?.Cart?.EmptyCart?.heading ?? 'Your cart is empty'}</h2>
      <a class="cart__empty-cart-cta button" href="${startShoppingURL ? rootLink(startShoppingURL) : rootLink('/')}">
        ${placeholders?.Cart?.EmptyCart?.cta ?? 'Start shopping'}
      </a>
    </div>
  `);

  const $notification = fragment.querySelector('.cart__notification');
  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $heading = fragment.querySelector('.cart__heading');
  const $list = fragment.querySelector('.cart__list');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');
  const $totalValue = fragment.querySelector('.cart__total-value');
  const $checkoutButton = fragment.querySelector('.cart__checkout-button');

  block.innerHTML = '';
  block.appendChild(fragment);

  function renderCart(cart) {
    const items = cart?.items ?? [];
    const isEmpty = items.length === 0;

    $wrapper.hidden = isEmpty;
    $emptyCart.hidden = !isEmpty;

    if (isEmpty) return;

    if (hideHeading === 'true') {
      $heading.remove();
    } else {
      $heading.textContent = (placeholders?.Cart?.Cart?.heading ?? 'Shopping Cart ({count})')
        .replace('{count}', cart.itemCount ?? items.length);
    }

    const visibleItems = maxItems ? items.slice(0, parseInt(maxItems, 10)) : items;
    $list.innerHTML = '';
    visibleItems.forEach((item) => {
      const row = document.createElement('tr');
      row.className = 'cart__item';
      row.innerHTML = `
        <td class="cart__item-name">${item.name ?? item.sku}</td>
        <td class="cart__item-qty">${item.qty}</td>
        <td class="cart__item-price">${formatPrice(item.price, cart.currency)}</td>
        <td class="cart__item-subtotal">${formatPrice(item.rowTotal, cart.currency)}</td>
      `;
      $list.appendChild(row);
    });

    $totalValue.textContent = formatPrice(cart.grandTotal, cart.currency);
    $checkoutButton.hidden = !checkoutURL;
  }

  function showError(message) {
    currentNotification?.remove();
    UI.render(InLineAlert, {
      heading: message,
      type: 'error',
      variant: 'primary',
      icon: h(Icon, { source: 'AlertWithCircle' }),
      'aria-live': 'assertive',
      role: 'alert',
      onDismiss: () => {
        currentNotification?.remove();
      },
    })($notification).then((rendered) => {
      currentNotification = rendered;
    });
  }

  try {
    const cart = await refreshCart();
    renderCart(cart);
  } catch (error) {
    console.error('Error loading cart from connector mesh:', error);
    showError(placeholders?.Global?.ProductLoadError ?? 'Failed to load your cart');
    renderCart(null);
  }

  events.on('wishlist/alert', ({ action, item }) => {
    wishlistRender.render(WishlistAlert, {
      action,
      item,
      routeToWishlist: rootLink('/wishlist'),
    })($notification);

    setTimeout(() => {
      $notification.innerHTML = '';
    }, 5000);
  });

  return Promise.resolve();
}
