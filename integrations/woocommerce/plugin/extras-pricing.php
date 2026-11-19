<?php
// Server-owned RUB fees; never accept fee amounts supplied by a browser.
function wb_extra_prices() {
 return ['box'=>350,'metric'=>120,'pages'=>295,'extra-corners'=>120];
}
function wb_extras_total($ids) {
 if(!is_array($ids)||!array_is_list($ids)||count($ids)>7||count(array_unique($ids,SORT_REGULAR))!==count($ids))throw new InvalidArgumentException('Некорректные дополнения.');
 $prices=wb_extra_prices();$included=['corners','markers','stickers'];$total=0;
 foreach($ids as $id){
  if(!is_string($id))throw new InvalidArgumentException('Некорректное дополнение.');
  if(in_array($id,$included,true))continue;
  if(!array_key_exists($id,$prices))throw new InvalidArgumentException('Неизвестное дополнение.');
  $total+=$prices[$id];
 }
 return $total;
}
