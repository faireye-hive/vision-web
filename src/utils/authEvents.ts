export function requestLogin(): void {
  window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
}
