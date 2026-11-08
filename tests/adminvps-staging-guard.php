<?php
if(PHP_SAPI!=='cli')exit(1);
define('ABSPATH','/tmp/');
function wp_get_environment_type(){return getenv('WB_GUARD_TEST_ENV')?:'staging';}
function add_filter($name,$fn){$GLOBALS['hooks'][$name]=$fn;}
function __return_false(){return false;}
function __return_empty_array(){return [];}
require $argv[1];
function check($ok){if(!$ok)throw new Exception('Staging guard behavior failed');}
check(($GLOBALS['hooks']['pre_wp_mail'])(null)===false);
check(($GLOBALS['hooks']['pre_option_blog_public'])()==='0');
check(($GLOBALS['hooks']['wp_robots'])([])['noindex']===true);
check(array_keys(($GLOBALS['hooks']['woocommerce_available_payment_gateways'])(['bacs'=>new stdClass(),'real_gateway'=>new stdClass()]))===['bacs']);
check(($GLOBALS['hooks']['woocommerce_available_payment_gateways'])(['real_gateway'=>new stdClass()])===[]);
check(($GLOBALS['hooks']['woocommerce_shipping_methods'])([])===[]);
echo "PASS staging guard: mail suppressed, noindex, manual-only gateway, shipping disabled\n";
