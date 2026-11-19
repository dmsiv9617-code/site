<?php
// Run against a reviewed copy after applying server-pricing.patch.
require ($argv[1] ?? __DIR__).'/extras-pricing.php';
function check($ok){if(!$ok)throw new RuntimeException('Price check failed');}
check(wb_extras_total([])===0);
check(wb_extras_total(['box','metric','pages','extra-corners'])===885);
check(wb_extras_total(['corners','markers','stickers','box'])===350);
check((3540+wb_extras_total(['box','metric','pages','extra-corners']))*2===8850);
foreach([['box','box'],['unknown'],['price'=>1],[123]] as $ids){
 $rejected=false;try{wb_extras_total($ids);}catch(InvalidArgumentException $e){$rejected=true;}check($rejected);
}
echo "PASS server-owned fees, bundled extras, quantity arithmetic and invalid input\n";
