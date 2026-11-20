<?php
define('WB_BASIC_ACCESS_LIBRARY',true);
require dirname(__DIR__).'/scripts/recover-basic-access.php';
function check($ok,$why){if(!$ok)throw new RuntimeException($why);}
$dir=sys_get_temp_dir().'/wb-basic-test-'.bin2hex(random_bytes(8));mkdir($dir,0700);
$path=$dir.'/auth';$backup=$dir.'/backup';$password='Test fixture passphrase 2026';
$other='other:'.password_hash('another fixture',PASSWORD_BCRYPT)."\r\n";
$original='woodbase-reviewer:'.password_hash('old fixture',PASSWORD_BCRYPT)."\r\n".$other;
file_put_contents($path,$original);chmod($path,0640);file_put_contents($backup,$original);chmod($backup,0600);
$stat=stat($path);
try{
 wb_basic_reset($path,$backup,'woodbase-reviewer',$password);
 $changed=file_get_contents($path);check(str_ends_with($changed,$other),'other account and CRLF preserved');
 preg_match('/^woodbase-reviewer:([^\r\n]+)/',$changed,$m);check(password_verify($password,$m[1]),'new password verifies');
 clearstatcache(true,$path);$after=stat($path);
 foreach(['ino','uid','gid','mode'] as $field)check($after[$field]===$stat[$field],'bind-mounted file metadata preserved: '.$field);
 check(file_get_contents($backup)===$original,'backup unchanged');
 // A stale backup cannot silently overwrite a later password change.
 $rejected=false;try{wb_basic_reset($path,$backup,'woodbase-reviewer',$password);}catch(RuntimeException $e){$rejected=true;}check($rejected&&file_get_contents($path)===$changed,'stale backup refused');
 foreach(['short',str_repeat('x',73)] as $bad){file_put_contents($path,$original);$rejected=false;try{wb_basic_reset($path,$backup,'woodbase-reviewer',$bad);}catch(RuntimeException $e){$rejected=true;}check($rejected&&file_get_contents($path)===$original,'invalid password cannot change file');}
 foreach(['missing','woodbase-reviewer:bad'] as $badUser){$rejected=false;try{wb_basic_reset($path,$backup,$badUser,$password);}catch(RuntimeException $e){$rejected=true;}check($rejected&&file_get_contents($path)===$original,'invalid account cannot change file');}
 $duplicate=$original.'woodbase-reviewer:duplicate'."\n";file_put_contents($path,$duplicate);file_put_contents($backup,$duplicate);$rejected=false;try{wb_basic_reset($path,$backup,'woodbase-reviewer',$password);}catch(RuntimeException $e){$rejected=true;}check($rejected&&file_get_contents($path)===$duplicate,'duplicate account rejected');
 symlink($backup,$dir.'/link');$rejected=false;try{wb_basic_reset($path,$dir.'/link','woodbase-reviewer',$password);}catch(RuntimeException $e){$rejected=true;}check($rejected,'symlink backup rejected');
 echo "PASS basic recovery: bcrypt, unchanged backup/other users, inode and permissions, stale-backup and invalid-input refusal\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
