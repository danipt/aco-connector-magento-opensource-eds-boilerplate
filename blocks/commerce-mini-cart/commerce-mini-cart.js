import { events } from '@dropins/tools/event-bus.js';
import { h } from '@dropins/tools/preact.js';
import {
  InLineAlert,
  Icon,
  provider as UI,
} from '@dropins/tools/components.js';

import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink } from '../../scripts/commerce.js';
import { refreshCart, formatPrice } from '../../scripts/connector-cart.js';

/**
 * The connector cart only carries sku/name/qty/price/rowTotal, so this
 * mini-cart is rendered directly from that data instead of through
 * @dropins/storefront-cart's MiniCart container, which tracks its own
 * cart id (a cookie disconnected from the connector's cart) and expects
 * the full native Magento Cart schema (images, options, quantity updates,
 * item removal, coupons, etc).
 */

export default async function decorate(block) {
  const {
    'start-shopping-url': startShoppingURL = '',
    'cart-url': cartURL = '',
    'checkout-url': checkoutURL = '',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();

  let currentNotification = null;

  const fragment = document.createRange().createContextualFragment(`
    <div class="mini-cart__notification"></div>
    <div class="mini-cart__added-message"></div>
    <div class="mini-cart__body" hidden>
      <ul class="mini-cart__list"></ul>
      <div class="mini-cart__total">
        <span>${placeholders?.Cart?.PriceSummary?.total?.label ?? 'Total'}</span>
        <span class="mini-cart__total-value"></span>
      </div>
      <a class="mini-cart__cart-link button" href="${cartURL ? rootLink(cartURL) : '#'}">
        ${placeholders?.Global?.ViewCart ?? 'View Cart'}
      </a>
      <a class="mini-cart__checkout-button button" href="${checkoutURL ? rootLink(checkoutURL) : '#'}">
        ${placeholders?.Cart?.PriceSummary?.checkout ?? 'Checkout'}
      </a>
    </div>
    <div class="mini-cart__empty" hidden>
      <p class="mini-cart__empty-heading">${placeholders?.Cart?.EmptyCart?.heading ?? 'Your cart is empty'}</p>
      <a class="mini-cart__empty-cta button" href="${startShoppingURL ? rootLink(startShoppingURL) : rootLink('/')}">
        ${placeholders?.Cart?.EmptyCart?.cta ?? 'Start shopping'}
      </a>
    </div>
  `);

  const $notification = fragment.querySelector('.mini-cart__notification');
  const $addedMessage = fragment.querySelector('.mini-cart__added-message');
  const $body = fragment.querySelector('.mini-cart__body');
  const $list = fragment.querySelector('.mini-cart__list');
  const $empty = fragment.querySelector('.mini-cart__empty');
  const $totalValue = fragment.querySelector('.mini-cart__total-value');

  block.innerHTML = '';
  block.appendChild(fragment);

  function renderCart(cart) {
    const items = cart?.items ?? [];
    const isEmpty = items.length === 0;

    $body.hidden = isEmpty;
    $empty.hidden = !isEmpty;

    if (isEmpty) return;

    $list.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'mini-cart__item';
      row.innerHTML = `
        <span class="mini-cart__item-name">${item.name ?? item.sku}</span>
        <span class="mini-cart__item-qty">${item.qty}</span>
        <span class="mini-cart__item-price">${formatPrice(item.rowTotal, cart.currency)}</span>
      `;
      $list.appendChild(row);
    });

    $totalValue.textContent = formatPrice(cart.grandTotal, cart.currency);
  }

  function showAddedMessage() {
    $addedMessage.textContent = placeholders?.Global?.MiniCartAddedMessage ?? 'Item added to cart';
    $addedMessage.classList.add('mini-cart__added-message--visible');
    setTimeout(() => {
      $addedMessage.classList.remove('mini-cart__added-message--visible');
    }, 3000);
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

  events.on('connector-cart/data', renderCart, { eager: true });
  events.on('cart/product/added', showAddedMessage, { eager: true });

  return block;
}
