<?php
/** Mandatory staging guard: only explicitly enabled workshop mail; no gateways. */
if (!defined('ABSPATH')) exit;
if (wp_get_environment_type() !== 'staging') {
    throw new RuntimeException('Staging guard requires a staging environment');
}
add_filter('pre_wp_mail', static function($pre, $atts) {
    return function_exists('wb_order_mail_allowed') && wb_order_mail_allowed($atts) ? $pre : false;
}, 10, 2);
add_filter('pre_option_blog_public', static fn() => '0');
add_filter('wp_robots', static fn($robots) => array_merge($robots, ['noindex'=>true, 'nofollow'=>true]));
add_filter('woocommerce_available_payment_gateways', static function ($gateways) {
    return isset($gateways['bacs']) ? ['bacs'=>$gateways['bacs']] : [];
});
add_filter('woocommerce_shipping_methods', '__return_empty_array');
